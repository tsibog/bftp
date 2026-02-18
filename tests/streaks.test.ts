import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../src/routes/api/streaks/+server';
import * as cache from '$lib/cache';
import * as billboard from '$lib/billboard';

vi.mock('$lib/cache', () => ({
	getStreaksFromCache: vi.fn(),
	cacheStreaks: vi.fn()
}));

vi.mock('$lib/billboard', () => ({
	calculateTop5Streak: vi.fn()
}));

vi.mock('$lib/data/valid_dates.json', () => ({
	default: ['2024-01-01', '2024-01-08', '2024-01-15']
}));

function createMockEvent(url: string, request: Request, fetchFn?: typeof globalThis.fetch): any {
	return {
		url: new URL(url),
		request,
		locals: {},
		params: {},
		route: { id: '/api/streaks' },
		isDataRequest: false,
		fetch: fetchFn ?? globalThis.fetch,
		getClientAddress: () => '127.0.0.1',
		requestId: 'test-request-id',
		setHeaders: () => {},
		platform: {},
		isSubRequest: false,
		tracing: { enabled: false },
		isRemoteRequest: false,
		cookies: {
			get: () => undefined,
			set: () => {},
			delete: () => {},
			serialize: () => ''
		}
	};
}

describe('GET /api/streaks', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns cached streaks when songs parameter is provided', async () => {
		const songs = [
			{ chartDate: '2024-01-01', song: 'Test Song', artist: 'Test Artist' }
		];
		const cachedStreaks = { '2024-01-01:Test Song:Test Artist': { before: 3, after: 2 } };

		vi.mocked(cache.getStreaksFromCache).mockResolvedValue(cachedStreaks);

		const url = `http://localhost/api/streaks?songs=${encodeURIComponent(JSON.stringify(songs))}`;
		const request = new Request(url);
		const response = await GET(createMockEvent(url, request));
		const data = await response.json();

		expect(data).toEqual(cachedStreaks);
		expect(cache.getStreaksFromCache).toHaveBeenCalledWith(songs);
	});

	it('returns 400 when songs parameter is missing', async () => {
		const url = 'http://localhost/api/streaks';
		const request = new Request(url);

		try {
			await GET(createMockEvent(url, request));
			expect.fail('Should have thrown');
		} catch (e: unknown) {
			expect(e).toMatchObject({ status: 400 });
		}
	});

	it('returns 400 when songs is not an array', async () => {
		const url = `http://localhost/api/streaks?songs=${encodeURIComponent(JSON.stringify({}))}`;
		const request = new Request(url);

		try {
			await GET(createMockEvent(url, request));
			expect.fail('Should have thrown');
		} catch (e: unknown) {
			expect(e).toMatchObject({ status: 400 });
		}
	});

	it('returns 400 when songs JSON is invalid', async () => {
		const url = 'http://localhost/api/streaks?songs=invalid-json';
		const request = new Request(url);

		try {
			await GET(createMockEvent(url, request));
			expect.fail('Should have thrown');
		} catch (e: unknown) {
			expect(e).toMatchObject({ status: 400 });
		}
	});

	it('filters out null values from cached streaks', async () => {
		const songs = [
			{ chartDate: '2024-01-01', song: 'Cached Song', artist: 'Artist' },
			{ chartDate: '2024-01-01', song: 'Uncached Song', artist: 'Artist' }
		];
		const cachedStreaks = {
			'2024-01-01:Cached Song:Artist': { before: 2, after: 1 },
			'2024-01-01:Uncached Song:Artist': null
		};

		vi.mocked(cache.getStreaksFromCache).mockResolvedValue(cachedStreaks);

		const url = `http://localhost/api/streaks?songs=${encodeURIComponent(JSON.stringify(songs))}`;
		const request = new Request(url);
		const response = await GET(createMockEvent(url, request));
		const data = await response.json();

		expect(data).toEqual({ '2024-01-01:Cached Song:Artist': { before: 2, after: 1 } });
	});
});

describe('POST /api/streaks', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('calculates streaks server-side and caches them', async () => {
		const songs = [
			{ chartDate: '2024-01-01', song: 'Test Song', artist: 'Test Artist' }
		];

		vi.mocked(billboard.calculateTop5Streak).mockResolvedValue({ before: 3, after: 2 });
		vi.mocked(cache.cacheStreaks).mockResolvedValue(undefined);

		const url = 'http://localhost/api/streaks';
		const request = new Request(url, {
			method: 'POST',
			body: JSON.stringify({ songs })
		});

		const mockFetch = vi.fn();
		const response = await POST(createMockEvent(url, request, mockFetch));
		const data = await response.json();

		expect(data).toEqual({
			'2024-01-01:Test Song:Test Artist': { before: 3, after: 2 }
		});
		expect(billboard.calculateTop5Streak).toHaveBeenCalledWith(
			'Test Song',
			'Test Artist',
			'2024-01-01',
			['2024-01-01', '2024-01-08', '2024-01-15'],
			expect.any(Function)
		);
		expect(cache.cacheStreaks).toHaveBeenCalledWith([
			{ chartDate: '2024-01-01', song: 'Test Song', artist: 'Test Artist', weeks: { before: 3, after: 2 } }
		]);
	});

	it('calculates streaks for multiple songs in parallel', async () => {
		const songs = [
			{ chartDate: '2024-01-01', song: 'Song A', artist: 'Artist A' },
			{ chartDate: '2024-01-01', song: 'Song B', artist: 'Artist B' }
		];

		vi.mocked(billboard.calculateTop5Streak)
			.mockResolvedValueOnce({ before: 2, after: 1 })
			.mockResolvedValueOnce({ before: 5, after: 3 });
		vi.mocked(cache.cacheStreaks).mockResolvedValue(undefined);

		const url = 'http://localhost/api/streaks';
		const request = new Request(url, {
			method: 'POST',
			body: JSON.stringify({ songs })
		});

		const mockFetch = vi.fn();
		const response = await POST(createMockEvent(url, request, mockFetch));
		const data = await response.json();

		expect(data).toEqual({
			'2024-01-01:Song A:Artist A': { before: 2, after: 1 },
			'2024-01-01:Song B:Artist B': { before: 5, after: 3 }
		});
		expect(billboard.calculateTop5Streak).toHaveBeenCalledTimes(2);
	});

	it('returns 400 when songs array is missing', async () => {
		const url = 'http://localhost/api/streaks';
		const request = new Request(url, {
			method: 'POST',
			body: JSON.stringify({})
		});

		try {
			await POST(createMockEvent(url, request));
			expect.fail('Should have thrown');
		} catch (e: unknown) {
			expect(e).toMatchObject({ status: 400 });
		}
	});

	it('returns 400 when songs is not an array', async () => {
		const url = 'http://localhost/api/streaks';
		const request = new Request(url, {
			method: 'POST',
			body: JSON.stringify({ songs: 'not-an-array' })
		});

		try {
			await POST(createMockEvent(url, request));
			expect.fail('Should have thrown');
		} catch (e: unknown) {
			expect(e).toMatchObject({ status: 400 });
		}
	});

	it('returns 400 when songs array is empty', async () => {
		const url = 'http://localhost/api/streaks';
		const request = new Request(url, {
			method: 'POST',
			body: JSON.stringify({ songs: [] })
		});

		try {
			await POST(createMockEvent(url, request));
			expect.fail('Should have thrown');
		} catch (e: unknown) {
			expect(e).toMatchObject({ status: 400 });
		}
	});
});
