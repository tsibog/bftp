import { Redis } from '@upstash/redis';

export interface CachedTrack {
	uri: string;
	name: string;
	artists: string;
	album: string;
	image: string;
}

// Initialize Redis client - will use UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars
let redis: Redis | null = null;

function getRedis(): Redis | null {
	if (redis) return redis;

	// Support both Vercel KV naming and direct Upstash naming
	const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
	const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

	if (!url || !token) {
		console.warn('Redis not configured - caching disabled. Expected KV_REST_API_URL/TOKEN or UPSTASH_REDIS_REST_URL/TOKEN');
		return null;
	}

	redis = new Redis({ url, token });
	return redis;
}

/**
 * Generate a cache key from song and artist
 */
export function getCacheKey(song: string, artist: string): string {
	// Normalize: lowercase, remove special chars, trim
	const normalizedSong = song.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
	const normalizedArtist = artist.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
	return `spotify:${normalizedSong}:::${normalizedArtist}`;
}

/**
 * Get a track from cache
 */
export async function getFromCache(song: string, artist: string): Promise<CachedTrack | null> {
	const client = getRedis();
	if (!client) return null;

	try {
		const key = getCacheKey(song, artist);
		const cached = await client.get<CachedTrack>(key);
		return cached;
	} catch (e) {
		console.error('Cache get error:', e);
		return null;
	}
}

/**
 * Add a track to cache (with 90 day expiry)
 */
export async function addToCache(song: string, artist: string, track: CachedTrack): Promise<void> {
	const client = getRedis();
	if (!client) return;

	try {
		const key = getCacheKey(song, artist);
		// Cache for 90 days
		await client.set(key, track, { ex: 60 * 60 * 24 * 90 });
	} catch (e) {
		console.error('Cache set error:', e);
	}
}

/**
 * Cache a "not found" result to avoid repeated API calls
 */
export async function cacheNotFound(song: string, artist: string): Promise<void> {
	const client = getRedis();
	if (!client) return;

	try {
		const key = getCacheKey(song, artist) + ':notfound';
		// Cache not-found for 7 days (songs might be added to Spotify later)
		await client.set(key, true, { ex: 60 * 60 * 24 * 7 });
	} catch (e) {
		console.error('Cache set error:', e);
	}
}

/**
 * Check if a song was previously not found
 */
export async function isNotFoundCached(song: string, artist: string): Promise<boolean> {
	const client = getRedis();
	if (!client) return false;

	try {
		const key = getCacheKey(song, artist) + ':notfound';
		const cached = await client.get(key);
		return cached === true;
	} catch (e) {
		console.error('Cache get error:', e);
		return false;
	}
}
