<script lang="ts">
  import type { YearRange } from "$lib/types";
  import { getAuth, getOps } from "$lib/context";
  import PlaylistControls from "./PlaylistControls.svelte";
  import Toast from "./Toast.svelte";
  import UserBadge from "./UserBadge.svelte";
  import WeekPicker from "./WeekPicker.svelte";
  import YearRangeSlider from "./YearRangeSlider.svelte";

  interface Props {
    currentWeek: number;
    yearBounds: YearRange;
    isOpen?: boolean;
  }

  let {
    currentWeek,
    yearBounds,
    isOpen = $bindable(false),
  }: Props = $props();

  const ops = getOps();
  const auth = getAuth();

  function getRandomYearRange(min: number, max: number, minGap = 10): [number, number] {
    const maxStart = max - minGap;
    const start = Math.floor(Math.random() * (maxStart - min + 1)) + min;
    const end = start + minGap + Math.floor(Math.random() * (max - start - minGap + 1));
    return [start, end];
  }

  let week = $state(currentWeek);
  let yearRange = $state<[number, number]>(getRandomYearRange(yearBounds.min, yearBounds.max));

  const playlistName = $derived(
    `BFTP${week.toString().padStart(2, "0")}${(yearRange[0] % 100).toString().padStart(2, "0")}-${(yearRange[1] % 100).toString().padStart(2, "0")}`,
  );

  async function handleFetch() {
    await ops.fetchSongs(week, yearRange);
    if (window.innerWidth < 768) isOpen = false;
  }

  async function handleCreate() {
    await ops.createPlaylist(playlistName, week, yearRange);
  }
</script>

{#if isOpen}
  <button
    class="fixed inset-0 z-40 bg-black/50 md:hidden"
    onclick={() => (isOpen = false)}
    aria-label="Close sidebar"
  ></button>
{/if}

<aside
  class="fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-border bg-card p-4
		transition-transform duration-200 ease-in-out md:static md:translate-x-0
		{isOpen ? 'translate-x-0' : '-translate-x-full'}"
>
  <div class="mb-6 flex items-center justify-between">
    <h1 class="text-lg font-bold">
      <span class="text-spotify">Blast</span> from the
      <span class="text-spotify">Past</span>
    </h1>
    <button
      class="flex h-8 w-8 items-center justify-center rounded-md hover:bg-secondary md:hidden"
      onclick={() => (isOpen = false)}
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

  <UserBadge />

  <WeekPicker
    bind:value={week}
    {currentWeek}
    onenter={handleFetch}
  />

  <YearRangeSlider
    bind:value={yearRange}
    min={yearBounds.min}
    max={yearBounds.max}
  />

  <PlaylistControls
    {playlistName}
    onfetch={handleFetch}
    oncreate={handleCreate}
  />

  <Toast message={ops.notification} variant="success" />
  <Toast message={ops.playError} variant="error" />

  <div class="flex-1"></div>

  {#if typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mode") === "debug"}
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

  <div class="flex items-center justify-between text-xs text-muted-foreground">
    <span>Data: 1958–2026</span>
    {#if !auth.isAuthenticated}
      <button class="text-spotify hover:underline" onclick={() => (window.location.href = "/api/auth/login")}>
        Login
      </button>
    {/if}
  </div>
</aside>
