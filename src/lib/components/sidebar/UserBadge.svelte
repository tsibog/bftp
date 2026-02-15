<script lang="ts">
	import { getAuth } from "$lib/context";

	const auth = getAuth();

	const initial = $derived(auth.user?.name?.charAt(0).toUpperCase() || "U");
</script>

{#if auth.isAuthenticated && auth.user}
	<div class="mb-4 flex items-center gap-2">
		{#if auth.user.image}
			<img src={auth.user.image} alt="" class="h-6 w-6 rounded-full" />
		{:else}
			<div
				class="flex h-6 w-6 items-center justify-center rounded-full bg-spotify text-xs font-bold text-black"
			>
				{initial}
			</div>
		{/if}
		<span class="flex-1 truncate text-sm">{auth.user.name}</span>
		<button
			onclick={() => (window.location.href = "/api/auth/logout")}
			class="text-xs text-muted-foreground hover:text-foreground"
		>
			×
		</button>
	</div>
{/if}
