// Shared types for the application

export interface SpotifyTrack {
	uri: string;
	name: string;
	artists: string;
	album: string;
	image: string;
}

export interface Song {
	year: number;
	chartDate: string;
	position: number;
	original: { song: string; artist: string };
	spotify: SpotifyTrack | null;
	fromCache: boolean;
	// Position tracking
	lastWeekPosition: number | null; // null = new entry to chart
	positionChange: 'up' | 'down' | 'same' | 'new';
	weeksInTop5: { before: number; after: number }; // consecutive weeks in top 5 (before includes current)
}

export interface FetchStats {
	cacheHits: number;
	apiCalls: number;
	notFound: number;
}

export interface Progress {
	current: number;
	total: number;
}

export interface User {
	name: string;
	image?: string | null;
}

export interface YearRange {
	min: number;
	max: number;
}
