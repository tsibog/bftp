import { json } from '@sveltejs/kit';
import {
	getRedis,
	getStreaksFromCache,
	cacheStreaks,
	type StreakLookup,
} from '$lib/cache';
import {
	calculateTop5Streak,
	type BillboardChart,
	type ChartFetcher,
} from '$lib/billboard';
import validDates from '$lib/data/valid_dates.json';
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

export const POST: RequestHandler = async ({ request, fetch: svelteKitFetch }) => {
	const body = await request.json();
	const { songs } = body as { songs: StreakLookup[] };

	if (!songs || !Array.isArray(songs) || songs.length === 0) {
		createBadRequestError('Missing or empty songs array');
	}

	// In-memory chart cache scoped to this request — each chart date
	// is fetched at most once, even when multiple songs share neighbors.
	const chartCache = new Map<string, Promise<BillboardChart | null>>();

	const fetchChart: ChartFetcher = (date: string) => {
		if (!chartCache.has(date)) {
			chartCache.set(
				date,
				svelteKitFetch(`/billboard/date/${date}.json`)
					.then((res) => (res.ok ? (res.json() as Promise<BillboardChart>) : null))
					.catch(() => null)
			);
		}
		return chartCache.get(date)!;
	};

	// Calculate streaks in parallel — songs from the same chart date
	// automatically share cached chart fetches.
	const results = await Promise.all(
		songs.map(async (song) => {
			const weeks = await calculateTop5Streak(
				song.song,
				song.artist,
				song.chartDate,
				validDates,
				fetchChart
			);
			return { ...song, weeks };
		})
	);

	// Cache all calculated streaks in Redis
	await cacheStreaks(
		results.map((r) => ({
			chartDate: r.chartDate,
			song: r.song,
			artist: r.artist,
			weeks: r.weeks,
		}))
	);

	// Build response keyed the same way the client expects
	const response: Record<string, { before: number; after: number }> = {};
	for (const r of results) {
		response[`${r.chartDate}:${r.song}:${r.artist}`] = r.weeks;
	}

	return json(response);
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
