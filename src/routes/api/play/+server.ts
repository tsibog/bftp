import { error, json } from '@sveltejs/kit';
import { playTrack, refreshAccessToken } from '$lib/spotify';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	let accessToken = cookies.get('spotify_access_token');
	const refreshToken = cookies.get('spotify_refresh_token');
	const tokenExpires = cookies.get('spotify_token_expires');

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

	const body = await request.json();
	const { uri } = body as { uri: string };

	if (!uri) {
		throw error(400, 'Missing track URI');
	}

	try {
		await playTrack(accessToken, uri);
		return json({ success: true });
	} catch (e) {
		throw error(500, e instanceof Error ? e.message : 'Failed to play track');
	}
};
