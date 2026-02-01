<script lang="ts">
	import type { Song } from "$lib/types";
	import YearCard from "./YearCard.svelte";

	interface Props {
		songs: Song[];
		duplicateUris?: string[];
		playingUri?: string | null;
		onplay?: (uri: string) => void;
	}

	let {
		songs,
		duplicateUris = [],
		playingUri = null,
		onplay,
	}: Props = $props();

	// Group songs by year
	const songsByYear = $derived(() => {
		const grouped = new Map<number, Song[]>();
		for (const song of songs) {
			if (!grouped.has(song.year)) {
				grouped.set(song.year, []);
			}
			grouped.get(song.year)!.push(song);
		}
		return grouped;
	});

	const sortedYears = $derived(
		[...songsByYear().entries()].sort((a, b) => a[0] - b[0]),
	);
</script>

<div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
	{#each sortedYears as [year, yearSongs] (year)}
		<YearCard
			{year}
			songs={yearSongs}
			{duplicateUris}
			{playingUri}
			{onplay}
		/>
	{/each}
</div>

<style>
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
