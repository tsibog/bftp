<script lang="ts">
	interface Props {
		value: number;
		currentWeek: number;
		onchange?: (week: number) => void;
		onenter?: () => void;
	}

	let { value = $bindable(), currentWeek, onchange, onenter }: Props = $props();

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		const newValue = parseInt(target.value, 10);
		if (!isNaN(newValue) && newValue >= 1 && newValue <= 52) {
			value = newValue;
			onchange?.(newValue);
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === "Enter") {
			onenter?.();
		}
	}
</script>

<div class="mb-4">
	<label for="week" class="mb-1 block text-xs text-muted-foreground">Current week: {currentWeek}</label>
	<input
		id="week"
		type="number"
		min="1"
		max="52"
		{value}
		oninput={handleInput}
		onkeydown={handleKeyDown}
		class="w-full rounded border border-input bg-background px-2 py-1.5 text-center font-mono text-lg font-bold"
	/>
</div>
