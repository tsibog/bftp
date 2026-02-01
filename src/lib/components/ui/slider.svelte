<script lang="ts">
	import { cn } from '$lib/utils';

	interface Props {
		value: [number, number];
		min: number;
		max: number;
		step?: number;
		class?: string;
	}

	let { value = $bindable(), min, max, step = 1, class: className }: Props = $props();

	let trackRef: HTMLDivElement;
	let dragging: 'min' | 'max' | null = $state(null);

	const minPercent = $derived(((value[0] - min) / (max - min)) * 100);
	const maxPercent = $derived(((value[1] - min) / (max - min)) * 100);

	function getValueFromPosition(clientX: number): number {
		const rect = trackRef.getBoundingClientRect();
		const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
		const rawValue = min + percent * (max - min);
		return Math.round(rawValue / step) * step;
	}

	function handlePointerDown(e: PointerEvent, thumb: 'min' | 'max') {
		e.preventDefault();
		dragging = thumb;
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
	}

	function handlePointerMove(e: PointerEvent) {
		if (!dragging) return;

		const newValue = getValueFromPosition(e.clientX);

		if (dragging === 'min') {
			const clampedValue = Math.min(newValue, value[1] - step);
			value = [Math.max(min, clampedValue), value[1]];
		} else {
			const clampedValue = Math.max(newValue, value[0] + step);
			value = [value[0], Math.min(max, clampedValue)];
		}
	}

	function handlePointerUp() {
		dragging = null;
	}

	function handleTrackClick(e: MouseEvent) {
		if (dragging) return;

		const clickValue = getValueFromPosition(e.clientX);
		const distToMin = Math.abs(clickValue - value[0]);
		const distToMax = Math.abs(clickValue - value[1]);

		if (distToMin <= distToMax) {
			const clampedValue = Math.min(clickValue, value[1] - step);
			value = [Math.max(min, clampedValue), value[1]];
		} else {
			const clampedValue = Math.max(clickValue, value[0] + step);
			value = [value[0], Math.min(max, clampedValue)];
		}
	}

	function handleKeyDown(e: KeyboardEvent, thumb: 'min' | 'max') {
		let delta = 0;
		if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') delta = -step;
		if (e.key === 'ArrowRight' || e.key === 'ArrowUp') delta = step;
		if (e.key === 'PageDown') delta = -step * 10;
		if (e.key === 'PageUp') delta = step * 10;
		if (e.key === 'Home') delta = min - (thumb === 'min' ? value[0] : value[1]);
		if (e.key === 'End') delta = max - (thumb === 'min' ? value[0] : value[1]);

		if (delta === 0) return;
		e.preventDefault();

		if (thumb === 'min') {
			const newMin = Math.max(min, Math.min(value[1] - step, value[0] + delta));
			value = [newMin, value[1]];
		} else {
			const newMax = Math.min(max, Math.max(value[0] + step, value[1] + delta));
			value = [value[0], newMax];
		}
	}
</script>

<div
	class={cn('relative flex h-6 w-full touch-none select-none items-center', className)}
	role="group"
	aria-label="Range slider"
>
	<!-- Track -->
	<div
		bind:this={trackRef}
		class="relative h-2 w-full cursor-pointer rounded-full bg-secondary"
		onclick={handleTrackClick}
		role="presentation"
	>
		<!-- Selected range -->
		<div
			class="absolute h-full rounded-full bg-spotify"
			style="left: {minPercent}%; right: {100 - maxPercent}%"
		></div>
	</div>

	<!-- Min thumb -->
	<div
		class="absolute h-5 w-5 cursor-grab rounded-full border-2 border-primary bg-background shadow-md transition-shadow hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background active:cursor-grabbing"
		style="left: calc({minPercent}% - 10px)"
		role="slider"
		tabindex="0"
		aria-label="Minimum value"
		aria-valuemin={min}
		aria-valuemax={value[1] - step}
		aria-valuenow={value[0]}
		onpointerdown={(e) => handlePointerDown(e, 'min')}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerUp}
		onpointercancel={handlePointerUp}
		onkeydown={(e) => handleKeyDown(e, 'min')}
	></div>

	<!-- Max thumb -->
	<div
		class="absolute h-5 w-5 cursor-grab rounded-full border-2 border-primary bg-background shadow-md transition-shadow hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background active:cursor-grabbing"
		style="left: calc({maxPercent}% - 10px)"
		role="slider"
		tabindex="0"
		aria-label="Maximum value"
		aria-valuemin={value[0] + step}
		aria-valuemax={max}
		aria-valuenow={value[1]}
		onpointerdown={(e) => handlePointerDown(e, 'max')}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerUp}
		onpointercancel={handlePointerUp}
		onkeydown={(e) => handleKeyDown(e, 'max')}
	></div>
</div>
