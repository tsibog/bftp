import { redirect, error } from '@sveltejs/kit';
import { exchangeCodeForTokens, getCurrentUser } from '$lib/spotify';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const storedState = cookies.get('spotify_auth_state');
	const authError = url.searchParams.get('error');

	// Clear the state cookie
	cookies.delete('spotify_auth_state', { path: '/' });

	// Check for auth errors
	if (authError) {
		throw error(400, `Spotify authorization failed: ${authError}`);
	}

	// Verify state matches
	if (!state || state !== storedState) {
		throw error(400, 'State mismatch - possible CSRF attack');
	}

	// Exchange code for tokens
	if (!code) {
		throw error(400, 'No authorization code provided');
	}

	try {
		const tokens = await exchangeCodeForTokens(code);
		const user = await getCurrentUser(tokens.access_token);

		// Store tokens and user info in cookies
		const expiresAt = Date.now() + tokens.expires_in * 1000;

		cookies.set('spotify_access_token', tokens.access_token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: false, // Set to true in production
			maxAge: tokens.expires_in
		});

		cookies.set('spotify_refresh_token', tokens.refresh_token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: false, // Set to true in production
			maxAge: 60 * 60 * 24 * 30 // 30 days
		});

		cookies.set('spotify_token_expires', expiresAt.toString(), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: false,
			maxAge: 60 * 60 * 24 * 30
		});

		cookies.set('spotify_user_id', user.id, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: false,
			maxAge: 60 * 60 * 24 * 30
		});

		cookies.set('spotify_user_name', user.display_name || user.id, {
			path: '/',
			httpOnly: false, // Allow client access for display
			sameSite: 'lax',
			secure: false,
			maxAge: 60 * 60 * 24 * 30
		});

		if (user.images?.[0]?.url) {
			cookies.set('spotify_user_image', user.images[0].url, {
				path: '/',
				httpOnly: false,
				sameSite: 'lax',
				secure: false,
				maxAge: 60 * 60 * 24 * 30
			});
		}
	} catch (e) {
		console.error('Auth callback error:', e);
		throw error(500, 'Failed to complete authentication');
	}

	throw redirect(302, '/');
};
