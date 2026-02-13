<script lang="ts">
  import { Tooltip } from "$lib/components/ui";
  import type { Song } from "$lib/types";

  interface Props {
    song: Song;
    isDuplicate?: boolean;
    isPlaying?: boolean;
    animationDelay?: number;
    onplay?: (uri: string) => void;
  }

  let {
    song,
    isDuplicate = false,
    isPlaying = false,
    animationDelay = 0,
    onplay,
  }: Props = $props();

  const rowClass = $derived(
    song.spotify
      ? isDuplicate
        ? "bg-yellow-500/10"
        : "hover:bg-secondary/50"
      : "bg-red-500/10",
  );

  // Tooltip text helpers
  const positionTooltip = $derived(() => {
    if (song.positionChange === "new") {
      return song.lastWeekPosition === null
        ? "New entry to the chart this week"
        : `New to top 5 (was #${song.lastWeekPosition} last week)`;
    }
    if (song.positionChange === "up") {
      return `Moved up from #${song.lastWeekPosition}`;
    }
    if (song.positionChange === "down") {
      return `Moved down from #${song.lastWeekPosition}`;
    }
    return "Same position as last week";
  });

  const hasStreak = $derived(
    song.weeksInTop5.before > 1 || song.weeksInTop5.after > 0,
  );
  const streakTooltip = $derived(
    `${song.weeksInTop5.before} week${song.weeksInTop5.before > 1 ? "s" : ""} so far | ${song.weeksInTop5.after} more week${song.weeksInTop5.after > 1 ? "s" : ""} in top 5`,
  );
</script>

<div
  class="group flex items-center gap-1.5 rounded px-1 py-0.5 transition-colors {rowClass}"
  style="animation: fadeIn 0.15s ease-out {animationDelay}s both;"
>
  <!-- Position Badge -->
  <div
    class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold
		{song.position === 1 ? 'bg-spotify text-black' : 'bg-secondary'}"
  >
    {song.position}
  </div>

  <!-- Position Change & Streak Indicators (fixed width for alignment) -->
  <div class="flex shrink-0 items-center">
    <!-- Change indicator (fixed width) -->
    <span class="w-8 text-center">
      {#if song.positionChange === "new"}
        <Tooltip text={positionTooltip()}>
          {#snippet children()}
            <span
              class="cursor-help rounded bg-blue-500/20 px-1 py-0.5 text-[8px] font-bold text-blue-400"
            >
              NEW
            </span>
          {/snippet}
        </Tooltip>
      {:else if song.positionChange === "up"}
        <Tooltip text={positionTooltip()}>
          {#snippet children()}
            <span class="cursor-help text-[10px] text-green-500">▲</span>
          {/snippet}
        </Tooltip>
      {:else if song.positionChange === "down"}
        <Tooltip text={positionTooltip()}>
          {#snippet children()}
            <span class="cursor-help text-[10px] text-red-400">▼</span>
          {/snippet}
        </Tooltip>
      {:else}
        <Tooltip text={positionTooltip()}>
          {#snippet children()}
            <span class="cursor-help text-[10px] text-muted-foreground">―</span>
          {/snippet}
        </Tooltip>
      {/if}
    </span>

    <!-- Streak indicator -->
    <span
      class="w-[4.5rem] whitespace-nowrap text-[9px] font-medium tabular-nums tracking-tight text-muted-foreground"
    >
      {#if hasStreak}
        <Tooltip text={streakTooltip}>
          {#snippet children()}
            <span class="cursor-help"
              >◀ {song.weeksInTop5.before.toString().padStart(2, "0")} | {song.weeksInTop5.after
                .toString()
                .padStart(2, "0")} ▶</span
            >
          {/snippet}
        </Tooltip>
      {/if}
    </span>
  </div>

  <!-- Album Art -->
  {#if song.spotify?.image}
    <img src={song.spotify.image} alt="" class="h-6 w-6 shrink-0 rounded" />
  {:else}
    <div
      class="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-secondary"
    >
      <svg
        class="h-3 w-3 text-muted-foreground"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
        ></path>
      </svg>
    </div>
  {/if}

  <!-- Song Info -->
  <div class="min-w-0 flex-1">
    <div
      class="truncate text-xs font-medium"
      title={song.spotify?.name || song.original.song}
    >
      {song.spotify?.name || song.original.song}
    </div>
    <div
      class="truncate text-[10px] text-muted-foreground"
      title={song.spotify?.artists || song.original.artist}
    >
      {song.spotify?.artists || song.original.artist}
    </div>
  </div>

  <!-- Status & Actions -->
  <div class="flex shrink-0 items-center gap-0.5">
    {#if isDuplicate}
      <span
        class="rounded bg-yellow-500/20 px-1 py-0.5 text-[8px] font-medium text-yellow-500"
      >
        DUP
      </span>
    {/if}

    {#if !song.spotify}
      <span
        class="rounded bg-red-500/20 px-1 py-0.5 text-[8px] font-medium text-red-500"
      >
        N/A
      </span>
    {:else if onplay}
      <button
        onclick={() => onplay(song.spotify!.uri)}
        class="flex h-5 w-5 items-center justify-center rounded-full bg-spotify text-black
				opacity-0 transition-opacity hover:bg-spotify-dark group-hover:opacity-100
				{isPlaying ? 'opacity-100' : ''}"
        title="Play"
      >
        {#if isPlaying}
          <svg
            class="h-2.5 w-2.5 animate-pulse"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        {:else}
          <svg class="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        {/if}
      </button>
    {/if}
  </div>
</div>
