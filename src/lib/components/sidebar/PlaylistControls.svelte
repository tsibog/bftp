<script lang="ts">
	import { Button } from "$lib/components/ui";
	import type { Progress, FetchStats } from "$lib/types";

	interface Props {
		isAuthenticated: boolean;
		playlistName: string;
		isGenerating: boolean;
		progress: Progress;
		fetchStats: FetchStats | null;
		songsReady: boolean;
		isCreatingPlaylist: boolean;
		playlistUrl: string | null;
		trackCount: number;
		onfetch?: () => void;
		oncreate?: () => void;
		onopenplaylist?: () => void;
		onlogin?: () => void;
	}

	let {
		isAuthenticated,
		playlistName,
		isGenerating,
		progress,
		fetchStats,
		songsReady,
		isCreatingPlaylist,
		playlistUrl,
		trackCount,
		onfetch,
		oncreate,
		onopenplaylist,
		onlogin,
	}: Props = $props();
</script>

<!-- Playlist Name Preview -->
<div
	class="mb-4 rounded bg-secondary/50 px-2 py-1.5 text-center font-mono text-sm font-bold text-spotify"
>
	{playlistName}
</div>

<!-- Fetch Songs Button -->
<Button
	variant="spotify"
	disabled={isGenerating}
	onclick={onfetch}
	class="mb-2"
>
	{#if isGenerating}
		<span class="font-mono">{progress.current}/{progress.total}</span>
	{:else}
		Fetch Songs
	{/if}
</Button>

<!-- Fetch Stats -->
{#if fetchStats && !playlistUrl}
	<div class="mb-2 text-center text-[10px] text-muted-foreground">
		{fetchStats.cacheHits}⚡ {fetchStats.apiCalls}🔍
		{#if fetchStats.notFound}
			<span class="text-yellow-500">{fetchStats.notFound}✗</span>
		{/if}
	</div>
{/if}

<!-- Create Playlist Button -->
{#if songsReady && !playlistUrl}
	{#if isAuthenticated}
		<Button
			variant="secondary"
			disabled={isCreatingPlaylist}
			onclick={oncreate}
			class="mb-4"
		>
			{isCreatingPlaylist ? "Creating..." : "Create Playlist"}
		</Button>
	{:else}
		<Button
			variant="spotify"
			onclick={onlogin}
			class="mb-4"
		>
			<svg class="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
				<path
					d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"
				/>
			</svg>
			Login to Create Playlist
		</Button>
	{/if}
{/if}

<!-- Playlist Created Result -->
{#if playlistUrl}
	<div class="mb-4 rounded border border-spotify/50 bg-spotify/10 p-2 text-xs">
		<div class="mb-1 flex items-center justify-between">
			<span class="font-medium text-spotify">Created!</span>
			<span class="text-muted-foreground">{trackCount} tracks</span>
		</div>
		<Button
			variant="spotify"
			size="sm"
			class="w-full text-xs"
			onclick={onopenplaylist}
		>
			Open in Spotify
		</Button>
	</div>
{/if}
