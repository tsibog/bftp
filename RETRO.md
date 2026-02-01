# Retrospective: Blast from the Past

## Issues Encountered & Fixes

### 1. Serverless File System Access (500 Error on Vercel)

**What happened:** App crashed with `ENOENT: no such file or directory` when trying to read JSON files using `readFileSync(join(process.cwd(), 'static', ...))`.

**Root cause:** On Vercel's serverless functions, `process.cwd()` returns `/var/task/` but static files aren't on the filesystem—they're served via CDN. Node.js `fs` module can't access them.

**Fix:**
- Small static data → Import directly (`import data from '$lib/data/file.json'`)
- Large static data → Fetch via HTTP from the app's own origin

### 2. Environment Variable Naming Mismatch (Caching Not Working)

**What happened:** Redis caching silently failed because env vars weren't found.

**Root cause:** Code expected `UPSTASH_REDIS_REST_URL` but Vercel KV integration creates `KV_REST_API_URL`. The code silently fell back to "caching disabled" without obvious errors.

**Fix:** Support both naming conventions:
```typescript
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
```

### 3. Naive External API Search (Wrong Songs Returned)

**What happened:** Searching for "Baby" by Justin Bieber (2010) returned "Go Baby" (2025).

**Root cause:** Spotify search used `limit: 1` and trusted the first result. Spotify ranks by "relevance" which favors newer/popular songs over exact matches.

**Fix:**
- Fetch multiple results (`limit: 10`)
- Score each result by title similarity, artist match, and year proximity
- Return the highest-scoring match

### 4. No Cache Versioning (Stale Bad Data)

**What happened:** After fixing the search logic, wrong songs were still returned because they were cached.

**Root cause:** Cache keys had no version, so old (incorrect) data persisted.

**Fix:** Add version prefix to cache keys:
```typescript
const CACHE_VERSION = 2;
return `v${CACHE_VERSION}:spotify:${song}:::${artist}`;
```

---

## Principles for Future Development

### Deployment & Infrastructure

1. **Always consider the deployment target early.** Ask: "Will this code run in serverless, edge, container, or traditional server?" File I/O, environment variables, and cold starts behave differently.

2. **Avoid `fs` module for static assets in serverless.** Use imports (bundled at build time) or HTTP fetches instead.

3. **Support multiple env var naming conventions** when integrating with platforms that auto-provision services (Vercel, Railway, etc.). Document which vars are required.

4. **Fail loudly, not silently.** Instead of `console.warn` and continuing without cache, consider throwing or returning a clear error state that surfaces in the UI.

### External API Integration

5. **Never trust the first result from a search API.** Fetch multiple results, score them against your expectations, and pick the best match.

6. **Include temporal context when searching historical data.** If you're looking for a song from 2010, use the year to filter or score results.

7. **Validate API responses match your intent.** Check that the returned song title/artist actually matches what you searched for, not just that "a result was returned."

### Caching

8. **Always version your cache keys.** When your data schema or logic changes, you need a way to invalidate stale entries.

9. **Consider cache key composition carefully.** Include all relevant dimensions (song + artist + maybe year?) to avoid collisions.

10. **Document cache TTLs and invalidation strategy.** 90 days for found tracks, 7 days for not-found—make these visible and configurable.

---

## Prompting Guidance for Future Projects

When asking an AI to build an app, include these in your prompt:

```markdown
## Deployment Context
- Deploying to: [Vercel/AWS Lambda/Docker/etc.]
- Database/cache: [Vercel KV/Upstash/Redis/etc.]
- Note any platform-specific constraints

## External API Considerations
- For search APIs: "Validate results match the query, don't just take first result"
- For historical data: "Include year/date context in searches"
- Specify rate limiting and error handling expectations

## Caching Requirements
- "Use versioned cache keys for invalidation"
- "Fail visibly if cache is misconfigured, don't silently disable"
- Specify TTLs and what triggers invalidation

## Environment Variables
- List exact names if known, or say "support common naming conventions"
- "Log which env vars are missing at startup"
```

### Example Enhanced Prompt

Instead of:
> "Build an app that creates Spotify playlists from Billboard charts"

Try:
> "Build a SvelteKit app deployed to Vercel that creates Spotify playlists from Billboard charts.
>
> - Use Vercel KV for caching (support both KV_* and UPSTASH_* env var names)
> - When searching Spotify, fetch multiple results and score by title/artist similarity AND release year proximity to the chart date
> - Version cache keys so we can invalidate after logic changes
> - Static JSON data should be imported or fetched via HTTP (no fs.readFileSync for serverless)"

---

## Summary

| Issue | Root Cause | Prevention |
|-------|-----------|------------|
| 500 on Vercel | `fs.readFileSync` in serverless | Use imports or HTTP fetch |
| Cache not working | Env var name mismatch | Support multiple conventions |
| Wrong songs | Naive first-result search | Score multiple results |
| Stale cache | No cache versioning | Version cache keys |

The common thread: **assumptions that work locally don't always work in production.** Always explicitly consider deployment environment, external API behavior, and cache lifecycle.

---

## Session 2: Additional Issues & Fixes

### 5. Vercel KV is Deprecated

