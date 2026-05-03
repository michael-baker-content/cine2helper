// find-shortest-films.mjs
//
// Finds the shortest films (by runtime) across all win condition film sets,
// using data already in the movie cache. No TMDB calls needed.
//
// Run: node scripts/find-shortest-films.mjs
// Output: top 20 shortest films with their source condition(s)

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const [
  { WIN_CONDITIONS },
  { OSCAR_WINNER_TMDB_IDS },
  { SERVICE_THE_FANS_IDS },
  { CURATED_LISTS },
  { PERSON_FILMOGRAPHIES },
  { MOVIE_CACHE },
] = await Promise.all([
  import('../lib/win-conditions.ts'),
  import('../lib/oscar-winners.ts'),
  import('../lib/service-the-fans.ts'),
  import('../lib/decade-genre-lists.ts'),
  import('../lib/person-filmographies.ts'),
  import('../lib/movie-cache.ts'),
]);

// ── Build film → source conditions map ───────────────────────────────────────

const filmSources = new Map(); // filmId -> Set of source labels

function addSource(filmId, label) {
  if (!filmSources.has(filmId)) filmSources.set(filmId, new Set());
  filmSources.get(filmId).add(label);
}

// Oscar winners
for (const id of OSCAR_WINNER_TMDB_IDS) addSource(id, 'thank-the-academy');

// Service the fans
for (const id of SERVICE_THE_FANS_IDS) addSource(id, 'service-the-fans');

// Curated decade/genre lists
for (const [condId, films] of Object.entries(CURATED_LISTS)) {
  for (const f of films) addSource(f.tmdbId, condId);
}

// Person filmographies
for (const person of PERSON_FILMOGRAPHIES) {
  for (const f of person.films) addSource(f.tmdbId, person.conditionId);
}

// ── Find films with known short runtimes ──────────────────────────────────────

const shortFilms = [];

for (const [filmId, sources] of filmSources) {
  const cached = MOVIE_CACHE[filmId];
  if (!cached) continue;
  if (cached.runtime == null) continue; // skip unknown runtimes
  if (cached.runtime >= 70) continue;   // skip features

  shortFilms.push({
    tmdbId:   filmId,
    title:    cached.title,
    year:     cached.release_date?.slice(0, 4) ?? '?',
    runtime:  cached.runtime,
    sources:  [...sources].join(', '),
  });
}

// Sort by runtime ascending
shortFilms.sort((a, b) => a.runtime - b.runtime);

console.log(`\nFound ${shortFilms.length} films under 60 min:\n`);
console.log(`${'RUNTIME'.padStart(7)}  ${'TMDB ID'.padEnd(9)}  ${'TITLE'.padEnd(45)}  ${'YEAR'.padEnd(4)}  SOURCES`);
console.log('─'.repeat(110));

for (const f of shortFilms) {
  const runtime = `${f.runtime}min`.padStart(7);
  const id      = String(f.tmdbId).padEnd(9);
  const title   = f.title.slice(0, 44).padEnd(45);
  const year    = String(f.year).padEnd(4);
  console.log(`${runtime}  ${id}  ${title}  ${year}  ${f.sources}`);
}

console.log(`\nTo remove a film, delete its entry from the relevant data file(s) shown in SOURCES.`);
console.log(`Then re-run: npx tsx scripts/build-movie-cache.mjs && npx tsx scripts/build-overlap-index.mjs\n`);
