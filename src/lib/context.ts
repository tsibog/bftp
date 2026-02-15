import { createContext } from 'svelte';
import type { PlaylistOperations } from './playlist-operations.svelte';
import type { User } from './types';

export interface AuthContext {
	isAuthenticated: boolean;
	user: User | null;
}

export const [getOps, setOps] = createContext<PlaylistOperations>();
export const [getAuth, setAuth] = createContext<AuthContext>();
