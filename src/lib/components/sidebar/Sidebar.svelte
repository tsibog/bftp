<script lang="ts">
	import { Button } from "$lib/components/ui";
	import type { User, YearRange, Progress, FetchStats } from "$lib/types";
	import UserBadge from "./UserBadge.svelte";
	import WeekPicker from "./WeekPicker.svelte";
	import YearRangeSlider from "./YearRangeSlider.svelte";
	import PlaylistControls from "./PlaylistControls.svelte";
	import Toast from "./Toast.svelte";

	interface Props {
		isAuthenticated: boolean;
		user: User | null;
		week: number;
		yearRange: [number, number];
		yearBounds: YearRange;
		playlistName: string;
		isGenerating: boolean;
		progress: Progress;
		fetchStats: FetchStats | null;
		songsReady: boolean;
		isCreatingPlaylist: boolean;
		playlistUrl: string | null;
		trackCount: number;
		notification: string | null;
		playError: string | null;
		onlogin?: () => void;
		onlogout?: () => void;
		onweekchange?: (week: number) => void;
		onyearrangechange?: (range: [number, number]) => void;
		onfetch?: () => void;
		oncreate?: () => void;
		onopenplaylist?: () => void;
	}

	let {
		isAuthenticated,
		user,
		week = $bindable(),
		yearRange = $bindable(),
		yearBounds,
		playlistName,
		isGenerating,
		progress,
		fetchStats,
		songsReady,
		isCreatingPlaylist,
		playlistUrl,
		trackCount,
		notification,
		playError,
		onlogin,
		onlogout,
		onweekchange,
		onyearrangechange,
		onfetch,
		oncreate,
		onopenplaylist,
	}: Props = $props();
</script>

<aside class="flex w-64 shrink-0 flex-col border-r border-border bg-card p-4">
	<!-- Logo -->
	<div class="mb-6">
		<h1 class="text-lg font-bold">
			<span class="text-spotify">Blast</span> from the
			<span class="text-spotify">Past</span>
		</h1>
	</div>

	{#if !isAuthenticated}
		<Button variant="spotify" onclick={onlogin}>
			<svg class="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
				<path
					d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"
				/>
			</svg>
			Login
		</Button>
	{:else}
		{#if user}
			<UserBadge {user} {onlogout} />
		{/if}

		<WeekPicker bind:value={week} onchange={onweekchange} onenter={onfetch} />

		<YearRangeSlider
			bind:value={yearRange}
			min={yearBounds.min}
			max={yearBounds.max}
			onchange={onyearrangechange}
		/>

		<PlaylistControls
			{playlistName}
			{isGenerating}
			{progress}
			{fetchStats}
			{songsReady}
			{isCreatingPlaylist}
			{playlistUrl}
			{trackCount}
			{onfetch}
			{oncreate}
			{onopenplaylist}
		/>

		<Toast message={notification} variant="success" />
		<Toast message={playError} variant="error" />

		<div class="flex-1"></div>

		<!-- Footer -->
		<div class="text-xs text-muted-foreground">Data: 1958–2026</div>
	{/if}
</aside>
