<script lang="ts">
  import {
    EmptyState,
    SongGrid,
    SongGridSkeleton,
  } from "$lib/components/playlist";
  import { Sidebar } from "$lib/components/sidebar";
  import { setAuth, setOps } from "$lib/context";
  import { PlaylistOperations } from "$lib/playlist-operations.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const ops = new PlaylistOperations();
  setOps(ops);
  setAuth({ isAuthenticated: data.isAuthenticated, user: data.user });

  let sidebarOpen = $state(true);
</script>

<div class="flex h-screen bg-background">
  <Sidebar
    currentWeek={data.defaultWeek}
    yearBounds={data.yearRange}
    bind:isOpen={sidebarOpen}
  />

  <div class="flex flex-1 flex-col overflow-hidden">
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
      {#if ops.isPreparing}
        <SongGridSkeleton />
      {:else if ops.songs.length > 0}
        <SongGrid
          songs={ops.songs}
          duplicateUris={ops.duplicateUris}
          playingUri={ops.playingUri}
          onplay={(uri) => ops.play(uri, data.isAuthenticated)}
        />
      {:else}
        <EmptyState message="Select week & years, then fetch songs" />
      {/if}
    </main>
  </div>
</div>
