<script lang="ts">
  import {
    calculateTop5Streak,
    getChartDatesForWeek,
    getPositionChange,
    type BillboardChart,
  } from "$lib/billboard";
  import {
    EmptyState,
    SongGrid,
    SongGridSkeleton,
  } from "$lib/components/playlist";
  import { Sidebar } from "$lib/components/sidebar";
  import validDates from "$lib/data/valid_dates.json";
  import type { FetchStats, Progress, Song } from "$lib/types";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  // Extract initial values (intentionally captured once)
  const initialWeek = data.defaultWeek;

  function getRandomYearRange(
    min: number,
    max: number,
    minGap = 10,
  ): [number, number] {
    const maxStart = max - minGap;
    const start = Math.floor(Math.random() * (maxStart - min + 1)) + min;
    const end =
      start + minGap + Math.floor(Math.random() * (max - start - minGap + 1));
    return [start, end];
  }

  // ─────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────
  let week = $state(initialWeek);
  let yearRange = $state<[number, number]>(
    getRandomYearRange(data.yearRange.min, data.yearRange.max),
  );
  let songs = $state<Song[]>([]);
  let duplicateUris = $state<string[]>([]);
  let playlistUrl = $state<string | null>(null);
  let fetchStats = $state<FetchStats | null>(null);
  let progress = $state<Progress>({ current: 0, total: 0 });
  let playingUri = $state<string | null>(null);
  let notification = $state<string | null>(null);
  let playError = $state<string | null>(null);
  let isGenerating = $state(false);
  let isPreparing = $state(false);
  let isCreatingPlaylist = $state(false);
  let songsReady = $state(false);
  let sidebarOpen = $state(true);

  // ─────────────────────────────────────────────────────────────
  // Derived
  // ─────────────────────────────────────────────────────────────
  const playlistName = $derived(
    `BFTP${week.toString().padStart(2, "0")}${(yearRange[0] % 100).toString().padStart(2, "0")}-${(yearRange[1] % 100).toString().padStart(2, "0")}`,
  );

  const trackCount = $derived(songs.filter((s) => s.spotify).length);

  const emptyMessage = "Select week & years, then fetch songs";

  // ─────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────
  function handleLogin() {
    window.location.href = "/api/auth/login";
  }

  function handleLogout() {
    window.location.href = "/api/auth/logout";
  }

  function handleOpenPlaylist() {
    if (playlistUrl) window.open(playlistUrl, "_blank");
  }

  function showNotification(message: string, duration = 3000) {
    notification = message;
    setTimeout(() => (notification = null), duration);
  }

  function showError(message: string, duration = 3000) {
    playError = message;
    setTimeout(() => (playError = null), duration);
  }

  // ─────────────────────────────────────────────────────────────
  // Fetch chart data from CDN (client-side) then search Spotify (server-side)
  // ─────────────────────────────────────────────────────────────
  async function handleFetchSongs() {
    // Reset state
    isGenerating = true;
    isPreparing = true;
    progress = { current: 0, total: 0 };
    songs = [];
    duplicateUris = [];
    playlistUrl = null;
    fetchStats = null;
    songsReady = false;

    if (window.innerWidth < 768) {
      sidebarOpen = false;
    }

    try {
      // 1. Get chart dates for the requested week across years
      const chartDates = getChartDatesForWeek(
        week,
        yearRange[0],
        yearRange[1],
        validDates,
      );

      const chartSongs: {
        year: number;
        chartDate: string;
        song: string;
        artist: string;
        position: number;
        lastWeekPosition: number | null;
        positionChange: "up" | "down" | "same" | "new";
        weeksInTop5: { before: number; after: number };
      }[] = [];

      for (const [year, chartDate] of chartDates) {
        try {
          const res = await fetch(`/billboard/date/${chartDate}.json`);
          if (!res.ok) continue;

          const chart: BillboardChart = await res.json();
          const top5 = chart.data.slice(0, 5);

          for (const entry of top5) {
            chartSongs.push({
              year,
              chartDate,
              song: entry.song,
              artist: entry.artist,
              position: entry.this_week,
              lastWeekPosition: entry.last_week,
              positionChange: getPositionChange(
                entry.this_week,
                entry.last_week,
              ),
              weeksInTop5: { before: 1, after: 0 },
            });
          }
        } catch {
          // Skip years where chart data can't be loaded
          continue;
        }
      }

      if (chartSongs.length === 0) {
        showError("No chart data found for the selected week and years");
        return;
      }

      // 3. Get cached streaks from server
      const streakLookup = chartSongs.map((s) => ({
        chartDate: s.chartDate,
        song: s.song,
        artist: s.artist,
      }));

      const streakRes = await fetch(
        `/api/streaks?songs=${encodeURIComponent(JSON.stringify(streakLookup))}`,
      );
      const cachedStreaks: Record<string, { before: number; after: number }> = streakRes.ok
        ? await streakRes.json()
        : {};

      // 4. Calculate streaks for cache misses
      const streaksToCache: {
        chartDate: string;
        song: string;
        artist: string;
        weeks: { before: number; after: number };
      }[] = [];

      for (const song of chartSongs) {
        const key = `${song.chartDate}:${song.song}:${song.artist}`;
        if (cachedStreaks[key] !== undefined) {
          song.weeksInTop5 = cachedStreaks[key];
        } else {
          const weeks = await calculateTop5Streak(
            song.song,
            song.artist,
            song.chartDate,
            validDates,
            async (date) => {
              const res = await fetch(`/billboard/date/${date}.json`);
              if (!res.ok) return null;
              return res.json();
            },
          );
          song.weeksInTop5 = weeks;
          streaksToCache.push({
            chartDate: song.chartDate,
            song: song.song,
            artist: song.artist,
            weeks,
          });
        }
      }

      // 5. Cache newly calculated streaks
      if (streaksToCache.length > 0) {
        await fetch("/api/streaks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ streaks: streaksToCache }),
        });
      }

      // 6. Send songs to server for Spotify search
      const response = await fetch("/api/playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songs: chartSongs }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7);
          } else if (line.startsWith("data: ") && currentEvent) {
            try {
              processSSEEvent(currentEvent, JSON.parse(line.slice(6)));
            } catch {
              // Ignore parse errors
            }
            currentEvent = "";
          }
        }
      }
    } catch (e) {
      console.error("Fetch error:", e);
      isPreparing = false;
      showError(e instanceof Error ? e.message : "Failed to fetch songs");
    } finally {
      isGenerating = false;
    }
  }

  function processSSEEvent(event: string, data: unknown) {
    switch (event) {
      case "init": {
        const { total } = data as { total: number };
        progress = { current: 0, total };
        isPreparing = false;
        break;
      }
      case "song": {
        const songData = data as Song & { progress: number; total: number };
        songs = [...songs, songData];
        progress = { current: songData.progress, total: songData.total };
        break;
      }
      case "duplicates": {
        duplicateUris = (data as { uris: string[] }).uris;
        break;
      }
      case "complete": {
        const { cacheHits, apiCalls, notFoundCount } = data as {
          cacheHits: number;
          apiCalls: number;
          notFoundCount: number;
        };
        fetchStats = { cacheHits, apiCalls, notFound: notFoundCount };
        songsReady = true;
        break;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Create playlist
  // ─────────────────────────────────────────────────────────────
  async function handleCreatePlaylist() {
    isCreatingPlaylist = true;

    try {
      const trackUris = songs
        .filter((s) => s.spotify)
        .map((s) => s.spotify!.uri);

      const description = `Top 5 Billboard hits from week ${week}, years ${yearRange[0]}-${yearRange[1]}`;

      const response = await fetch("/api/playlist/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackUris,
          playlistName,
          playlistDescription: description,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create playlist");
      }

      const result = await response.json();
      playlistUrl = result.playlistUrl;

      // Auto-copy to clipboard
      await navigator.clipboard.writeText(playlistUrl!);
      showNotification("Link copied to clipboard!");
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to create playlist");
    } finally {
      isCreatingPlaylist = false;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Play song
  // ─────────────────────────────────────────────────────────────
  async function handlePlay(uri: string) {
    if (!data.isAuthenticated) {
      showError("Login to play tracks on Spotify");
      return;
    }

    playingUri = uri;

    try {
      const response = await fetch("/api/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uri }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to play");
      }
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to play");
    } finally {
      setTimeout(() => (playingUri = null), 1000);
    }
  }
</script>

<div class="flex h-screen bg-background">
  <Sidebar
    isAuthenticated={data.isAuthenticated}
    user={data.user}
    bind:week
    currentWeek={data.defaultWeek}
    bind:yearRange
    yearBounds={data.yearRange}
    {playlistName}
    {isGenerating}
    {isPreparing}
    {progress}
    {fetchStats}
    {songsReady}
    {isCreatingPlaylist}
    {playlistUrl}
    {trackCount}
    {notification}
    {playError}
    isOpen={sidebarOpen}
    onlogin={handleLogin}
    onlogout={handleLogout}
    onfetch={handleFetchSongs}
    oncreate={handleCreatePlaylist}
    onopenplaylist={handleOpenPlaylist}
    onclose={() => (sidebarOpen = false)}
  />

  <!-- Main content area -->
  <div class="flex flex-1 flex-col overflow-hidden">
    <!-- Mobile header with hamburger -->
    <header
      class="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4 md:hidden"
    >
      <button
        class="flex h-9 w-9 items-center justify-center rounded-md hover:bg-secondary"
        onclick={() => (sidebarOpen = true)}
        aria-label="Open menu"
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
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>
      <h1 class="text-sm font-bold">
        <span class="text-spotify">Blast</span> from the
        <span class="text-spotify">Past</span>
      </h1>
    </header>

    <main class="flex-1 overflow-auto p-4">
      {#if isPreparing}
        <SongGridSkeleton />
      {:else if songs.length > 0}
        <SongGrid {songs} {duplicateUris} {playingUri} onplay={handlePlay} />
      {:else}
        <EmptyState message={emptyMessage} />
      {/if}
    </main>
  </div>
</div>
