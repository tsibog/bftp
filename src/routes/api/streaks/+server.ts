import { json } from '@sveltejs/kit';
import { getRedis } from '$lib/cache';
import type { RequestHandler } from './$types';

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
