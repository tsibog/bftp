import { error } from '@sveltejs/kit';
import { searchTrack, getClientCredentialsToken } from '$lib/spotify';
import {
	getFromCache,
	addToCache,
	isNotFoundCached,
	cacheNotFound,
	getStreaksFromCache,
	cacheStreaks,
} from '$lib/cache';
import {
	getChartDatesForWeek,
	getPositionChange,
	calculateTop5Streak,
	type BillboardChart,
} from '$lib/billboard';
import validDates from '$lib/data/valid_dates.json';
import type { RequestHandler } from './$types';

interface ChartSong {
	year: number;
	chartDate: string;
	song: string;
	artist: string;
	position: number;
	lastWeekPosition: number | null;
	positionChange: 'up' | 'down' | 'same' | 'new';
	weeksInTop5: { before: number; after: number };
}

export const POST: RequestHandler = async ({ request, fetch: svelteKitFetch }) => {
	let accessToken: string;
	try {
		accessToken = await getClientCredentialsToken();
	} catch {
		throw error(500, 'Failed to obtain Spotify API token');
	}

	const body = await request.json();
	const { week, yearRange } = body as { week: number; yearRange: [number, number] };

	if (!week || !yearRange || yearRange.length !== 2) {
		throw error(400, 'Missing week or yearRange');
	}

	const [startYear, endYear] = yearRange;

	// --- Phase 1: Fetch chart data ---
	const chartDates = getChartDatesForWeek(week, startYear, endYear, validDates);

	if (chartDates.size === 0) {
		throw error(400, 'No chart data found for the selected week and years');
	}

	const chartEntries = Array.from(chartDates.entries());
	const fetchErrors: string[] = [];
	const charts = await Promise.all(
		chartEntries.map(async ([year, chartDate]) => {
			try {
				const res = await svelteKitFetch(`/billboard/date/${chartDate}.json`);
				if (!res.ok) {
					fetchErrors.push(`${chartDate}: HTTP ${res.status}`);
					return null;
				}
				const chart: BillboardChart = await res.json();
				return { year, chartDate, chart };
			} catch (e) {
				fetchErrors.push(`${chartDate}: ${e instanceof Error ? e.message : String(e)}`);
				return null;
			}
		})
	);

	const chartSongs: ChartSong[] = [];

	for (const entry of charts) {
		if (!entry) continue;
		const { year, chartDate, chart } = entry;

		for (const song of chart.data.slice(0, 5)) {
			chartSongs.push({
				year,
				chartDate,
				song: song.song,
				artist: song.artist,
				position: song.this_week,
				lastWeekPosition: song.last_week,
				positionChange: getPositionChange(song.this_week, song.last_week),
				weeksInTop5: { before: 1, after: 0 },
			});
		}
	}

	if (chartSongs.length === 0) {
		throw error(400, `No songs found in chart data. Fetch errors: ${fetchErrors.join('; ') || 'none (charts were empty)'}`);
	}

	// --- Phase 2: Resolve streaks (Redis cache → compute uncached) ---
	const streakLookup = chartSongs.map((s) => ({
		chartDate: s.chartDate,
		song: s.song,
		artist: s.artist,
	}));

	const cachedStreaks = await getStreaksFromCache(streakLookup);

	const uncachedSongs: { chartDate: string; song: string; artist: string }[] = [];
	for (const song of chartSongs) {
		const key = `${song.chartDate}:${song.song}:${song.artist}`;
		if (cachedStreaks[key] != null) {
			song.weeksInTop5 = cachedStreaks[key]!;
		} else {
			uncachedSongs.push({ chartDate: song.chartDate, song: song.song, artist: song.artist });
		}
	}

	if (uncachedSongs.length > 0) {
		const inflight = new Map<string, Promise<BillboardChart | null>>();
		const fetchChart = (date: string) => {
			if (!inflight.has(date)) {
				inflight.set(
					date,
					svelteKitFetch(`/billboard/date/${date}.json`)
						.then((res) => (res.ok ? (res.json() as Promise<BillboardChart>) : null))
						.catch(() => null)
				);
			}
			return inflight.get(date)!;
		};

		const streakResults = await Promise.all(
			uncachedSongs.map(async (s) => ({
				...s,
				weeks: await calculateTop5Streak(s.song, s.artist, s.chartDate, validDates, fetchChart),
			}))
		);

		for (const result of streakResults) {
			const match = chartSongs.find(
				(s) => s.chartDate === result.chartDate && s.song === result.song && s.artist === result.artist
			);
			if (match) match.weeksInTop5 = result.weeks;
		}

		await cacheStreaks(
			streakResults.map((r) => ({
				chartDate: r.chartDate,
				song: r.song,
				artist: r.artist,
				weeks: r.weeks,
			}))
		);
	}

	// --- Phase 3: Search Spotify and stream results ---
	const totalSongs = chartSongs.length;

	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();
			const send = (event: string, data: unknown) => {
				controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
			};

			try {
				send('init', { total: totalSongs });

				const allSongs: {
					year: number;
					chartDate: string;
					position: number;
					original: { song: string; artist: string };
					spotify: { uri: string; name: string; artists: string; album: string; image: string } | null;
					fromCache: boolean;
					lastWeekPosition: number | null;
					positionChange: 'up' | 'down' | 'same' | 'new';
					weeksInTop5: { before: number; after: number };
				}[] = [];

				let cacheHits = 0;
				let apiCalls = 0;
				let processed = 0;

				for (const chartSong of chartSongs) {
					processed++;

					let spotifyTrack: {
						uri: string;
						name: string;
						artists: string;
						album: string;
						image: string;
					} | null = null;
					let fromCache = false;

					const cached = await getFromCache(chartSong.song, chartSong.artist);

					if (cached) {
						spotifyTrack = cached;
						fromCache = true;
						cacheHits++;
					} else {
						const notFound = await isNotFoundCached(chartSong.song, chartSong.artist);

						if (notFound) {
							spotifyTrack = null;
							fromCache = true;
							cacheHits++;
						} else {
							spotifyTrack = await searchTrack(
								accessToken,
								chartSong.song,
								chartSong.artist,
								chartSong.year
							);
							apiCalls++;

							if (spotifyTrack) {
								await addToCache(chartSong.song, chartSong.artist, spotifyTrack);
							} else {
								await cacheNotFound(chartSong.song, chartSong.artist);
							}

							await new Promise((r) => setTimeout(r, 80));
						}
					}

					const songEntry = {
						year: chartSong.year,
						chartDate: chartSong.chartDate,
						position: chartSong.position,
						original: { song: chartSong.song, artist: chartSong.artist },
						spotify: spotifyTrack,
						fromCache,
						lastWeekPosition: chartSong.lastWeekPosition,
						positionChange: chartSong.positionChange,
						weeksInTop5: chartSong.weeksInTop5,
					};

					allSongs.push(songEntry);
					send('song', { ...songEntry, progress: processed, total: totalSongs });
				}

				const uris = allSongs.filter((s) => s.spotify).map((s) => s.spotify!.uri);
				const duplicateUris = uris.filter((uri, i) => uris.indexOf(uri) !== i);
				send('duplicates', { uris: [...new Set(duplicateUris)] });

				const notFoundCount = allSongs.filter((s) => !s.spotify).length;
				send('complete', {
					totalSongs: allSongs.length,
					foundSongs: uris.length,
					notFoundCount,
					cacheHits,
					apiCalls,
				});
			} catch (e) {
				console.error('Playlist generation error:', e);
				send('error', { message: e instanceof Error ? e.message : 'Unknown error' });
			} finally {
				controller.close();
			}
		},
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
		},
	});
};
