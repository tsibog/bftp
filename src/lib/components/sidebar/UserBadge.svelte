<script lang="ts">
	import type { User } from "$lib/types";

	interface Props {
		user: User;
		onlogout?: () => void;
	}

	let { user, onlogout }: Props = $props();

	const initial = $derived(user.name?.charAt(0).toUpperCase() || "U");
</script>

<div class="mb-4 flex items-center gap-2">
	{#if user.image}
		<img src={user.image} alt="" class="h-6 w-6 rounded-full" />
	{:else}
		<div
			class="flex h-6 w-6 items-center justify-center rounded-full bg-spotify text-xs font-bold text-black"
		>
			{initial}
		</div>
	{/if}
	<span class="flex-1 truncate text-sm">{user.name}</span>
	{#if onlogout}
		<button
			onclick={onlogout}
			class="text-xs text-muted-foreground hover:text-foreground"
		>
			×
		</button>
	{/if}
</div>
