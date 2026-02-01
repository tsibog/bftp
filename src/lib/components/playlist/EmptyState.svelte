<script lang="ts">
	interface Props {
		message: string;
	}

	let { message }: Props = $props();
</script>

<div class="flex h-full items-center justify-center text-muted-foreground">
	{message}
</div>
