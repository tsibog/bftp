import { Redis } from '@upstash/redis';
import { env } from '$env/dynamic/private';

export interface CachedTrack {
	uri: string;
	name: string;
	artists: string;
	album: string;
	image: string;
}

let redis: Redis | null = null;
let redisChecked = false;

export function getRedis(): Redis | null {
	if (redisChecked) return redis;
	redisChecked = true;

	const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
	const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;

	if (!url || !token) {
		console.warn('Redis not configured - caching disabled');
		return null;
	}

	redis = new Redis({ url, token });
	return redis;
}

const CACHE_VERSION = 2;

function normalize(str: string): string {
	return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

export function getCacheKey(song: string, artist: string): string {
	return `v${CACHE_VERSION}:spotify:${normalize(song)}:::${normalize(artist)}`;
}

export async function getFromCache(song: string, artist: string): Promise<CachedTrack | null> {
	const client = getRedis();
	if (!client) return null;

	try {
		return await client.get<CachedTrack>(getCacheKey(song, artist));
	} catch (e) {
		console.error('Cache get error:', e);
		return null;
	}
}

export async function addToCache(song: string, artist: string, track: CachedTrack): Promise<void> {
	const client = getRedis();
	if (!client) return;

	try {
		await client.set(getCacheKey(song, artist), track, { ex: 60 * 60 * 24 * 90 });
	} catch (e) {
		console.error('Cache set error:', e);
	}
}

export async function cacheNotFound(song: string, artist: string): Promise<void> {
	const client = getRedis();
	if (!client) return;

	try {
		await client.set(getCacheKey(song, artist) + ':notfound', true, { ex: 60 * 60 * 24 * 7 });
	} catch (e) {
		console.error('Cache set error:', e);
	}
}

export async function isNotFoundCached(song: string, artist: string): Promise<boolean> {
	const client = getRedis();
	if (!client) return false;

	try {
		const cached = await client.get(getCacheKey(song, artist) + ':notfound');
		return cached === true;
	} catch (e) {
		console.error('Cache get error:', e);
		return false;
	}
}

export interface StreakLookup {
	chartDate: string;
	song: string;
	artist: string;
}

export interface StreakEntry extends StreakLookup {
	weeks: { before: number; after: number };
}

function getStreakKey(chartDate: string, song: string, artist: string): string {
	return `v${CACHE_VERSION}:streak:${chartDate}:${normalize(song)}:${normalize(artist)}`;
}

function getStreakCacheKey(lookup: StreakLookup): string {
	return `${lookup.chartDate}:${lookup.song}:${lookup.artist}`;
}

export async function getStreaksFromCache(
	songs: StreakLookup[]
): Promise<Record<string, { before: number; after: number } | null>> {
	const client = getRedis();
	if (!client || songs.length === 0) {
		return Object.fromEntries(songs.map((s) => [getStreakCacheKey(s), null]));
	}

	try {
		const pipeline = client.pipeline();
		const keys: { key: string; lookup: StreakLookup }[] = [];

		for (const song of songs) {
			const key = getStreakKey(song.chartDate, song.song, song.artist);
			keys.push({ key, lookup: song });
			pipeline.get(key);
		}

		const results = await pipeline.exec();
		const streaks: Record<string, { before: number; after: number } | null> = {};

		for (let i = 0; i < keys.length; i++) {
			const cacheKey = getStreakCacheKey(keys[i].lookup);
			const value = results[i];
			streaks[cacheKey] = value && typeof value === 'object' && 'before' in value && 'after' in value
				? value as { before: number; after: number }
				: null;
		}

		return streaks;
	} catch (e) {
		console.error('Streak cache get error:', e);
		return Object.fromEntries(songs.map((s) => [getStreakCacheKey(s), null]));
	}
}

export async function cacheStreaks(streaks: StreakEntry[]): Promise<void> {
	const client = getRedis();
	if (!client || streaks.length === 0) return;

	try {
		const pipeline = client.pipeline();

		for (const entry of streaks) {
			pipeline.set(getStreakKey(entry.chartDate, entry.song, entry.artist), entry.weeks);
		}

		await pipeline.exec();
	} catch (e) {
		console.error('Streak cache set error:', e);
	}
}
