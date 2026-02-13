<script lang="ts">
  import type { Song } from "$lib/types";
  import SongRow from "./SongRow.svelte";

  interface Props {
    year: number;
    songs: Song[];
    duplicateUris?: string[];
    playingUri?: string | null;
    onplay?: (uri: string) => void;
  }

  let {
    year,
    songs,
    duplicateUris = [],
    playingUri = null,
    onplay,
  }: Props = $props();

  const sortedSongs = $derived(
    [...songs].sort((a, b) => a.position - b.position),
  );

  const chartDate = $derived(songs[0]?.chartDate);

  const formattedDate = $derived(() => {
    if (!chartDate) return "";
    const date = new Date(chartDate);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });

  function isDuplicate(uri: string | undefined): boolean {
    return uri ? duplicateUris.includes(uri) : false;
  }
</script>

<div
  class="animate-in fade-in rounded border border-border bg-card p-2"
  style="--tw-enter-opacity: 0; animation: fadeIn 0.2s ease-out forwards;"
>
  <!-- Year Header -->
  <div class="mb-1.5 flex items-baseline gap-1.5 border-b border-border pb-1">
    <span class="text-base font-bold text-spotify">{year}</span>
  </div>

  <!-- Songs -->
  <div class="space-y-0.5">
    {#each sortedSongs as song, i (song.position)}
      <SongRow
        {song}
        isDuplicate={isDuplicate(song.spotify?.uri)}
        isPlaying={playingUri === song.spotify?.uri}
        animationDelay={i * 0.03}
        {onplay}
      />
    {/each}
  </div>
</div>
