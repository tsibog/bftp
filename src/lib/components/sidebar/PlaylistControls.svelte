<script lang="ts">
	import { Button } from "$lib/components/ui";
	import { getAuth, getOps } from "$lib/context";

	interface Props {
		playlistName: string;
		onfetch?: () => void;
		oncreate?: () => void;
	}

	let { playlistName, onfetch, oncreate }: Props = $props();

	const ops = getOps();
	const auth = getAuth();
</script>

<div
	class="mb-4 rounded bg-secondary/50 px-2 py-1.5 text-center font-mono text-sm font-bold text-spotify"
>
	{playlistName}
</div>

<Button
	variant="spotify"
	disabled={ops.isGenerating || ops.isPreparing}
	onclick={onfetch}
	class="mb-2"
>
	{#if ops.isPreparing}
		<svg class="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<circle cx="12" cy="12" r="10" stroke-opacity="0.25" />
			<path d="M12 2a10 10 0 0 1 10 10" />
		</svg>
		Preparing…
	{:else if ops.isGenerating}
		<span class="font-mono">{ops.progress.current}/{ops.progress.total}</span>
	{:else}
		Fetch Songs
	{/if}
</Button>

{#if ops.fetchStats && !ops.playlistUrl}
	<div class="mb-2 text-center text-[10px] text-muted-foreground">
		{ops.fetchStats.cacheHits}⚡ {ops.fetchStats.apiCalls}🔍
		{#if ops.fetchStats.notFound}
			<span class="text-yellow-500">{ops.fetchStats.notFound}✗</span>
		{/if}
	</div>
{/if}

{#if ops.songsReady && !ops.playlistUrl}
	{#if auth.isAuthenticated}
		<Button
			variant="secondary"
			disabled={ops.isCreatingPlaylist}
			onclick={oncreate}
			class="mb-4"
		>
			{ops.isCreatingPlaylist ? "Creating..." : "Create Playlist"}
		</Button>
	{:else}
		<Button
			variant="spotify"
			onclick={() => (window.location.href = "/api/auth/login")}
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

{#if ops.playlistUrl}
	<div class="mb-4 rounded border border-spotify/50 bg-spotify/10 p-2 text-xs">
		<div class="mb-1 flex items-center justify-between">
			<span class="font-medium text-spotify">Created!</span>
			<span class="text-muted-foreground">{ops.trackCount} tracks</span>
		</div>
		<Button
			variant="spotify"
			size="sm"
			class="w-full text-xs"
			onclick={() => ops.openPlaylist()}
		>
			Open in Spotify
		</Button>
	</div>
{/if}
