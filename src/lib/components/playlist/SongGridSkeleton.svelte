<script lang="ts">
	interface Props {
		count?: number;
	}

	let { count = 6 }: Props = $props();
</script>

<div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
	{#each Array(count) as _, i (i)}
		<div class="rounded border border-border bg-card p-2">
			<div class="mb-1.5 border-b border-border pb-1">
				<div class="h-5 w-16 animate-pulse rounded bg-secondary"></div>
			</div>
			<div class="space-y-0.5">
				{#each Array(5) as _, j (j)}
					<div class="flex items-center gap-2 py-1">
						<div class="h-4 w-4 animate-pulse rounded bg-secondary"></div>
						<div class="flex-1 space-y-1">
							<div class="h-3 w-3/4 animate-pulse rounded bg-secondary"></div>
							<div class="h-2.5 w-1/2 animate-pulse rounded bg-secondary"></div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/each}
</div>
