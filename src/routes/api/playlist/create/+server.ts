import { error, json } from '@sveltejs/kit';
import { createPlaylist, addTracksToPlaylist, refreshAccessToken, getCurrentUser } from '$lib/spotify';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	let accessToken = cookies.get('spotify_access_token');
	const refreshToken = cookies.get('spotify_refresh_token');
	const tokenExpires = cookies.get('spotify_token_expires');
	let userId = cookies.get('spotify_user_id');

	if (!accessToken || !refreshToken) {
		throw error(401, 'Not authenticated');
	}

	// Check if token needs refresh
	if (tokenExpires && Date.now() > parseInt(tokenExpires) - 60000) {
		try {
			const newTokens = await refreshAccessToken(refreshToken);
			accessToken = newTokens.access_token;
			const expiresAt = Date.now() + newTokens.expires_in * 1000;

			cookies.set('spotify_access_token', accessToken, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: false,
				maxAge: newTokens.expires_in
			});
			cookies.set('spotify_token_expires', expiresAt.toString(), {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: false,
				maxAge: 60 * 60 * 24 * 30
			});
		} catch {
			throw error(401, 'Token refresh failed');
		}
	}

	// Get user ID if not stored
	if (!userId) {
		const user = await getCurrentUser(accessToken);
		userId = user.id;
		cookies.set('spotify_user_id', userId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: false,
			maxAge: 60 * 60 * 24 * 30
		});
	}

	const body = await request.json();
	const { trackUris, playlistName, playlistDescription } = body as {
		trackUris: string[];
		playlistName: string;
		playlistDescription: string;
	};

	if (!trackUris || !playlistName) {
		throw error(400, 'Missing required parameters');
	}

	try {
		// Create playlist
		const playlist = await createPlaylist(accessToken, userId, playlistName, playlistDescription);

		// Add tracks
		if (trackUris.length > 0) {
			await addTracksToPlaylist(accessToken, playlist.id, trackUris);
		}

		return json({
			playlistUrl: playlist.external_urls.spotify,
			playlistName,
			trackCount: trackUris.length
		});
	} catch (e) {
		throw error(500, e instanceof Error ? e.message : 'Failed to create playlist');
	}
};
