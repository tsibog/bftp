<script lang="ts">
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'spotify';
		size?: 'default' | 'sm' | 'lg' | 'icon';
		children: Snippet;
		class?: string;
	}

	let {
		variant = 'default',
		size = 'default',
		children,
		class: className,
		disabled,
		...restProps
	}: Props = $props();

	const variants = {
		default: 'bg-primary text-primary-foreground hover:bg-primary/90',
		secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
		outline: 'border border-border bg-transparent hover:bg-accent hover:text-accent-foreground',
		ghost: 'hover:bg-accent hover:text-accent-foreground',
		destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
		spotify: 'bg-spotify text-black font-semibold hover:bg-spotify-dark'
	};

	const sizes = {
		default: 'h-10 px-4 py-2',
		sm: 'h-9 px-3 text-sm',
		lg: 'h-11 px-8 text-lg',
		icon: 'h-10 w-10'
	};
</script>

<button
	class={cn(
		'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
		variants[variant],
		sizes[size],
		className
	)}
	{disabled}
	{...restProps}
>
	{@render children()}
</button>
