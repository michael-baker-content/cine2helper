// find-unreferenced-cache-films.mjs
//
// Finds films in lib/movie-cache.ts that are not referenced by any
// condition list (oscar-winners, service-the-fans, decade-genre-lists,
// or person-filmographies).
//
// Run: node scripts/find-unreferenced-cache-films.mjs
// Output: sorted by title, with runtime and genre info for context

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

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

// ── Build set of all referenced IDs ──────────────────────────────────────────

const referencedIds = new Set();

for (const id of OSCAR_WINNER_TMDB_IDS) referencedIds.add(id);
for (const id of SERVICE_THE_FANS_IDS)  referencedIds.add(id);
for (const films of Object.values(CURATED_LISTS)) {
  for (const f of films) referencedIds.add(f.tmdbId);
}
for (const person of PERSON_FILMOGRAPHIES) {
  for (const f of person.films) referencedIds.add(f.tmdbId);
}

console.error(`Referenced by condition lists: ${referencedIds.size} IDs`);
console.error(`Total in movie cache:          ${Object.keys(MOVIE_CACHE).length} IDs`);

// ── Find unreferenced films ───────────────────────────────────────────────────

const unreferenced = [];

for (const [idStr, film] of Object.entries(MOVIE_CACHE)) {
  const id = parseInt(idStr);
  if (referencedIds.has(id)) continue;

  unreferenced.push({
    tmdbId:   id,
    title:    film.title,
    year:     film.release_date?.slice(0, 4) ?? '?',
    runtime:  film.runtime ?? '?',
    genres:   film.genre_ids ?? [],
    rating:   film.vote_average ?? 0,
    language: film.original_language,
  });
}

unreferenced.sort((a, b) => a.title.localeCompare(b.title));

console.error(`Unreferenced films:            ${unreferenced.length}\n`);

// ── Output ────────────────────────────────────────────────────────────────────

console.log(`TMDB_ID\tTITLE\tYEAR\tRUNTIME\tRATING\tLANGUAGE\tGENRE_IDS`);

for (const f of unreferenced) {
  const runtime = f.runtime === '?' ? '?' : `${f.runtime}min`;
  console.log(`${f.tmdbId}\t${f.title}\t${f.year}\t${runtime}\t${f.rating}\t${f.language}\t${f.genres.join(',')}`);
}

console.error(`\nDone. Pipe to a file with: node scripts/find-unreferenced-cache-films.mjs > unreferenced.tsv`);
