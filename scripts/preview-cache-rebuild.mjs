// preview-cache-rebuild.mjs
//
// Simulates what build-movie-cache.mjs would do without making any changes.
// Shows which film IDs are currently in the cache but would be dropped
// if the cache were rebuilt from the current data files.
//
// Run: node scripts/preview-cache-rebuild.mjs
// No files are modified.

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

console.log('Loading data files...\n');

const [
  { OSCAR_WINNER_TMDB_IDS },
  { SERVICE_THE_FANS_IDS },
  { CURATED_LISTS },
  { PERSON_FILMOGRAPHIES },
  { MOVIE_CACHE },
] = await Promise.all([
  import('../lib/oscar-winners.ts'),
  import('../lib/service-the-fans.ts'),
  import('../lib/decade-genre-lists.ts'),
  import('../lib/person-filmographies.ts'),
  import('../lib/movie-cache.ts'),
]);

// ── Build the set of IDs that a cache rebuild would fetch ─────────────────────

const wouldFetch = new Set();

for (const id of OSCAR_WINNER_TMDB_IDS) wouldFetch.add(id);
for (const id of SERVICE_THE_FANS_IDS)  wouldFetch.add(id);
for (const films of Object.values(CURATED_LISTS)) {
  for (const f of films) wouldFetch.add(f.tmdbId);
}
for (const person of PERSON_FILMOGRAPHIES) {
  for (const f of person.films) wouldFetch.add(f.tmdbId);
}

// ── Compare against current cache ─────────────────────────────────────────────

const currentCacheIds = new Set(Object.keys(MOVIE_CACHE).map(Number));

const wouldBeRemoved = [...currentCacheIds].filter(id => !wouldFetch.has(id));
const wouldBeAdded   = [...wouldFetch].filter(id => !currentCacheIds.has(id));

console.log(`Current cache:          ${currentCacheIds.size} films`);
console.log(`Data files reference:   ${wouldFetch.size} unique IDs`);
console.log(`Would be removed:       ${wouldBeRemoved.length} films`);
console.log(`Would be added:         ${wouldBeAdded.length} films (need TMDB fetch)`);

// ── Detail on removals ────────────────────────────────────────────────────────

if (wouldBeRemoved.length > 0) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`Films that would be REMOVED from cache:\n`);
  console.log(`${'TMDB ID'.padEnd(10)} ${'YEAR'.padEnd(6)} ${'RUNTIME'.padEnd(9)} ${'TITLE'}`);
  console.log('─'.repeat(70));

  const sorted = wouldBeRemoved
    .map(id => ({ id, film: MOVIE_CACHE[id] }))
    .sort((a, b) => a.film.title.localeCompare(b.film.title));

  for (const { id, film } of sorted) {
    const year    = film.release_date?.slice(0, 4) ?? '?';
    const runtime = film.runtime != null ? `${film.runtime}min` : '?';
    const title   = film.title;
    console.log(`${String(id).padEnd(10)} ${year.padEnd(6)} ${runtime.padEnd(9)} ${title}`);
  }
}

// ── Detail on additions ───────────────────────────────────────────────────────

if (wouldBeAdded.length > 0) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`IDs that would be ADDED to cache (not yet fetched):\n`);
  for (const id of wouldBeAdded) {
    console.log(`  ${id}`);
  }
}

if (wouldBeRemoved.length === 0 && wouldBeAdded.length === 0) {
  console.log(`\n✓ Cache is already in sync with data files. No changes needed.`);
} else {
  console.log(`\nIf you're happy with these changes, run:`);
  console.log(`  npx tsx scripts/build-movie-cache.mjs`);
  console.log(`  npx tsx scripts/build-overlap-index.mjs`);
}

console.log('');
