<script lang="ts">
	import { Button } from "$lib/components/ui";
	import type { Progress, FetchStats } from "$lib/types";

	interface Props {
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
	}

	let {
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
	<Button
		variant="secondary"
		disabled={isCreatingPlaylist}
		onclick={oncreate}
		class="mb-4"
	>
		{isCreatingPlaylist ? "Creating..." : "Create Playlist"}
	</Button>
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
