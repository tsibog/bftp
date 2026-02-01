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

export async function searchTrack(
	accessToken: string,
	song: string,
	artist: string
): Promise<{ uri: string; name: string; artists: string; album: string; image: string } | null> {
	// Clean up the search query
	const cleanSong = song.replace(/[()[\]]/g, '').trim();
	const cleanArtist = artist.split(/[,&]|feat\.|featuring/i)[0].trim();

	const query = `track:${cleanSong} artist:${cleanArtist}`;
	const params = new URLSearchParams({
		q: query,
		type: 'track',
		limit: '1'
	});

	const response = await fetch(`${SPOTIFY_API_URL}/search?${params}`, {
		headers: { Authorization: `Bearer ${accessToken}` }
	});

	if (!response.ok) {
		console.error('Search failed:', await response.text());
		return null;
	}

	const data = await response.json();
	const track = data.tracks?.items?.[0];

	if (!track) {
		// Try a broader search without the artist filter
		const broadParams = new URLSearchParams({
			q: `${cleanSong} ${cleanArtist}`,
			type: 'track',
			limit: '1'
		});

		const broadResponse = await fetch(`${SPOTIFY_API_URL}/search?${broadParams}`, {
			headers: { Authorization: `Bearer ${accessToken}` }
		});

		if (broadResponse.ok) {
			const broadData = await broadResponse.json();
			const broadTrack = broadData.tracks?.items?.[0];
			if (broadTrack) {
				return {
					uri: broadTrack.uri,
					name: broadTrack.name,
					artists: broadTrack.artists.map((a: { name: string }) => a.name).join(', '),
					album: broadTrack.album.name,
					image: broadTrack.album.images?.[0]?.url || ''
				};
			}
		}
		return null;
	}

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
