<script lang="ts">
	import { Slider } from "$lib/components/ui";

	interface Props {
		value: [number, number];
		min: number;
		max: number;
		onchange?: (range: [number, number]) => void;
	}

	let { value = $bindable(), min, max, onchange }: Props = $props();

	const yearCount = $derived(value[1] - value[0] + 1);
	const songCount = $derived(yearCount * 5);
</script>

<div class="mb-4">
	<div class="mb-1 flex justify-between text-xs text-muted-foreground">
		<span>Years</span>
		<span>{yearCount}y · {songCount} songs</span>
	</div>
	<Slider bind:value {min} {max} step={1} />
	<div class="mt-1 flex justify-between text-xs">
		<span class="font-bold text-spotify">{value[0]}</span>
		<span class="font-bold text-spotify">{value[1]}</span>
	</div>
</div>
