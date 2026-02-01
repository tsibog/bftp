import type { PageServerLoad } from './$types';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getYearRange, getNextWeekNumber } from '$lib/billboard';

export const load: PageServerLoad = async ({ cookies }) => {
	// Load valid dates to get year range
	const validDatesPath = join(process.cwd(), 'static', 'billboard', 'valid_dates.json');
	const validDates: string[] = JSON.parse(readFileSync(validDatesPath, 'utf-8'));
	const yearRange = getYearRange(validDates);

	// Get auth status from cookies
	const accessToken = cookies.get('spotify_access_token');
	const userName = cookies.get('spotify_user_name');
	const userImage = cookies.get('spotify_user_image');

	return {
		isAuthenticated: !!accessToken,
		user: accessToken
			? {
					name: userName || 'User',
					image: userImage || null
				}
			: null,
		yearRange,
		defaultWeek: getNextWeekNumber()
	};
};
