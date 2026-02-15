import {
	calculateTop5Streak,
	getChartDatesForWeek,
	getPositionChange,
	type BillboardChart,
} from '$lib/billboard';
import validDates from '$lib/data/valid_dates.json';
import type { FetchStats, Progress, Song } from '$lib/types';

export class PlaylistOperations {
	songs = $state<Song[]>([]);
	duplicateUris = $state<string[]>([]);
	isGenerating = $state(false);
	isPreparing = $state(false);
	progress = $state<Progress>({ current: 0, total: 0 });
	fetchStats = $state<FetchStats | null>(null);
	songsReady = $state(false);
	isCreatingPlaylist = $state(false);
	playlistUrl = $state<string | null>(null);
	notification = $state<string | null>(null);
	playError = $state<string | null>(null);
	playingUri = $state<string | null>(null);

	get trackCount() {
		return this.songs.filter((s) => s.spotify).length;
	}

	showNotification(message: string, duration = 3000) {
		this.notification = message;
		setTimeout(() => (this.notification = null), duration);
	}

	showError(message: string, duration = 3000) {
		this.playError = message;
		setTimeout(() => (this.playError = null), duration);
	}

	openPlaylist() {
		if (this.playlistUrl) window.open(this.playlistUrl, '_blank');
	}

	async play(uri: string, isAuthenticated: boolean) {
		if (!isAuthenticated) {
			this.showError('Login to play tracks on Spotify');
			return;
		}

		this.playingUri = uri;

		try {
			const response = await fetch('/api/play', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ uri }),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to play');
			}
		} catch (e) {
			this.showError(e instanceof Error ? e.message : 'Failed to play');
		} finally {
			setTimeout(() => (this.playingUri = null), 1000);
		}
	}

	async fetchSongs(week: number, yearRange: [number, number]) {
		this.isGenerating = true;
		this.isPreparing = true;
		this.progress = { current: 0, total: 0 };
		this.songs = [];
		this.duplicateUris = [];
		this.playlistUrl = null;
		this.fetchStats = null;
		this.songsReady = false;

		try {
			const chartDates = getChartDatesForWeek(week, yearRange[0], yearRange[1], validDates);

			const chartSongs: {
				year: number;
				chartDate: string;
				song: string;
				artist: string;
				position: number;
				lastWeekPosition: number | null;
				positionChange: 'up' | 'down' | 'same' | 'new';
				weeksInTop5: { before: number; after: number };
			}[] = [];

			for (const [year, chartDate] of chartDates) {
				try {
					const res = await fetch(`/billboard/date/${chartDate}.json`);
					if (!res.ok) continue;

					const chart: BillboardChart = await res.json();
					const top5 = chart.data.slice(0, 5);

					for (const entry of top5) {
						chartSongs.push({
							year,
							chartDate,
							song: entry.song,
							artist: entry.artist,
							position: entry.this_week,
							lastWeekPosition: entry.last_week,
							positionChange: getPositionChange(entry.this_week, entry.last_week),
							weeksInTop5: { before: 1, after: 0 },
						});
					}
				} catch {
					continue;
				}
			}

			if (chartSongs.length === 0) {
				this.showError('No chart data found for the selected week and years');
				return;
			}

			const streakLookup = chartSongs.map((s) => ({
				chartDate: s.chartDate,
				song: s.song,
				artist: s.artist,
			}));

			const streakRes = await fetch(
				`/api/streaks?songs=${encodeURIComponent(JSON.stringify(streakLookup))}`
			);
			const cachedStreaks: Record<string, { before: number; after: number }> = streakRes.ok
				? await streakRes.json()
				: {};

			const streaksToCache: {
				chartDate: string;
				song: string;
				artist: string;
				weeks: { before: number; after: number };
			}[] = [];

			for (const song of chartSongs) {
				const key = `${song.chartDate}:${song.song}:${song.artist}`;
				if (cachedStreaks[key] !== undefined) {
					song.weeksInTop5 = cachedStreaks[key];
				} else {
					const weeks = await calculateTop5Streak(
						song.song,
						song.artist,
						song.chartDate,
						validDates,
						async (date) => {
							const res = await fetch(`/billboard/date/${date}.json`);
							if (!res.ok) return null;
							return res.json();
						}
					);
					song.weeksInTop5 = weeks;
					streaksToCache.push({
						chartDate: song.chartDate,
						song: song.song,
						artist: song.artist,
						weeks,
					});
				}
			}

			if (streaksToCache.length > 0) {
				await fetch('/api/streaks', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ streaks: streaksToCache }),
				});
			}

			const response = await fetch('/api/playlist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ songs: chartSongs }),
			});

			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			const reader = response.body?.getReader();
			if (!reader) throw new Error('No response body');

			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				let currentEvent = '';
				for (const line of lines) {
					if (line.startsWith('event: ')) {
						currentEvent = line.slice(7);
					} else if (line.startsWith('data: ') && currentEvent) {
						try {
							this.processSSEEvent(currentEvent, JSON.parse(line.slice(6)));
						} catch {
							// Ignore parse errors
						}
						currentEvent = '';
					}
				}
			}
		} catch (e) {
			console.error('Fetch error:', e);
			this.isPreparing = false;
			this.showError(e instanceof Error ? e.message : 'Failed to fetch songs');
		} finally {
			this.isGenerating = false;
		}
	}

	private processSSEEvent(event: string, data: unknown) {
		switch (event) {
			case 'init': {
				const { total } = data as { total: number };
				this.progress = { current: 0, total };
				this.isPreparing = false;
				break;
			}
			case 'song': {
				const songData = data as Song & { progress: number; total: number };
				this.songs = [...this.songs, songData];
				this.progress = { current: songData.progress, total: songData.total };
				break;
			}
			case 'duplicates': {
				this.duplicateUris = (data as { uris: string[] }).uris;
				break;
			}
			case 'complete': {
				const { cacheHits, apiCalls, notFoundCount } = data as {
					cacheHits: number;
					apiCalls: number;
					notFoundCount: number;
				};
				this.fetchStats = { cacheHits, apiCalls, notFound: notFoundCount };
				this.songsReady = true;
				break;
			}
		}
	}

	async createPlaylist(name: string, week: number, yearRange: [number, number]) {
		this.isCreatingPlaylist = true;

		try {
			const trackUris = this.songs.filter((s) => s.spotify).map((s) => s.spotify!.uri);

			const description = `Top 5 Billboard hits from week ${week}, years ${yearRange[0]}-${yearRange[1]}`;

			const response = await fetch('/api/playlist/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					trackUris,
					playlistName: name,
					playlistDescription: description,
				}),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to create playlist');
			}

			const result = await response.json();
			this.playlistUrl = result.playlistUrl;

			await navigator.clipboard.writeText(this.playlistUrl!);
			this.showNotification('Link copied to clipboard!');
		} catch (e) {
			this.showError(e instanceof Error ? e.message : 'Failed to create playlist');
		} finally {
			this.isCreatingPlaylist = false;
		}
	}
}