**What happened:** Installed `@vercel/kv` which npm warned was deprecated.

**Root cause:** Vercel sunset their first-party KV and now recommends marketplace integrations.

**Fix:** Use `@upstash/redis` instead:
```bash
pnpm add @upstash/redis
```

### 6. Missing Node.js Type Definitions

**What happened:** `svelte-check` failed with errors like "Cannot find module 'fs'" and "Cannot find name 'process'".

**Root cause:** SvelteKit server-side code uses Node.js APIs but `@types/node` wasn't installed.

**Fix:**
```bash
pnpm add -D @types/node
```

### 7. Type Mismatch: `null` vs `undefined`

**What happened:** TypeScript error: `Type 'string | null' is not assignable to type 'string | undefined'`.

**Root cause:** Server returned `{ image: string | null }` but the shared type was `{ image?: string }`. In TypeScript, `null` ≠ `undefined`.

**Fix:** Be explicit about nullability:
```typescript
interface User {
  name: string;
  image?: string | null;  // Allow both undefined AND null
}
```

### 8. Spotify Redirect URI Rejected `localhost`

**What happened:** Spotify OAuth failed with "Invalid redirect URI" when using `localhost`.

**Root cause:** Spotify's API requires IP addresses (`127.0.0.1`) for local development, not hostnames.

**Fix:** Use `127.0.0.1` in both code and Spotify Dashboard:
```
SPOTIFY_REDIRECT_URI=http://127.0.0.1:5173/api/auth/callback
```

### 9. Custom Slider Drag Unreliable

**What happened:** Dual-range slider built with overlapping `<input type="range">` elements had inconsistent drag behavior.

**Root cause:** Browser range inputs don't reliably handle overlapping hit areas and drag state.

**Fix:** Rewrite with Pointer Events API using `setPointerCapture()`:
```typescript
function handlePointerDown(e: PointerEvent, thumb: 'min' | 'max') {
  e.preventDefault();
  dragging = thumb;
  (e.target as HTMLElement).setPointerCapture(e.pointerId);
}
```

### 10. Monolithic Component (~580 lines)

**What happened:** `+page.svelte` grew to 580 lines, becoming hard to maintain and reason about.

**Root cause:** Started with everything in one file, deferred componentization.

**Fix:** Refactored into focused components:
```
src/lib/components/
├── playlist/
│   ├── SongRow.svelte      # Single song
│   ├── YearCard.svelte     # Songs grouped by year
│   ├── SongGrid.svelte     # Grid of year cards
│   └── EmptyState.svelte
└── sidebar/
    ├── Sidebar.svelte      # Main sidebar
    ├── UserBadge.svelte
    ├── WeekPicker.svelte
    ├── YearRangeSlider.svelte
    ├── PlaylistControls.svelte
    └── Toast.svelte
```

### 11. Interactive CLI Failed in Environment

**What happened:** `npx shadcn-svelte@next init` prompts didn't work (no TTY).

**Root cause:** Non-interactive environments can't handle CLI prompts.

**Fix:** Know how to manually set up libraries:
- Install dependencies directly
- Create config files manually
- Copy component templates

---

## Updated Prompting Checklist

Add these to your initial prompt:

```markdown
## Tech Stack
- Package manager: pnpm (not npm)
- Include `@types/node` in devDependencies
- Run `svelte-check` before delivering

## Architecture
- Start with component-based architecture
- Shared types in `$lib/types.ts`
- Feature-grouped components

## Type Safety
- Align null vs undefined between server/client
- Be explicit: `string | null | undefined` if needed

## Spotify Integration (if applicable)
- Use 127.0.0.1 (not localhost) for redirect URI
- Include all OAuth scopes upfront

## Custom UI Controls
- Use Pointer Events API for drag interactions
- Use setPointerCapture() for reliable tracking
```

---

## Updated Summary Table

| Issue | Root Cause | Prevention |
|-------|-----------|------------|
| 500 on Vercel | `fs.readFileSync` in serverless | Use imports or HTTP fetch |
| Cache not working | Env var name mismatch | Support multiple conventions |
| Wrong songs | Naive first-result search | Score multiple results |
| Stale cache | No cache versioning | Version cache keys |
| **Deprecated package** | `@vercel/kv` sunset | Use `@upstash/redis` |
| **Type errors** | Missing `@types/node` | Always include for SvelteKit |
| **Type mismatch** | `null` ≠ `undefined` | Explicit nullability in types |
| **OAuth rejected** | `localhost` not allowed | Use `127.0.0.1` for Spotify |
| **Drag unreliable** | Overlapping range inputs | Use Pointer Events API |
| **Unmaintainable code** | Monolithic component | Componentize from start |
| **CLI failed** | Non-interactive env | Know manual setup fallbacks |

---

## Meta-Lesson

**Two types of issues emerged:**

1. **Platform/environment issues** (serverless fs, env vars, OAuth quirks)
   → Specify deployment target and external APIs in initial prompt

2. **Code quality issues** (types, architecture, maintainability)
   → Request `svelte-check` compliance and component architecture upfront

**The best prompt includes both the "what" and the "where":**
> "Build X using Y, **deployed to Z**, with proper typing and componentized architecture."
