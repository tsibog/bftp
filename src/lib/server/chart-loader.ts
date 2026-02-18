import type { BillboardChart } from '$lib/billboard';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Module-level cache: persists across requests within the same server/function
// instance. Billboard data is immutable historical data so this is always valid.
const memoryCache = new Map<string, BillboardChart>();

async function readFromDisk(date: string): Promise<BillboardChart | null> {
	try {
		const filePath = resolve('static', 'billboard', 'date', `${date}.json`);
		const content = await readFile(filePath, 'utf-8');
		return JSON.parse(content) as BillboardChart;
	} catch {
		return null;
	}
}

/**
 * Creates a chart fetcher that reads from disk first, then falls back to
 * HTTP fetch (for serverless environments where static files aren't on the
 * function's filesystem). Results are cached in module-level memory so
 * subsequent calls—even across different requests—return instantly.
 */
export function createChartFetcher(fetchFn: typeof fetch) {
	// Request-level dedup for in-flight promises (prevents duplicate
	// concurrent reads for the same date within a single request).
	const inflight = new Map<string, Promise<BillboardChart | null>>();

	return (date: string): Promise<BillboardChart | null> => {
		const cached = memoryCache.get(date);
		if (cached) return Promise.resolve(cached);

		if (!inflight.has(date)) {
			inflight.set(
				date,
				(async () => {
					// Try filesystem first (dev + traditional Node hosting)
					const chart = await readFromDisk(date);
					if (chart) {
						memoryCache.set(date, chart);
						return chart;
					}

					// Fall back to fetch (Vercel / serverless)
					try {
						const res = await fetchFn(`/billboard/date/${date}.json`);
						if (!res.ok) return null;
						const fetched = (await res.json()) as BillboardChart;
						memoryCache.set(date, fetched);
						return fetched;
					} catch {
						return null;
					}
				})()
			);
		}

		return inflight.get(date)!;
	};
}
