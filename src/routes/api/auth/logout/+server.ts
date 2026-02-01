import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	// Clear all Spotify cookies
	cookies.delete('spotify_access_token', { path: '/' });
	cookies.delete('spotify_refresh_token', { path: '/' });
	cookies.delete('spotify_token_expires', { path: '/' });
	cookies.delete('spotify_user_id', { path: '/' });
	cookies.delete('spotify_user_name', { path: '/' });
	cookies.delete('spotify_user_image', { path: '/' });

	throw redirect(302, '/');
};
