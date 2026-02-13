import { error } from '@sveltejs/kit';
import { searchTrack, getClientCredentialsToken } from '$lib/spotify';
import { getFromCache, addToCache, isNotFoundCached, cacheNotFound } from '$lib/cache';
import type { RequestHandler } from './$types';

interface ChartSong {
	year: number;
	chartDate: string;
	song: string;
	artist: string;
	position: number;
	lastWeekPosition: number | null;
	positionChange: 'up' | 'down' | 'same' | 'new';
	weeksInTop5: number;
}

export const POST: RequestHandler = async ({ request }) => {
	// Use Client Credentials token for search (no user login required)
	let accessToken: string;
	try {
		accessToken = await getClientCredentialsToken();
	} catch {
		throw error(500, 'Failed to obtain Spotify API token');
	}

	const body = await request.json();
	const { songs: chartSongs } = body as { songs: ChartSong[] };

	if (!chartSongs || !Array.isArray(chartSongs) || chartSongs.length === 0) {
		throw error(400, 'Missing or empty songs array');
	}

	const totalSongs = chartSongs.length;

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

					// Check cache first
					const cached = await getFromCache(chartSong.song, chartSong.artist);

					if (cached) {
						spotifyTrack = cached;
						fromCache = true;
						cacheHits++;
					} else {
						// Check if we already know this song isn't on Spotify
						const notFound = await isNotFoundCached(chartSong.song, chartSong.artist);

						if (notFound) {
							spotifyTrack = null;
							fromCache = true;
							cacheHits++;
						} else {
							// Search Spotify (pass year for better matching)
							spotifyTrack = await searchTrack(accessToken, chartSong.song, chartSong.artist, chartSong.year);
							apiCalls++;

							if (spotifyTrack) {
								await addToCache(chartSong.song, chartSong.artist, spotifyTrack);
							} else {
								await cacheNotFound(chartSong.song, chartSong.artist);
							}

							// Small delay to avoid rate limiting (only for API calls)
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
						weeksInTop5: chartSong.weeksInTop5
					};

					allSongs.push(songEntry);

					// Send the song with progress
					send('song', { ...songEntry, progress: processed, total: totalSongs });
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
