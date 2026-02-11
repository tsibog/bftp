import { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URI } from '$env/static/private';

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_URL = 'https://api.spotify.com/v1';

const SCOPES = [
	'playlist-modify-public',
	'playlist-modify-private',
	'user-read-private',
	'user-modify-playback-state',
	'user-read-playback-state'
].join(' ');

// Client Credentials token cache (app-level, no user login required)
let clientToken: string | null = null;
let clientTokenExpires = 0;

/**
 * Get an app-level access token using Client Credentials flow.
 * This does NOT require user login and can access public endpoints like Search.
 */
export async function getClientCredentialsToken(): Promise<string> {
	// Return cached token if still valid (with 60s buffer)
	if (clientToken && Date.now() < clientTokenExpires - 60000) {
		return clientToken;
	}

	const response = await fetch(SPOTIFY_TOKEN_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Authorization: `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`
		},
		body: new URLSearchParams({
			grant_type: 'client_credentials'
		})
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Client credentials token request failed: ${error}`);
	}

	const data = await response.json();
	clientToken = data.access_token;
	clientTokenExpires = Date.now() + data.expires_in * 1000;

	return clientToken!;
}

export function getAuthUrl(state: string): string {
	const params = new URLSearchParams({
		client_id: SPOTIFY_CLIENT_ID,
		response_type: 'code',
		redirect_uri: SPOTIFY_REDIRECT_URI,
		scope: SCOPES,
		state
	});
	return `${SPOTIFY_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<{
	access_token: string;
	refresh_token: string;
	expires_in: number;
}> {
	const response = await fetch(SPOTIFY_TOKEN_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Authorization: `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`
		},
		body: new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			redirect_uri: SPOTIFY_REDIRECT_URI
		})
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Token exchange failed: ${error}`);
	}

	return response.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<{
	access_token: string;
	expires_in: number;
}> {
	const response = await fetch(SPOTIFY_TOKEN_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Authorization: `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`
		},
		body: new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: refreshToken
		})
	});

	if (!response.ok) {
		throw new Error('Token refresh failed');
	}

	return response.json();
}

export async function getCurrentUser(accessToken: string): Promise<{
	id: string;
	display_name: string;
	images: { url: string }[];
}> {
	const response = await fetch(`${SPOTIFY_API_URL}/me`, {
		headers: { Authorization: `Bearer ${accessToken}` }
	});

	if (!response.ok) {
		throw new Error('Failed to get user profile');
	}

	return response.json();
}

/**
 * Normalize a string for comparison (lowercase, remove special chars)
 */
function normalize(str: string): string {
	return str
		.toLowerCase()
		.replace(/[()[\]'"!?.,]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Calculate similarity between two strings (0-1)
 */
function similarity(a: string, b: string): number {
	const normA = normalize(a);
	const normB = normalize(b);

	if (normA === normB) return 1;
	if (normA.includes(normB) || normB.includes(normA)) return 0.9;

	// Simple word overlap score
	const wordsA = new Set(normA.split(' '));
	const wordsB = new Set(normB.split(' '));
	const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
	const union = new Set([...wordsA, ...wordsB]).size;

	return intersection / union;
}

/**
 * Score a track result against the expected song/artist/year
 */
function scoreTrack(
	track: { name: string; artists: { name: string }[]; album: { release_date: string } },
	expectedSong: string,
	expectedArtist: string,
	expectedYear?: number
): number {
	let score = 0;

	// Song title similarity (most important - weight 50)
	const titleSim = similarity(track.name, expectedSong);
	score += titleSim * 50;

	// Artist similarity (weight 35)
	const trackArtists = track.artists.map((a) => a.name).join(' ');
	const artistSim = Math.max(
		similarity(trackArtists, expectedArtist),
		// Also check individual artists
		...track.artists.map((a) => similarity(a.name, expectedArtist.split(/[,&]|feat\.|featuring/i)[0]))
	);
	score += artistSim * 35;

	// Year proximity bonus (weight 15)
	if (expectedYear && track.album.release_date) {
		const releaseYear = parseInt(track.album.release_date.substring(0, 4));
		const yearDiff = Math.abs(releaseYear - expectedYear);
		// Within 2 years = full points, degrades after that
		const yearScore = Math.max(0, 1 - yearDiff / 10);
		score += yearScore * 15;
	}

	return score;
}

export async function searchTrack(
	accessToken: string,
	song: string,
	artist: string,
	year?: number
): Promise<{ uri: string; name: string; artists: string; album: string; image: string } | null> {
	// Clean up the search query
	const cleanSong = song.replace(/[()[\]]/g, '').trim();
	const cleanArtist = artist.split(/[,&]|feat\.|featuring/i)[0].trim();

	const query = `track:${cleanSong} artist:${cleanArtist}`;
	const params = new URLSearchParams({
		q: query,
		type: 'track',
		limit: '10' // Get multiple results to find best match
	});

	const response = await fetch(`${SPOTIFY_API_URL}/search?${params}`, {
		headers: { Authorization: `Bearer ${accessToken}` }
	});

	if (!response.ok) {
		console.error('Search failed:', await response.text());
		return null;
	}

	const data = await response.json();
	let tracks = data.tracks?.items || [];

	// If no results, try broader search
	if (tracks.length === 0) {
		const broadParams = new URLSearchParams({
			q: `${cleanSong} ${cleanArtist}`,
			type: 'track',
			limit: '10'
		});

		const broadResponse = await fetch(`${SPOTIFY_API_URL}/search?${broadParams}`, {
			headers: { Authorization: `Bearer ${accessToken}` }
		});

		if (broadResponse.ok) {
			const broadData = await broadResponse.json();
			tracks = broadData.tracks?.items || [];
		}
	}

	if (tracks.length === 0) {
		return null;
	}

	// Score all tracks and pick the best one
	const scoredTracks = tracks.map(
		(track: {
			uri: string;
			name: string;
			artists: { name: string }[];
			album: { name: string; release_date: string; images: { url: string }[] };
		}) => ({
			track,
			score: scoreTrack(track, song, artist, year)
		})
	);

	// Sort by score descending
	scoredTracks.sort((a: { score: number }, b: { score: number }) => b.score - a.score);

	const bestMatch = scoredTracks[0];

	// Require minimum score to avoid completely wrong matches
	if (bestMatch.score < 40) {
		console.warn(`Low confidence match for "${song}" by "${artist}": score=${bestMatch.score}`);
		// Still return it, but log the warning
	}

	const track = bestMatch.track;
	return {
		uri: track.uri,
		name: track.name,
		artists: track.artists.map((a: { name: string }) => a.name).join(', '),
		album: track.album.name,
		image: track.album.images?.[0]?.url || ''
	};
}

export async function createPlaylist(
	accessToken: string,
	userId: string,
	name: string,
	description: string
): Promise<{ id: string; external_urls: { spotify: string } }> {
	const response = await fetch(`${SPOTIFY_API_URL}/users/${userId}/playlists`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${accessToken}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			name,
			description,
			public: true
		})
	});

	if (!response.ok) {
		throw new Error('Failed to create playlist');
	}

	return response.json();
}

export async function addTracksToPlaylist(
	accessToken: string,
	playlistId: string,
	trackUris: string[]
): Promise<void> {
	// Spotify allows max 100 tracks per request
	const chunks = [];
	for (let i = 0; i < trackUris.length; i += 100) {
		chunks.push(trackUris.slice(i, i + 100));
	}

	for (const chunk of chunks) {
		const response = await fetch(`${SPOTIFY_API_URL}/playlists/${playlistId}/tracks`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ uris: chunk })
		});

		if (!response.ok) {
			throw new Error('Failed to add tracks to playlist');
		}
	}
}

export async function playTrack(accessToken: string, trackUri: string): Promise<void> {
	const response = await fetch(`${SPOTIFY_API_URL}/me/player/play`, {
		method: 'PUT',
		headers: {
			Authorization: `Bearer ${accessToken}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			uris: [trackUri]
		})
	});

	if (!response.ok) {
		const text = await response.text();
		if (response.status === 404) {
			throw new Error('No active Spotify device found. Open Spotify on any device first.');
		}
		throw new Error(`Failed to play track: ${text}`);
	}
}
