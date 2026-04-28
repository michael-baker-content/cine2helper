# Cine2Helper

A companion tool for [Cine2Nerdle Battle](https://www.cinenerdle2.app/battle). Browse films by win condition and find overlaps between conditions to identify your strongest plays.

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

## Deployment (Vercel)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
3. Add environment variable: `TMDB_READ_ACCESS_TOKEN`
4. Click Deploy — Vercel auto-detects Next.js, no extra config needed

## Project structure

```
app/
  page.tsx                 # Home page (hero + win condition grid)
  api/movies/              # Film list endpoint
  api/movie-detail/        # Lazy-loaded credits for hover tooltips
  api/condition-preview/   # 3 sample posters per condition card
  api/verify-film/         # Verification tool endpoint
  verify/                  # Internal data verification UI (/verify)
components/
  MovieCard.tsx            # Film card with hover tooltip
  WinConditionPanel.tsx    # Paginated film list for a condition
  OverlapAnalyzer.tsx      # Multi-condition overlap finder
lib/
  win-conditions.ts        # All win conditions — edit labels, descriptions, displayNames here
  oscar-winners.ts         # Academy Award winners list
  decade-genre-lists.ts    # Curated sci-fi / romance / horror lists
  person-filmographies.ts  # Per-person film credits
  service-the-fans.ts      # Franchise / sequel series list
```

## Notes

- Win condition display names for group conditions (e.g. "Del Toro" vs "Toro") are set via `groupDisplayNames` in `lib/win-conditions.ts`.
- The `/verify` route is an internal tool for checking film data against TMDB — not linked from the main UI.
- Film data is served from static lists + TMDB API. No database required.

---

*Not affiliated with or endorsed by Cine2Nerdle, TMDB, or the TMDB API.*
