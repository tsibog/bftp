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
			// Single request — server fetches charts, calculates streaks,
			// searches Spotify, and streams everything back via SSE.
			const response = await fetch('/api/playlist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ week, yearRange }),
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
