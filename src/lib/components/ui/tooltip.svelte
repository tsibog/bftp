<script lang="ts">
	import { Tooltip } from 'bits-ui';
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';

	interface Props {
		text: string;
		children: Snippet;
		side?: 'top' | 'bottom' | 'left' | 'right';
		class?: string;
	}

	let {
		text,
		children,
		side = 'top',
		class: className
	}: Props = $props();
</script>

<Tooltip.Root delayDuration={200}>
	<Tooltip.Trigger>
		{#snippet child({ props })}
			<span {...props}>
				{@render children()}
			</span>
		{/snippet}
	</Tooltip.Trigger>
	<Tooltip.Portal>
		<Tooltip.Content
			{side}
			sideOffset={4}
			class={cn(
				'z-50 overflow-hidden rounded-md border border-border bg-secondary px-2 py-1.5 text-xs text-secondary-foreground shadow-lg',
				className
			)}
		>
			{text}
		</Tooltip.Content>
	</Tooltip.Portal>
</Tooltip.Root>
