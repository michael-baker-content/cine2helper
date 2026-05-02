# Cine2Helper

A companion tool for [Cine2Nerdle Battle](https://www.cinenerdle2.app/battle). Browse films by win condition, see which other conditions each film qualifies for, and filter results by overlap to find your strongest plays.

## Setup

1. Clone the repo
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env.local` in the project root:
   ```
   TMDB_READ_ACCESS_TOKEN=your_token_here
   ```
   Get a free token at [themoviedb.org](https://www.themoviedb.org/settings/api) (Read Access Token under the API section).

4. Run the dev server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

**Testing on mobile** — if accessing the dev server from another device on your network, add its IP to `next.config.js`:
```js
allowedDevOrigins: ['192.168.x.x'],
```

## Deployment (Vercel)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
3. Add environment variable: `TMDB_READ_ACCESS_TOKEN`
4. Click Deploy — Vercel auto-detects Next.js, no extra config needed

## Data maintenance workflow

Most data is stored in static TypeScript files and pre-built caches. After any change to a data file, run the build steps in this order:

### After any data change
```bash
npx tsx scripts/build-movie-cache.mjs      # Fetch full movie data for all IDs
npx tsx scripts/build-overlap-index.mjs    # Compute win condition overlaps
```
Both generated files (`lib/movie-cache.ts` and `lib/overlap-index.ts`) must be committed alongside the data changes.

### Routine maintenance (weekly)
```bash
node scripts/check-new-releases.mjs > new-releases.txt
```
Checks all win conditions for films released in the last two weeks — new sequels, new person credits, and new decade/genre entries. Review the output and add qualifying films to the relevant data files, then run the build steps above.

### Annual — after the Oscars ceremony
```bash
node scripts/build-missing-oscar-winners.mjs > missing-oscars.txt
node scripts/sort-oscar-winners.mjs
```
`build-missing-oscar-winners.mjs` requires `oscar_films.txt` (a tab-separated export from Wikipedia's Academy Award winners list) in the project root. It finds missing feature films, excludes documentaries, and flags existing entries that should be removed. `sort-oscar-winners.mjs` re-sorts the array by year after edits.

### Season updates — when win conditions change
1. Edit `lib/win-conditions.ts` to add/update conditions
2. Run `build-filmographies.mjs` for any new person conditions
3. Run `find-all-sequels.mjs` to catch any newly relevant sequels across all sources
4. Run `find-missing-from-cache.mjs` to catch decade/genre overlaps
5. Run the full build steps above

### Expanding curated lists
```bash
node scripts/find-missing-from-cache.mjs > missing-from-cache.txt
```
Cross-references every film across all static sources against every decade condition using only the movie cache — no pagination limits. Run this after adding new filmographies or Oscar winners to catch overlapping films that qualify for decade conditions.

## Project structure

```
app/
  page.tsx                   # Single-page app shell — routing, nav, layout
  api/movies/                # Film list endpoint — filtering, sorting, pagination, overlap annotation
  api/movie-detail/          # Full credits for the film info modal
  api/condition-preview/     # 3 sample posters per condition card (CDN-cached 1hr)
  api/verify-film/           # Internal verification endpoint
  verify/                    # Internal data verification UI (/verify, not linked from main UI)

components/
  MovieCard.tsx              # Film card with overlap chips and ⓘ info modal
  WinConditionPanel.tsx      # Paginated, sortable, filterable film list for a condition
  OverlapAnalyzer.tsx        # Multi-condition overlap finder
  FeedbackModal.tsx          # User feedback form (Formspree)

lib/
  win-conditions.ts          # All win conditions — edit labels, descriptions, groupDisplayNames here
  oscar-winners.ts           # Academy Award winners (~1000 films, 1927–2025)
  decade-genre-lists.ts      # Curated sci-fi 80s / romance 90s / horror 2000s lists
  person-filmographies.ts    # Per-person film credits for individual and group conditions
  service-the-fans.ts        # Franchise / sequel series list (positions 1–5)
  movie-cache.ts             # GENERATED — full TMDBMovie objects for all IDs
  overlap-index.ts           # GENERATED — maps film ID to qualifying condition IDs

scripts/
  # ── Core build scripts (run after every data change) ──────────────────────
  build-movie-cache.mjs          # Fetches and caches all film data from TMDB
  build-overlap-index.mjs        # Computes win condition overlaps from static data

  # ── Routine maintenance ───────────────────────────────────────────────────
  check-new-releases.mjs         # Finds new releases qualifying for any win condition
  build-missing-oscar-winners.mjs # Finds missing Oscar winners, excludes documentaries
  sort-oscar-winners.mjs         # Re-sorts oscar-winners.ts by year after edits
  build-filmographies.mjs        # Regenerates person-filmographies.ts from TMDB

  # ── Data quality and expansion ────────────────────────────────────────────
  find-missing-from-cache.mjs    # Finds decade/genre gaps using movie cache (no pagination)
  find-all-sequels.mjs           # Finds sequels across all sources for Service the Fans
  find-missing-low-threshold.mjs # Discovers films below normal vote threshold for review
  check-genres.mjs               # Verifies TMDB genre tags on curated lists
  check-documentaries.mjs        # Flags documentaries in person filmographies
```

## Key notes

**Win conditions** — all conditions are defined in `lib/win-conditions.ts`. To update labels, descriptions, or the short display names shown on film cards for group conditions, edit that file directly. The `groupDisplayNames` array controls how names appear on cards (e.g. "Del Toro" rather than "Benicio Del Toro").

**Overlap chips** — each film card shows chips for other win conditions it qualifies for. Clicking a chip filters the current condition's results to films that satisfy both. The overlap data is pre-computed at build time by `build-overlap-index.mjs` and annotated onto API responses at request time.

**Content filtering** — the `/api/movies` route filters out unreleased films, documentaries (genre 99), entries with no genre tags, and films with a known runtime under 60 minutes. A `BLOCKED_IDS` set in that file handles one-off false positives.

**Performance** — all film data is served from `lib/movie-cache.ts` (pre-fetched at build time), so most condition pages require zero live TMDB calls. API responses are also cached at Vercel's CDN edge for one hour.

**Service the Fans** — only add a film series once a sequel has been released. Both the original (sequence: 1) and the sequel should be added at the same time. The `check-new-releases.mjs` script flags originals that need to be added when a new sequel is detected.

**Verification** — the `/verify` route is an internal tool for checking film data. Not linked from the main UI.

**Feedback** — user feedback is collected via a Formspree form (`components/FeedbackModal.tsx`). Submissions arrive by email and can be reviewed at formspree.io.

---

*Not affiliated with or endorsed by Cine2Nerdle, TMDB, or the TMDB API.*
