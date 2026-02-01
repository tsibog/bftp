import { error } from '@sveltejs/kit';
import { searchTrack, refreshAccessToken } from '$lib/spotify';
import {
	getChartDatesForWeek,
	getPreviousChartDates,
	getPositionChange,
	type BillboardChart
} from '$lib/billboard';
import { getFromCache, addToCache, isNotFoundCached, cacheNotFound } from '$lib/cache';
import type { RequestHandler } from './$types';
import validDates from '$lib/data/valid_dates.json';

// Cache for chart data to avoid refetching
const chartCache = new Map<string, BillboardChart>();

async function fetchChart(baseUrl: string, chartDate: string): Promise<BillboardChart | null> {
	if (chartCache.has(chartDate)) {
		return chartCache.get(chartDate)!;
	}

	try {
		const chartUrl = `${baseUrl}/billboard/date/${chartDate}.json`;
		const res = await fetch(chartUrl);
		if (!res.ok) return null;

		const data: BillboardChart = await res.json();
		chartCache.set(chartDate, data);
		return data;
	} catch {
		return null;
	}
}

/**
 * Calculate consecutive weeks a song has been in top 5
 */
async function calculateWeeksInTop5(
	baseUrl: string,
	songName: string,
	artist: string,
	currentChartDate: string
): Promise<number> {
	let streak = 1; // Current week counts as 1
	const previousDates = getPreviousChartDates(currentChartDate, validDates, 52);

	for (const prevDate of previousDates) {
		const chart = await fetchChart(baseUrl, prevDate);
		if (!chart) break;

		// Check if song is in top 5 of previous chart
		const top5 = chart.data.slice(0, 5);
		const found = top5.some(
			(s) =>
				s.song.toLowerCase() === songName.toLowerCase() &&
				s.artist.toLowerCase() === artist.toLowerCase()
		);

		if (found) {
			streak++;
		} else {
			break; // Streak ended
		}
	}

	return streak;
}

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	let accessToken = cookies.get('spotify_access_token');
	const refreshToken = cookies.get('spotify_refresh_token');
	const tokenExpires = cookies.get('spotify_token_expires');

	if (!accessToken || !refreshToken) {
		throw error(401, 'Not authenticated');
	}

	// Check if token needs refresh
	if (tokenExpires && Date.now() > parseInt(tokenExpires) - 60000) {
		try {
			const newTokens = await refreshAccessToken(refreshToken);
			accessToken = newTokens.access_token;
			const expiresAt = Date.now() + newTokens.expires_in * 1000;

			cookies.set('spotify_access_token', accessToken, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: false,
				maxAge: newTokens.expires_in
			});
			cookies.set('spotify_token_expires', expiresAt.toString(), {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: false,
				maxAge: 60 * 60 * 24 * 30
			});
		} catch {
			throw error(401, 'Token refresh failed');
		}
	}

	const body = await request.json();
	const { week, startYear, endYear } = body as {
		week: number;
		startYear: number;
		endYear: number;
	};

	if (!week || !startYear || !endYear) {
		throw error(400, 'Missing required parameters');
	}

	// Get chart dates for the requested week across years
	const chartDates = getChartDatesForWeek(week, startYear, endYear, validDates);
	const totalSongs = chartDates.size * 5;

	// Create SSE stream
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
					weeksInTop5: number;
				}[] = [];

				let cacheHits = 0;
				let apiCalls = 0;
				let processed = 0;

				// Process each year
				for (const [year, chartDate] of chartDates) {
					// Load chart data (with caching)
					const chartData = await fetchChart(url.origin, chartDate);
					if (!chartData) {
						throw new Error(`Failed to load chart for ${chartDate}`);
					}

					// Get top 5 songs
					const top5 = chartData.data.slice(0, 5);

					for (const song of top5) {
						processed++;

						let spotifyTrack: {
							uri: string;
							name: string;
							artists: string;
							album: string;
							image: string;
						} | null = null;
						let fromCache = false;

						// Check cache first
						const cached = await getFromCache(song.song, song.artist);

						if (cached) {
							spotifyTrack = cached;
							fromCache = true;
							cacheHits++;
						} else {
							// Check if we already know this song isn't on Spotify
							const notFound = await isNotFoundCached(song.song, song.artist);

							if (notFound) {
								// Previously searched, not found - skip API call
								spotifyTrack = null;
								fromCache = true;
								cacheHits++;
							} else {
								// Actually search Spotify (pass year for better matching)
								spotifyTrack = await searchTrack(accessToken!, song.song, song.artist, year);
								apiCalls++;

								if (spotifyTrack) {
									// Cache the found track
									await addToCache(song.song, song.artist, spotifyTrack);
								} else {
									// Cache the not-found result
									await cacheNotFound(song.song, song.artist);
								}

								// Small delay to avoid rate limiting (only for API calls)
								await new Promise((r) => setTimeout(r, 80));
							}
						}

						// Calculate position change and streak
						const positionChange = getPositionChange(song.this_week, song.last_week);
						const weeksInTop5 = await calculateWeeksInTop5(
							url.origin,
							song.song,
							song.artist,
							chartDate
						);

						const songEntry = {
							year,
							chartDate,
							position: song.this_week,
							original: { song: song.song, artist: song.artist },
							spotify: spotifyTrack,
							fromCache,
							lastWeekPosition: song.last_week,
							positionChange,
							weeksInTop5
						};

						allSongs.push(songEntry);

						// Send the song with progress
						send('song', { ...songEntry, progress: processed, total: totalSongs });
					}
				}

				// Find duplicates (same song appearing in multiple years)
				const songKeys = allSongs
					.filter((s) => s.spotify)
					.map((s) => s.spotify!.uri);
				const duplicateUris = songKeys.filter((uri, index) => songKeys.indexOf(uri) !== index);

				send('duplicates', { uris: [...new Set(duplicateUris)] });

				// Count stats
				const trackUris = allSongs.filter((s) => s.spotify).map((s) => s.spotify!.uri);
				const notFoundCount = allSongs.filter((s) => !s.spotify).length;

				send('complete', {
					totalSongs: allSongs.length,
					foundSongs: trackUris.length,
					notFoundCount,
					cacheHits,
					apiCalls
				});
			} catch (e) {
				console.error('Playlist generation error:', e);
				send('error', { message: e instanceof Error ? e.message : 'Unknown error' });
			} finally {
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
