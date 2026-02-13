import { json } from '@sveltejs/kit';
import { getRedis, getStreaksFromCache, cacheStreaks, type StreakLookup, type StreakEntry } from '$lib/cache';
import { createBadRequestError } from '$lib/utils/error-responses';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const songsParam = url.searchParams.get('songs');
	if (!songsParam) {
		createBadRequestError('Missing songs parameter');
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(songsParam!);
	} catch {
		createBadRequestError('Invalid JSON in songs parameter');
	}

	if (!Array.isArray(parsed)) {
		createBadRequestError('songs must be an array');
	}

	const songs = parsed as StreakLookup[];
	const streaks = await getStreaksFromCache(songs);

	const result: Record<string, { before: number; after: number }> = {};
	for (const [key, value] of Object.entries(streaks)) {
		if (value !== null) {
			result[key] = value;
		}
	}

	return json(result);
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { streaks } = body as { streaks: StreakEntry[] };

	if (!streaks || !Array.isArray(streaks) || streaks.length === 0) {
		createBadRequestError('Missing or empty streaks array');
	}

	await cacheStreaks(streaks);

	return json({ success: true });
};

export const DELETE: RequestHandler = async () => {
	const redis = getRedis();
	if (!redis) {
		return json({ success: false, message: 'Redis not configured' });
	}

	let cursor = '0';
	let deleted = 0;

	do {
		const result = await redis.scan(cursor, { match: '*:streak:*', count: 100 });
		cursor = result[0];
		const keys = result[1];

		if (keys.length > 0) {
			await redis.del(...keys);
			deleted += keys.length;
		}
	} while (cursor !== '0');

	return json({ success: true, deleted });
};
