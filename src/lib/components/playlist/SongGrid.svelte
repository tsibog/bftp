<script lang="ts">
	import type { Song } from "$lib/types";
	import YearCard from "./YearCard.svelte";

	const DUPLICATE_COLORS = [
		{ bg: "bg-amber-500/10", text: "text-amber-500" },
		{ bg: "bg-violet-500/10", text: "text-violet-500" },
		{ bg: "bg-cyan-500/10", text: "text-cyan-500" },
		{ bg: "bg-rose-500/10", text: "text-rose-500" },
		{ bg: "bg-emerald-500/10", text: "text-emerald-500" },
		{ bg: "bg-sky-500/10", text: "text-sky-500" },
		{ bg: "bg-orange-500/10", text: "text-orange-500" },
		{ bg: "bg-pink-500/10", text: "text-pink-500" },
	];

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

	const duplicateColorMap = $derived(() => {
		const map: Record<string, number> = {};
		const uniqueUris = [...new Set(duplicateUris)];
		for (let i = 0; i < uniqueUris.length; i++) {
			map[uniqueUris[i]] = i % DUPLICATE_COLORS.length;
		}
		return map;
	});

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
			duplicateColorMap={duplicateColorMap()}
			duplicateColors={DUPLICATE_COLORS}
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
