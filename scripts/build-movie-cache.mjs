/**
 * build-movie-cache.mjs
 *
 * Fetches full TMDBMovie objects for every film ID used across all static
 * win condition lists and writes them to lib/movie-cache.ts.
 *
 * Run with:
 *   npx tsx scripts/build-movie-cache.mjs
 *
 * Requires TMDB_READ_ACCESS_TOKEN in .env.local (loaded automatically by tsx).
 *
 * Safe to re-run at any time — overwrites the previous cache file.
 * Re-run each season after updating filmographies, Oscar list, or curated lists.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// ── Load .env.local ───────────────────────────────────────────────────────────

function loadEnv() {
  try {
    const envPath = resolve(projectRoot, '.env.local');
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    console.warn('No .env.local found — relying on environment variables already set.');
  }
}

loadEnv();

// ── TMDB fetch ────────────────────────────────────────────────────────────────

const BASE_URL = 'https://api.themoviedb.org/3';

function getAuthHeader() {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  if (!token) throw new Error('TMDB_READ_ACCESS_TOKEN is not set.');
  return `Bearer ${token}`;
}

async function fetchMovieSummary(id) {
  const url = `${BASE_URL}/movie/${id}?language=en-US`;
  const res = await fetch(url, {
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    if (res.status === 404) return null; // Film removed from TMDB — skip silently
    throw new Error(`TMDB ${res.status} for movie ${id}`);
  }
  return res.json();
}

// ── Batch fetcher with rate-limit backoff ─────────────────────────────────────

const BATCH_SIZE = 40;
const DELAY_BETWEEN_BATCHES_MS = 250; // stay well within TMDB's 40 req/s limit

async function fetchAllMovies(ids) {
  const unique = [...new Set(ids)];
  const results = new Map();
  let fetched = 0;
  let skipped = 0;

  console.log(`\nFetching ${unique.length} unique film IDs from TMDB…`);

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(batch.map(fetchMovieSummary));

    for (let j = 0; j < settled.length; j++) {
      const result = settled[j];
      const id = batch[j];
      if (result.status === 'fulfilled' && result.value !== null) {
        results.set(id, result.value);
        fetched++;
      } else {
        const reason = result.status === 'rejected' ? result.reason?.message : '404 not found';
        console.warn(`  ⚠ Skipped ID ${id}: ${reason}`);
        skipped++;
      }
    }

    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(unique.length / BATCH_SIZE);
    process.stdout.write(`  Batch ${batchNum}/${totalBatches} complete (${fetched} fetched, ${skipped} skipped)\r`);

    // Pause between batches to avoid hitting rate limits
    if (i + BATCH_SIZE < unique.length) {
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES_MS));
    }
  }

  console.log(`\n✓ Done. ${fetched} films fetched, ${skipped} skipped.\n`);
  return results;
}

// ── Collect all IDs from static data files ────────────────────────────────────
//
// We import the compiled JS that tsx makes available. Because tsx runs this
// file, the TypeScript lib files are importable directly via their .ts paths.

async function collectAllIds() {
  const [
    { OSCAR_WINNER_TMDB_IDS },
    { SERVICE_THE_FANS },
    { CURATED_LISTS },
    { PERSON_FILMOGRAPHIES },
  ] = await Promise.all([
    import('../lib/oscar-winners.ts'),
    import('../lib/service-the-fans.ts'),
    import('../lib/decade-genre-lists.ts'),
    import('../lib/person-filmographies.ts'),
  ]);

  const ids = new Set();

  // Oscar winners
  for (const id of OSCAR_WINNER_TMDB_IDS) ids.add(id);
  console.log(`  Oscar winners:      ${OSCAR_WINNER_TMDB_IDS.length} IDs`);

  // Service the fans
  for (const film of SERVICE_THE_FANS) ids.add(film.tmdbId);
  console.log(`  Service the Fans:   ${SERVICE_THE_FANS.length} IDs`);

  // Curated decade/genre lists
  let curatedCount = 0;
  for (const films of Object.values(CURATED_LISTS)) {
    for (const film of films) { ids.add(film.tmdbId); curatedCount++; }
  }
  console.log(`  Curated lists:      ${curatedCount} IDs`);

  // Person filmographies
  let filmographyCount = 0;
  for (const person of PERSON_FILMOGRAPHIES) {
    for (const film of person.films) { ids.add(film.tmdbId); filmographyCount++; }
  }
  console.log(`  Filmographies:      ${filmographyCount} IDs (across ${PERSON_FILMOGRAPHIES.length} people)`);

  console.log(`  ─────────────────────────────`);
  console.log(`  Total unique IDs:   ${ids.size}`);

  return [...ids];
}

// ── Serialise a single TMDBMovie object ───────────────────────────────────────

function serialiseMovie(m) {
  // The /movie/{id} endpoint returns a `genres` array of {id, name} objects,
  // not a `genre_ids` array (that only appears on discover/search results).
  // Derive genre_ids from whichever field is populated.
  const genreIds = (m.genre_ids?.length > 0)
    ? m.genre_ids
    : (m.genres ?? []).map(g => g.id);

  const fields = [
    `id: ${m.id}`,
    `title: ${JSON.stringify(m.title)}`,
    `release_date: ${JSON.stringify(m.release_date ?? '')}`,
    `poster_path: ${m.poster_path ? JSON.stringify(m.poster_path) : 'null'}`,
    `backdrop_path: ${m.backdrop_path ? JSON.stringify(m.backdrop_path) : 'null'}`,
    `overview: ${JSON.stringify(m.overview ?? '')}`,
    `vote_average: ${m.vote_average ?? 0}`,
    `vote_count: ${m.vote_count ?? 0}`,
    `genre_ids: [${genreIds.join(', ')}]`,
    `runtime: ${m.runtime ?? 'null'}`,
    `popularity: ${m.popularity ?? 0}`,
    `original_language: ${JSON.stringify(m.original_language ?? 'en')}`,
  ];
  return `  ${m.id}: { ${fields.join(', ')} }`;
}

// ── Write lib/movie-cache.ts ──────────────────────────────────────────────────

function writeCacheFile(movieMap) {
  const outputPath = resolve(projectRoot, 'lib', 'movie-cache.ts');
  const timestamp = new Date().toISOString();
  const entries = [...movieMap.values()].map(serialiseMovie).join(',\n');

  const content = `/**
 * lib/movie-cache.ts — AUTO-GENERATED. DO NOT EDIT MANUALLY.
 *
 * Generated by scripts/build-movie-cache.mjs
 * Last updated: ${timestamp}
 *
 * Contains pre-fetched TMDBMovie objects for every film ID used across all
 * static win condition lists (Oscar winners, filmographies, curated lists,
 * Service the Fans). The API route reads from this cache instead of making
 * live TMDB calls at request time, eliminating cold-load latency.
 *
 * To regenerate:
 *   npx tsx scripts/build-movie-cache.mjs
 */

import { TMDBMovie } from '@/types/tmdb';

export const MOVIE_CACHE: Record<number, TMDBMovie> = {
${entries}
};
`;

  writeFileSync(outputPath, content, 'utf-8');
  console.log(`✓ Written to lib/movie-cache.ts (${movieMap.size} films, ${(content.length / 1024).toFixed(0)} KB)\n`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== build-movie-cache.mjs ===\n');
  console.log('Collecting IDs from static data files…');

  const ids = await collectAllIds();
  const movieMap = await fetchAllMovies(ids);
  writeCacheFile(movieMap);

  console.log('Done! Commit lib/movie-cache.ts and redeploy to Vercel.');
  console.log('The API route will now serve most conditions with zero TMDB calls.\n');
}

main().catch(err => {
  console.error('\n✗ Build failed:', err.message);
  process.exit(1);
});
