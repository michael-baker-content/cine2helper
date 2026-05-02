// find-missing-from-cache.mjs
//
// Finds films that should be in a curated decade/genre list but aren't,
// by cross-referencing every film across ALL static sources against every
// decade condition's parameters using only the movie cache.
//
// No TMDB calls, no pagination limits. Pure static data analysis.
//
// Sources checked:
//   - Person filmographies
//   - Oscar winners
//   - Service the Fans
//   - Existing curated lists (to avoid duplicates)
//
// A film qualifies for a decade condition if:
//   1. Its release_date falls within the condition's decade range
//   2. Its genre_ids includes the condition's genreId
//   3. It has a runtime >= 60 (feature film)
//   4. It is not already in that condition's curated list
//
// Run: node scripts/find-missing-from-cache.mjs
// Requires lib/movie-cache.ts and all static data files to be up to date.

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// ── Load .env.local (not needed for this script but keeps pattern consistent) ─

// ── Load static data via tsx imports ─────────────────────────────────────────

console.error('Loading static data...');

const [
  { OSCAR_WINNER_TMDB_IDS },
  { SERVICE_THE_FANS_IDS },
  { CURATED_LISTS },
  { PERSON_FILMOGRAPHIES },
  { WIN_CONDITIONS },
  { MOVIE_CACHE },
] = await Promise.all([
  import('../lib/oscar-winners.ts'),
  import('../lib/service-the-fans.ts'),
  import('../lib/decade-genre-lists.ts'),
  import('../lib/person-filmographies.ts'),
  import('../lib/win-conditions.ts'),
  import('../lib/movie-cache.ts'),
]);

// ── Build decade conditions list ──────────────────────────────────────────────

const decadeConditions = WIN_CONDITIONS.filter(
  wc => wc.category === 'decade' && wc.genreIds?.length && wc.decadeStart && wc.decadeEnd
).map(wc => ({
  id:         wc.id,
  label:      wc.label,
  genreIds:   new Set(wc.genreIds),
  dateGte:    `${wc.decadeStart}-01-01`,
  dateLte:    `${wc.decadeEnd}-12-31`,
  existing:   new Set((CURATED_LISTS[wc.id] ?? []).map(f => f.tmdbId)),
}));

console.error(`Decade conditions to check: ${decadeConditions.map(c => c.label).join(', ')}\n`);

// ── Collect all unique film IDs from all static sources ───────────────────────

const allIds = new Set();

for (const id of OSCAR_WINNER_TMDB_IDS) allIds.add(id);
for (const id of SERVICE_THE_FANS_IDS)  allIds.add(id);
for (const films of Object.values(CURATED_LISTS)) {
  for (const f of films) allIds.add(f.tmdbId);
}
for (const person of PERSON_FILMOGRAPHIES) {
  for (const f of person.films) allIds.add(f.tmdbId);
}

console.error(`Total unique IDs across all sources: ${allIds.size}`);
console.error(`Films in movie cache: ${Object.keys(MOVIE_CACHE).length}\n`);

// ── Check each film against each decade condition ─────────────────────────────

// Results: Map of conditionId -> array of qualifying films not in curated list
const missing = new Map(decadeConditions.map(c => [c.id, []]));
let notInCache = 0;

for (const id of allIds) {
  const film = MOVIE_CACHE[id];
  if (!film) {
    notInCache++;
    continue;
  }

  // Skip non-features
  if (film.runtime != null && film.runtime < 60) continue;

  // Skip films with no genre data
  if (!film.genre_ids || film.genre_ids.length === 0) continue;

  // Skip unreleased
  if (!film.release_date) continue;

  for (const cond of decadeConditions) {
    // Already in this curated list — skip
    if (cond.existing.has(id)) continue;

    // Check date range
    if (film.release_date < cond.dateGte || film.release_date > cond.dateLte) continue;

    // Check genre overlap
    const hasGenre = film.genre_ids.some(gid => cond.genreIds.has(gid));
    if (!hasGenre) continue;

    // This film qualifies — find which source(s) it came from for context
    const sources = [];
    if (OSCAR_WINNER_TMDB_IDS.includes(id))  sources.push('oscar');
    if (SERVICE_THE_FANS_IDS.includes(id))   sources.push('service-the-fans');
    for (const person of PERSON_FILMOGRAPHIES) {
      if (person.films.some(f => f.tmdbId === id)) {
        sources.push(person.conditionId);
      }
    }
    // Check if it's in another curated list (cross-decade or cross-genre)
    for (const [listId, films] of Object.entries(CURATED_LISTS)) {
      if (listId !== cond.id && films.some(f => f.tmdbId === id)) {
        sources.push(`curated:${listId}`);
      }
    }

    missing.get(cond.id).push({
      tmdbId:    id,
      title:     film.title,
      year:      parseInt(film.release_date.slice(0, 4)),
      votes:     film.vote_count,
      rating:    film.vote_average,
      genres:    film.genre_ids.join(','),
      sources:   sources.join(', '),
    });
  }
}

console.error(`Films not in cache: ${notInCache}\n`);

// ── Output ────────────────────────────────────────────────────────────────────

let grandTotal = 0;

for (const cond of decadeConditions) {
  const films = missing.get(cond.id);
  if (!films.length) {
    console.log(`\n// ${cond.label}: no missing films found`);
    continue;
  }

  // Sort by vote count descending for easy review
  films.sort((a, b) => b.votes - a.votes);
  grandTotal += films.length;

  console.log(`\n// ── ${cond.label} — ${films.length} missing films ──────────────────────────────────`);
  console.log(`// Add to CURATED_LISTS['${cond.id}'] in lib/decade-genre-lists.ts\n`);

  for (const f of films) {
    const idStr     = String(f.tmdbId).padEnd(8);
    const titleStr  = JSON.stringify(f.title).padEnd(52);
    const votesStr  = String(f.votes).padStart(5);
    const ratingStr = Number(f.rating).toFixed(1).padStart(4);
    console.log(`  { tmdbId: ${idStr}, title: ${titleStr} year: ${f.year} }, // ${votesStr} votes  ${ratingStr}★  sources: ${f.sources}`);
  }
}

console.log(`\n// Grand total missing: ${grandTotal} films across ${decadeConditions.length} conditions`);
console.error(`\nDone. ${grandTotal} total films to review across ${decadeConditions.length} conditions.`);
console.error(`After adding entries, re-run: npx tsx scripts/build-overlap-index.mjs`);
console.error(`No need to rebuild movie cache — all films are already in it.`);
