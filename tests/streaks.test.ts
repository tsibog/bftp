import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../src/routes/api/streaks/+server';
import * as cache from '$lib/cache';

vi.mock('$lib/cache', () => ({
	getStreaksFromCache: vi.fn(),
	cacheStreaks: vi.fn()
}));

function createMockEvent(url: string, request: Request): any {
	return {
		url: new URL(url),
		request,
		locals: {},
		params: {},
		route: { id: '/api/streaks' },
		isDataRequest: false,
		fetch: globalThis.fetch,
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

	it('caches streaks successfully', async () => {
		const streaks = [
			{ chartDate: '2024-01-01', song: 'Test Song', artist: 'Test Artist', weeks: { before: 3, after: 2 } }
		];
		
		vi.mocked(cache.cacheStreaks).mockResolvedValue(undefined);

		const url = 'http://localhost/api/streaks';
		const request = new Request(url, {
			method: 'POST',
			body: JSON.stringify({ streaks })
		});
		
		const response = await POST(createMockEvent(url, request));
		const data = await response.json();

		expect(data).toEqual({ success: true });
		expect(cache.cacheStreaks).toHaveBeenCalledWith(streaks);
	});

	it('returns 400 when streaks array is missing', async () => {
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

	it('returns 400 when streaks is not an array', async () => {
		const url = 'http://localhost/api/streaks';
		const request = new Request(url, {
			method: 'POST',
			body: JSON.stringify({ streaks: 'not-an-array' })
		});
		
		try {
			await POST(createMockEvent(url, request));
			expect.fail('Should have thrown');
		} catch (e: unknown) {
			expect(e).toMatchObject({ status: 400 });
		}
	});

	it('returns 400 when streaks array is empty', async () => {
		const url = 'http://localhost/api/streaks';
		const request = new Request(url, {
			method: 'POST',
			body: JSON.stringify({ streaks: [] })
		});
		
		try {
			await POST(createMockEvent(url, request));
			expect.fail('Should have thrown');
		} catch (e: unknown) {
			expect(e).toMatchObject({ status: 400 });
		}
	});
});
