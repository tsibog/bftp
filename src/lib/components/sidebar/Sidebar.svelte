<script lang="ts">
  import type { FetchStats, Progress, User, YearRange } from "$lib/types";
  import PlaylistControls from "./PlaylistControls.svelte";
  import Toast from "./Toast.svelte";
  import UserBadge from "./UserBadge.svelte";
  import WeekPicker from "./WeekPicker.svelte";
  import YearRangeSlider from "./YearRangeSlider.svelte";

  interface Props {
    isAuthenticated: boolean;
    user: User | null;
    week: number;
    currentWeek: number;
    yearRange: [number, number];
    yearBounds: YearRange;
    playlistName: string;
    isGenerating: boolean;
    isPreparing: boolean;
    progress: Progress;
    fetchStats: FetchStats | null;
    songsReady: boolean;
    isCreatingPlaylist: boolean;
    playlistUrl: string | null;
    trackCount: number;
    notification: string | null;
    playError: string | null;
    isOpen?: boolean;
    onlogin?: () => void;
    onlogout?: () => void;
    onweekchange?: (week: number) => void;
    onyearrangechange?: (range: [number, number]) => void;
    onfetch?: () => void;
    oncreate?: () => void;
    onopenplaylist?: () => void;
    onclose?: () => void;
  }

  let {
    isAuthenticated,
    user,
    week = $bindable(),
    currentWeek,
    yearRange = $bindable(),
    yearBounds,
    playlistName,
    isGenerating,
    isPreparing,
    progress,
    fetchStats,
    songsReady,
    isCreatingPlaylist,
    playlistUrl,
    trackCount,
    notification,
    playError,
    isOpen = false,
    onlogin,
    onlogout,
    onweekchange,
    onyearrangechange,
    onfetch,
    oncreate,
    onopenplaylist,
    onclose,
  }: Props = $props();
</script>

<!-- Mobile overlay -->
{#if isOpen}
  <button
    class="fixed inset-0 z-40 bg-black/50 md:hidden"
    onclick={onclose}
    aria-label="Close sidebar"
  ></button>
{/if}

<!-- Sidebar -->
<aside
  class="fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-border bg-card p-4
		transition-transform duration-200 ease-in-out md:static md:translate-x-0
		{isOpen ? 'translate-x-0' : '-translate-x-full'}"
>
  <!-- Header with Logo and Close Button -->
  <div class="mb-6 flex items-center justify-between">
    <h1 class="text-lg font-bold">
      <span class="text-spotify">Blast</span> from the
      <span class="text-spotify">Past</span>
    </h1>
    <!-- Mobile close button -->
    <button
      class="flex h-8 w-8 items-center justify-center rounded-md hover:bg-secondary md:hidden"
      onclick={onclose}
      aria-label="Close menu"
    >
      <svg
        class="h-5 w-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>
  </div>

  {#if isAuthenticated && user}
    <UserBadge {user} {onlogout} />
  {/if}

  <WeekPicker
    bind:value={week}
    {currentWeek}
    onchange={onweekchange}
    onenter={onfetch}
  />

  <YearRangeSlider
    bind:value={yearRange}
    min={yearBounds.min}
    max={yearBounds.max}
    onchange={onyearrangechange}
  />

  <PlaylistControls
    {isAuthenticated}
    {playlistName}
    {isGenerating}
    {isPreparing}
    {progress}
    {fetchStats}
    {songsReady}
    {isCreatingPlaylist}
    {playlistUrl}
    {trackCount}
    {onfetch}
    {oncreate}
    {onopenplaylist}
    {onlogin}
  />

  <Toast message={notification} variant="success" />
  <Toast message={playError} variant="error" />

  <div class="flex-1"></div>

  {#if typeof window !== "undefined" && window.location.hostname === "127.0.0.1"}
    <div class="mb-4 border-t border-border pt-4">
      <button
        class="w-full rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive hover:bg-destructive/20"
        onclick={async () => {
          const res = await fetch("/api/streaks", { method: "DELETE" });
          const data = await res.json();
          console.log("Cache cleared:", data);
          alert(`Streak cache cleared: ${data.deleted || 0} keys deleted`);
        }}
      >
        Clear Streak Cache
      </button>
    </div>
  {/if}

  <!-- Footer -->
  <div class="flex items-center justify-between text-xs text-muted-foreground">
    <span>Data: 1958–2026</span>
    {#if !isAuthenticated}
      <button class="text-spotify hover:underline" onclick={onlogin}>
        Login
      </button>
    {/if}
  </div>
</aside>
