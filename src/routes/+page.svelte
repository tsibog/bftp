<script lang="ts">
  import type { PageData } from "./$types";
  import type { Song, FetchStats, Progress } from "$lib/types";
  import { Sidebar } from "$lib/components/sidebar";
  import { SongGrid, EmptyState } from "$lib/components/playlist";

  let { data }: { data: PageData } = $props();

  // Extract initial values (intentionally captured once)
  const initialWeek = data.defaultWeek;

  // ─────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────
  let week = $state(initialWeek);
  let yearRange = $state<[number, number]>([1969, 2020]);
  let songs = $state<Song[]>([]);
  let duplicateUris = $state<string[]>([]);
  let playlistUrl = $state<string | null>(null);
  let fetchStats = $state<FetchStats | null>(null);
  let progress = $state<Progress>({ current: 0, total: 0 });
  let playingUri = $state<string | null>(null);
  let notification = $state<string | null>(null);
  let playError = $state<string | null>(null);
  let isGenerating = $state(false);
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

  const emptyMessage = $derived(
    data.isAuthenticated
      ? "Select week & years, then generate"
      : "Login to get started",
  );

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
  // Fetch songs via SSE
  // ─────────────────────────────────────────────────────────────
  async function handleFetchSongs() {
    // Reset state
    isGenerating = true;
    progress = { current: 0, total: 0 };
    songs = [];
    duplicateUris = [];
    playlistUrl = null;
    fetchStats = null;
    songsReady = false;

    try {
      const response = await fetch("/api/playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week,
          startYear: yearRange[0],
          endYear: yearRange[1],
        }),
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
      showError(e instanceof Error ? e.message : "Failed to fetch songs");
    } finally {
      isGenerating = false;
      sidebarOpen = false;
    }
  }

  function processSSEEvent(event: string, data: unknown) {
    switch (event) {
      case "init": {
        const { total } = data as { total: number };
        progress = { current: 0, total };
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
    bind:yearRange
    yearBounds={data.yearRange}
    {playlistName}
    {isGenerating}
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
      {#if songs.length > 0}
        <SongGrid {songs} {duplicateUris} {playingUri} onplay={handlePlay} />
      {:else}
        <EmptyState message={emptyMessage} />
      {/if}
    </main>
  </div>
</div>
