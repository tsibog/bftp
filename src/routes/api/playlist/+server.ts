import { error } from '@sveltejs/kit';
import { searchTrack, refreshAccessToken } from '$lib/spotify';
import { getChartDatesForWeek, type BillboardChart } from '$lib/billboard';
import { getFromCache, addToCache, isNotFoundCached, cacheNotFound } from '$lib/cache';
import type { RequestHandler } from './$types';
import { readFileSync } from 'fs';
import { join } from 'path';

export const POST: RequestHandler = async ({ request, cookies }) => {
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

	// Load valid dates
	const validDatesPath = join(process.cwd(), 'static', 'billboard', 'valid_dates.json');
	const validDates: string[] = JSON.parse(readFileSync(validDatesPath, 'utf-8'));

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
				}[] = [];

				let cacheHits = 0;
				let apiCalls = 0;
				let processed = 0;

				// Process each year
				for (const [year, chartDate] of chartDates) {
					// Load chart data
					const chartPath = join(process.cwd(), 'static', 'billboard', 'date', `${chartDate}.json`);
					const chartData: BillboardChart = JSON.parse(readFileSync(chartPath, 'utf-8'));

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
								// Actually search Spotify
								spotifyTrack = await searchTrack(accessToken!, song.song, song.artist);
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

						const songEntry = {
							year,
							chartDate,
							position: song.this_week,
							original: { song: song.song, artist: song.artist },
							spotify: spotifyTrack,
							fromCache
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
