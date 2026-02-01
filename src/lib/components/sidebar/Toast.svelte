<script lang="ts">
	interface Props {
		message: string | null;
		variant?: "success" | "error";
	}

	let { message, variant = "success" }: Props = $props();

	const variantClass = $derived(
		variant === "error"
			? "bg-red-500/20 text-red-400"
			: "bg-spotify/20 text-spotify",
	);
</script>

{#if message}
	<div
		class="mb-2 rounded px-2 py-1.5 text-center text-xs {variantClass}"
		style="animation: fadeIn 0.2s ease-out;"
	>
		{message}
	</div>
{/if}

<style>
	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
</style>
