import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DELETE } from '../src/routes/api/streaks/+server';
import {
	calculateTop5Streak,
	getPreviousChartDates,
	getSameYearFutureDates,
} from '$lib/billboard';
import type { BillboardChart, ChartFetcher } from '$lib/billboard';

function createMockEvent(): any {
	return {
		url: new URL('http://localhost/api/streaks'),
		request: new Request('http://localhost/api/streaks', { method: 'DELETE' }),
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
			serialize: () => '',
		},
	};
}

vi.mock('$lib/cache', () => ({
	getRedis: vi.fn(() => null),
}));

describe('DELETE /api/streaks', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns failure when Redis is not configured', async () => {
		const response = await DELETE(createMockEvent());
		const data = await response.json();

		expect(data).toEqual({ success: false, message: 'Redis not configured' });
	});
});

describe('getPreviousChartDates', () => {
	const dates = ['2024-01-01', '2024-01-08', '2024-01-15', '2024-01-22', '2024-01-29'];

	it('returns dates before the current date in reverse order', () => {
		const result = getPreviousChartDates('2024-01-22', dates);
		expect(result).toEqual(['2024-01-15', '2024-01-08', '2024-01-01']);
	});

	it('returns empty array for the first date', () => {
		expect(getPreviousChartDates('2024-01-01', dates)).toEqual([]);
	});

	it('respects maxCount', () => {
		const result = getPreviousChartDates('2024-01-29', dates, 2);
		expect(result).toEqual(['2024-01-22', '2024-01-15']);
	});

	it('returns empty for unknown date', () => {
		expect(getPreviousChartDates('2099-01-01', dates)).toEqual([]);
	});
});

describe('getSameYearFutureDates', () => {
	const dates = ['2024-01-01', '2024-01-08', '2024-01-15', '2025-01-01'];

	it('returns future dates within the same year', () => {
		const result = getSameYearFutureDates('2024-01-01', dates);
		expect(result).toEqual(['2024-01-08', '2024-01-15']);
	});

	it('stops at year boundary', () => {
		const result = getSameYearFutureDates('2024-01-15', dates);
		expect(result).toEqual([]);
	});

	it('returns empty for last date', () => {
		expect(getSameYearFutureDates('2025-01-01', dates)).toEqual([]);
	});
});

describe('calculateTop5Streak', () => {
	const validDates = [
		'2024-01-01',
		'2024-01-08',
		'2024-01-15',
		'2024-01-22',
		'2024-01-29',
	];

	function makeChart(date: string, top5: { song: string; artist: string }[]): BillboardChart {
		return {
			date,
			data: top5.map((s, i) => ({
				song: s.song,
				artist: s.artist,
				this_week: i + 1,
				last_week: null,
				peak_position: i + 1,
				weeks_on_chart: 1,
			})),
		};
	}

	it('returns {before: 1, after: 0} when song only appears on current date', async () => {
		const fetchChart: ChartFetcher = vi.fn(async (date) => {
			// Neighboring charts don't have the song
			return makeChart(date, [
				{ song: 'Other', artist: 'Other' },
			]);
		});

		const result = await calculateTop5Streak(
			'My Song',
			'My Artist',
			'2024-01-15',
			validDates,
			fetchChart
		);

		expect(result).toEqual({ before: 1, after: 0 });
	});

	it('counts consecutive weeks before current date', async () => {
		const songInChart = { song: 'Hit Song', artist: 'Star' };

		const fetchChart: ChartFetcher = vi.fn(async (date) => {
			if (date === '2024-01-08' || date === '2024-01-01') {
				return makeChart(date, [songInChart]);
			}
			return makeChart(date, [{ song: 'Other', artist: 'Other' }]);
		});

		const result = await calculateTop5Streak(
			'Hit Song',
			'Star',
			'2024-01-15',
			validDates,
			fetchChart
		);

		// before = 2 previous weeks + 1 (current) = 3
		expect(result.before).toBe(3);
	});

	it('counts consecutive weeks after current date within same year', async () => {
		const songInChart = { song: 'Hit Song', artist: 'Star' };

		const fetchChart: ChartFetcher = vi.fn(async (date) => {
			if (date === '2024-01-22' || date === '2024-01-29') {
				return makeChart(date, [songInChart]);
			}
			return makeChart(date, [{ song: 'Other', artist: 'Other' }]);
		});

		const result = await calculateTop5Streak(
			'Hit Song',
			'Star',
			'2024-01-15',
			validDates,
			fetchChart
		);

		expect(result.after).toBe(2);
	});

	it('stops counting when chart fetch fails', async () => {
		const fetchChart: ChartFetcher = vi.fn(async () => null);

		const result = await calculateTop5Streak(
			'Hit Song',
			'Star',
			'2024-01-15',
			validDates,
			fetchChart
		);

		expect(result).toEqual({ before: 1, after: 0 });
	});
});
