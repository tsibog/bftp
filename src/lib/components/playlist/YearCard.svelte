<script lang="ts">
  import type { Song } from "$lib/types";
  import SongRow from "./SongRow.svelte";

  interface DuplicateColor {
    bg: string;
    text: string;
  }

  interface Props {
    year: number;
    songs: Song[];
    duplicateColorMap?: Record<string, number>;
    duplicateColors?: DuplicateColor[];
    playingUri?: string | null;
    onplay?: (uri: string) => void;
  }

  let {
    year,
    songs,
    duplicateColorMap = {},
    duplicateColors = [],
    playingUri = null,
    onplay,
  }: Props = $props();

  const sortedSongs = $derived(
    [...songs].sort((a, b) => a.position - b.position),
  );

  function getDuplicateColor(uri: string | undefined): DuplicateColor | null {
    if (!uri || !(uri in duplicateColorMap)) return null;
    return duplicateColors[duplicateColorMap[uri]] ?? null;
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
        duplicateColor={getDuplicateColor(song.spotify?.uri)}
        isPlaying={playingUri === song.spotify?.uri}
        animationDelay={i * 0.03}
        {onplay}
      />
    {/each}
  </div>
</div>
