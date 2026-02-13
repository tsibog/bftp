import { error, json } from '@sveltejs/kit';

export function createAPIError(message: string, status: number = 500): never {
	throw error(status, message);
}

export function createUnauthenticatedError(): never {
	throw error(401, 'Authentication required');
}

export function createBadRequestError(message: string = 'Bad request'): never {
	throw error(400, message);
}

export function createNotFoundError(message: string = 'Not found'): never {
	throw error(404, message);
}

export { json };
