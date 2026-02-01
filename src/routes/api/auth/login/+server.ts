import { redirect } from '@sveltejs/kit';
import { getAuthUrl } from '$lib/spotify';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	// Generate a random state for CSRF protection
	const state = crypto.randomUUID();

	// Store state in cookie for verification
	cookies.set('spotify_auth_state', state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: false, // Set to true in production
		maxAge: 60 * 10 // 10 minutes
	});

	const authUrl = getAuthUrl(state);
	throw redirect(302, authUrl);
};
