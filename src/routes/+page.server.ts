import type { PageServerLoad } from './$types';
import { getYearRange, getNextWeekNumber } from '$lib/billboard';
import validDates from '$lib/data/valid_dates.json';

export const load: PageServerLoad = async ({ cookies }) => {
	// valid dates loaded via import (works in serverless)
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
