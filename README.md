# Cine2Helper

A companion tool for [Cine2Nerdle Battle](https://www.cinenerdle2.app/battle). Browse films by win condition and find overlaps to identify your strongest plays — or the moves to avoid when your opponent is chasing the same condition.

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
   Get a token at [themoviedb.org](https://www.themoviedb.org/settings/api) (free account, Read Access Token under API section).

4. Run the dev server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

**Testing on mobile** — if accessing the dev server from another device on your network, add its IP to `next.config.js` to suppress the cross-origin warning:
```js
allowedDevOrigins: ['192.168.x.x'],
```

## Deployment (Vercel)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
3. Add environment variable: `TMDB_READ_ACCESS_TOKEN`
4. Click Deploy — Vercel auto-detects Next.js, no extra config needed

## Project structure

```
app/
  page.tsx                 # Home page (hero + win condition grid)
  icon.svg                 # Favicon (auto-detected by Next.js)
  api/movies/              # Film list endpoint — filtering, sorting, pagination
  api/movie-detail/        # Full credits for the film info modal
  api/condition-preview/   # 3 sample posters per condition card (CDN-cached 1hr)
  api/verify-film/         # Verification tool endpoint
  verify/                  # Internal data verification UI (/verify)
components/
  MovieCard.tsx            # Film card with ⓘ info button and modal
  WinConditionPanel.tsx    # Paginated, sortable film list for a condition
  OverlapAnalyzer.tsx      # Multi-condition overlap finder with loading animation
lib/
  win-conditions.ts        # All win conditions — edit labels, descriptions, groupDisplayNames here
  oscar-winners.ts         # Academy Award winners list (422 films, 1979–2025)
  decade-genre-lists.ts    # Curated sci-fi 80s / romance 90s / horror 2000s lists
  person-filmographies.ts  # Per-person film credits for individual and group conditions
  service-the-fans.ts      # Franchise / sequel series list
scripts/
  build-filmographies.mjs          # Regenerate person-filmographies.ts from TMDB
  build-service-the-fans.mjs       # Build service-the-fans.ts via TMDB collections
  build-service-the-fans-v2.mjs    # Improved version using sequel keyword + collection position
  check-documentaries.mjs          # Flag documentaries in person filmographies
  check-genres.mjs                 # Verify TMDB genre tags on curated lists
  find-missing.mjs                 # Find films in TMDB discover not in curated lists
  find-oscar-films-by-person.mjs   # Cross-reference tracked people against Wikidata Oscar data
  find-oscar-overlaps-decade-genre.mjs  # Find Oscar winners within decade-genre lists
  audit-genre-filter.mjs           # Check what a genre filter would remove from filmographies
  lookup-ids.mjs                   # Batch TMDB ID lookup
  lookup-oscar-*.mjs               # One-off Oscar winner ID resolution scripts
```

## Notes

**Win conditions** — all conditions are defined in `lib/win-conditions.ts`. To update labels, descriptions, or the short display names shown on film cards for group conditions, edit that file directly. The `groupDisplayNames` array controls how names appear on cards (e.g. "Del Toro" rather than "Toro").

**Content filtering** — the `/api/movies` route filters out unreleased films, entries with no genre tags (live events, promos), and films with a known runtime under 60 minutes (shorts, TV specials). A `BLOCKED_IDS` set in that file handles one-off false positives that pass all other filters.

**Oscar winners** — the list in `lib/oscar-winners.ts` was built and cross-referenced using Wikidata SPARQL queries via the scripts above. Run `find-oscar-films-by-person.mjs` or `find-oscar-overlaps-decade-genre.mjs` annually after the ceremony to check for new additions.

**Season updates** — when new win conditions are added, run `build-filmographies.mjs` for new people and `build-service-the-fans-v2.mjs` if new franchise films are relevant. Re-run the Oscar scripts to catch any new overlaps.

**Verification** — the `/verify` route is an internal tool for checking film data against TMDB. Not linked from the main UI.

**No database required** — all film data is served from static TypeScript lists combined with live TMDB API calls.

---

*Not affiliated with or endorsed by Cine2Nerdle, TMDB, or the TMDB API.*
