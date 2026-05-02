// build-missing-oscar-winners.mjs
//
// Three-part script:
//   1. Finds Oscar-winning films from oscar_films.txt not yet in oscar-winners.ts,
//      searches TMDB, verifies feature film status, and excludes documentaries.
//   2. Flags existing entries in OSCAR_WINNER_TMDB_IDS that are documentaries.
//   3. Flags existing entries in curated decade lists that are documentaries.
//
// Documentary = any film with TMDB genre ID 99 in its genre_ids.
// Feature film = runtime >= 60 min (or unknown) and not a documentary.
//
// Run: node scripts/build-missing-oscar-winners.mjs > missing-oscars.txt
// Requires TMDB_READ_ACCESS_TOKEN in .env.local
// Place oscar_films.txt in the project root before running.

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const DOCUMENTARY_GENRE_ID = 99;

// ── Load .env.local ───────────────────────────────────────────────────────────

function loadEnv() {
  try {
    const lines = readFileSync(resolve(projectRoot, '.env.local'), 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  } catch { /* ignore */ }
}

loadEnv();

const TOKEN = process.env.TMDB_READ_ACCESS_TOKEN;
if (!TOKEN) { console.error('No TMDB_READ_ACCESS_TOKEN set.'); process.exit(1); }

// ── Load oscar_films.txt ──────────────────────────────────────────────────────

const txtPath = resolve(projectRoot, 'oscar_films.txt');
if (!existsSync(txtPath)) {
  console.error('oscar_films.txt not found in project root.');
  process.exit(1);
}

const rawBuf = readFileSync(txtPath);
const isUtf16 = rawBuf[0] === 0xff && rawBuf[1] === 0xfe;
const text = isUtf16
  ? Buffer.from(rawBuf).toString('utf16le')
  : rawBuf.toString('utf-8');

const allFilms = text
  .split('\n')
  .map(l => l.replace(/\r/g, '').trim())
  .filter(l => l && !l.startsWith('Film') && !l.startsWith('\uFEFF'))
  .map(l => {
    const parts = l.split('\t');
    return { title: parts[0]?.trim(), year: parts[1]?.trim() };
  })
  .filter(f => f.title && f.year);

console.error(`Total films in oscar_films.txt: ${allFilms.length}`);

// ── Load static data files ────────────────────────────────────────────────────

console.error('Loading static data...');

const [
  { OSCAR_WINNER_TMDB_IDS },
  { CURATED_LISTS },
  { MOVIE_CACHE },
] = await Promise.all([
  import('../lib/oscar-winners.ts'),
  import('../lib/decade-genre-lists.ts'),
  import('../lib/movie-cache.ts'),
]);

// ── Load existing oscar-winners.ts source for title/ID matching ───────────────

const existingSource = readFileSync(
  resolve(projectRoot, 'lib', 'oscar-winners.ts'), 'utf-8'
);

const existingIds = new Set(
  [...existingSource.matchAll(/tmdbId:\s*(\d+)/g)].map(m => parseInt(m[1]))
);

const existingTitles = new Set([
  ...[...existingSource.matchAll(/title:\s*'([^']+)'/g)].map(m => m[1].toLowerCase()),
  ...[...existingSource.matchAll(/title:\s*"([^"]+)"/g)].map(m => m[1].toLowerCase()),
  ...[...existingSource.matchAll(/tmdbTitle:\s*'([^']+)'/g)].map(m => m[1].toLowerCase()),
  ...[...existingSource.matchAll(/tmdbTitle:\s*"([^"]+)"/g)].map(m => m[1].toLowerCase()),
]);

console.error(`Existing: ${existingIds.size} IDs, ${existingTitles.size} titles\n`);

// ── TMDB helpers ──────────────────────────────────────────────────────────────

const DELAY = 150;

async function tmdbGet(path, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url.toString(), {
    headers: { Authorization: 'Bearer ' + TOKEN },
  });
  if (!res.ok) return null;
  return res.json();
}

async function searchMovie(title, year) {
  const normYear = year.split('/')[0].trim();
  const withYear = await tmdbGet('/search/movie', {
    query: title, year: normYear, language: 'en-US',
  });
  if (withYear?.results?.length) return withYear.results;
  const withoutYear = await tmdbGet('/search/movie', {
    query: title, language: 'en-US',
  });
  return withoutYear?.results ?? [];
}

function normTitle(t) {
  return t.toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findBestMatch(results, title, year) {
  if (!results.length) return null;
  const normYear = year.split('/')[0].trim();
  const nt = normTitle(title);

  for (const r of results) {
    const ry = r.release_date?.slice(0, 4) ?? '';
    if ((normTitle(r.title) === nt || normTitle(r.original_title) === nt) && ry === normYear) return r;
  }
  for (const r of results) {
    const ry = parseInt(r.release_date?.slice(0, 4) ?? '0');
    const ty = parseInt(normYear);
    if ((normTitle(r.title) === nt || normTitle(r.original_title) === nt) && Math.abs(ry - ty) <= 1) return r;
  }
  for (const r of results) {
    const ry = r.release_date?.slice(0, 4) ?? '';
    if (normTitle(r.title).startsWith(nt) && ry === normYear) return r;
  }
  for (const r of results) {
    if (r.release_date?.slice(0, 4) === normYear) return r;
  }
  return results[0] ?? null;
}

function isDocumentary(genreIds) {
  return (genreIds ?? []).includes(DOCUMENTARY_GENRE_ID);
}

// Extract genre IDs from a TMDB movie detail response, which may return
// either a flat genre_ids array (search/discover) or a genres object array
// (movie detail endpoint). Check both to avoid missing documentaries.
function extractGenreIds(detail) {
  if (detail.genre_ids?.length) return detail.genre_ids;
  if (detail.genres?.length) return detail.genres.map(g => g.id);
  return [];
}

// ── Part 1: Verify existing Oscar winners for documentaries ───────────────────

console.error('Part 1: Checking existing Oscar winners for documentaries...');

const existingDocs = [];
for (const id of OSCAR_WINNER_TMDB_IDS) {
  const cached = MOVIE_CACHE[id];
  if (!cached) continue;
  if (isDocumentary(cached.genre_ids)) {
    existingDocs.push({ tmdbId: id, title: cached.title, year: cached.release_date?.slice(0, 4) });
  }
}
console.error(`  Found ${existingDocs.length} documentaries in existing Oscar winners list\n`);

// ── Part 2: Verify existing curated decade lists for documentaries ─────────────

console.error('Part 2: Checking curated decade lists for documentaries...');

const curatedDocs = [];
for (const [conditionId, films] of Object.entries(CURATED_LISTS)) {
  for (const film of films) {
    const cached = MOVIE_CACHE[film.tmdbId];
    if (!cached) continue;
    if (isDocumentary(cached.genre_ids)) {
      curatedDocs.push({
        tmdbId: film.tmdbId,
        title: cached.title,
        year: cached.release_date?.slice(0, 4),
        conditionId,
      });
    }
  }
}
console.error(`  Found ${curatedDocs.length} documentaries in curated decade lists\n`);

// ── Part 3: Find missing Oscar winners ───────────────────────────────────────

console.error('Part 3: Searching for missing Oscar-winning feature films...');

const toSearch = allFilms.filter(f => !existingTitles.has(f.title.toLowerCase()));
console.error(`  Films to search: ${toSearch.length}\n`);

const found    = [];
const docs     = [];
const shorts   = [];
const notFound = [];
const dupes    = [];

let processed = 0;

for (const film of toSearch) {
  processed++;
  if (processed % 25 === 0) {
    process.stderr.write(
      `  Progress: ${processed}/${toSearch.length} — ${found.length} features found\r`
    );
  }

  const results = await searchMovie(film.title, film.year);
  await new Promise(r => setTimeout(r, DELAY));

  if (!results.length) { notFound.push(film); continue; }

  const match = findBestMatch(results, film.title, film.year);
  if (!match) { notFound.push(film); continue; }

  if (existingIds.has(match.id)) {
    dupes.push({ ...film, tmdbId: match.id, tmdbTitle: match.title });
    continue;
  }

  const detail = await tmdbGet(`/movie/${match.id}`);
  await new Promise(r => setTimeout(r, DELAY));

  if (!detail) {
    notFound.push({ ...film, note: `detail fetch failed for ID ${match.id}` });
    continue;
  }

  const runtime     = detail.runtime ?? null;
  const genreIds    = extractGenreIds(detail);
  const releaseYear = parseInt(detail.release_date?.slice(0, 4) ?? '0');
  const normYear    = parseInt(film.year.split('/')[0]);

  if (isDocumentary(genreIds)) {
    docs.push({ tmdbId: detail.id, title: detail.title, runtime: runtime ?? '?', sourceTitle: film.title, year: film.year });
    continue;
  }

  if (runtime !== null && runtime < 60) {
    shorts.push({ tmdbId: detail.id, title: detail.title, runtime, sourceTitle: film.title, year: film.year });
    continue;
  }

  found.push({
    tmdbId:       detail.id,
    title:        film.title,
    tmdbTitle:    detail.title,
    year:         releaseYear || normYear,
    runtime:      runtime ?? '?',
    titleMismatch: normTitle(detail.title) !== normTitle(film.title),
  });
}

console.error('');
console.error(`Results: ${found.length} features, ${docs.length} docs excluded, ${shorts.length} shorts excluded, ${notFound.length} not found, ${dupes.length} already present\n`);

// ── Output ────────────────────────────────────────────────────────────────────

found.sort((a, b) => b.year - a.year || a.title.localeCompare(b.title));

// Section 1: New entries
console.log('// ════════════════════════════════════════════════════════════════════════════');
console.log('// PART 1: New Oscar-winning feature films to add to lib/oscar-winners.ts');
console.log('// ════════════════════════════════════════════════════════════════════════════');
console.log('// Entries marked [TITLE MISMATCH] had differing TMDB titles — verify before');
console.log('// committing. The tmdbTitle comment shows what TMDB returned.\n');

let lastYear = null;
for (const f of found) {
  if (f.year !== lastYear) {
    if (lastYear !== null) console.log('');
    console.log(`  // ${f.year}`);
    lastYear = f.year;
  }
  const idStr    = String(f.tmdbId).padEnd(7);
  const titleStr = JSON.stringify(f.title).padEnd(52);
  const mismatch = f.titleMismatch
    ? `   // [TITLE MISMATCH] TMDB: ${JSON.stringify(f.tmdbTitle)}`
    : '';
  console.log(`  { tmdbId: ${idStr}, title: ${titleStr} year: ${f.year} },${mismatch}`);
}
console.log(`\n// Total new entries: ${found.length}`);

// Section 2: Existing Oscar winners to remove
console.log('\n\n// ════════════════════════════════════════════════════════════════════════════');
console.log('// PART 2: Existing Oscar winners to REMOVE — documentaries (genre 99)');
console.log('// ════════════════════════════════════════════════════════════════════════════');

if (existingDocs.length === 0) {
  console.log('// None found — existing list is clean.');
} else {
  console.log('// Remove these entries from lib/oscar-winners.ts:\n');
  for (const f of existingDocs.sort((a, b) => (b.year ?? '').localeCompare(a.year ?? ''))) {
    console.log(`//   tmdbId ${String(f.tmdbId).padEnd(7)} "${f.title}" (${f.year})`);
  }
  console.log(`\n// Total to remove: ${existingDocs.length}`);
}

// Section 3: Curated decade list documentaries to remove
console.log('\n\n// ════════════════════════════════════════════════════════════════════════════');
console.log('// PART 3: Curated decade list entries to REMOVE — documentaries (genre 99)');
console.log('// ════════════════════════════════════════════════════════════════════════════');

if (curatedDocs.length === 0) {
  console.log('// None found — curated lists are clean.');
} else {
  const byCondition = {};
  for (const f of curatedDocs) {
    if (!byCondition[f.conditionId]) byCondition[f.conditionId] = [];
    byCondition[f.conditionId].push(f);
  }
  for (const [condId, films] of Object.entries(byCondition)) {
    console.log(`\n// In CURATED_LISTS['${condId}']:`);
    for (const f of films) {
      console.log(`//   tmdbId ${String(f.tmdbId).padEnd(7)} "${f.title}" (${f.year})`);
    }
  }
  console.log(`\n// Total to remove: ${curatedDocs.length}`);
}

// Section 4: Excluded entries for reference
if (docs.length || shorts.length || notFound.length) {
  console.log('\n\n// ════════════════════════════════════════════════════════════════════════════');
  console.log('// PART 4: Excluded from new entries (for reference)');
  console.log('// ════════════════════════════════════════════════════════════════════════════');
  if (docs.length) {
    console.log(`\n// Documentaries excluded (${docs.length}):`);
    for (const f of docs) console.log(`//   ${f.tmdbId}  "${f.sourceTitle}" (${f.year}) — runtime: ${f.runtime}min`);
  }
  if (shorts.length) {
    console.log(`\n// Short films excluded (${shorts.length}):`);
    for (const f of shorts) console.log(`//   ${f.tmdbId}  "${f.sourceTitle}" (${f.year}) — runtime: ${f.runtime}min`);
  }
  if (notFound.length) {
    console.log(`\n// Not found on TMDB (${notFound.length}) — may need manual lookup:`);
    for (const f of notFound) console.log(`//   "${f.title}" (${f.year})${f.note ? ' — ' + f.note : ''}`);
  }
}

console.error('\nDone. Next steps after review:');
console.error('  1. Add/remove entries in lib/oscar-winners.ts');
console.error('  2. npx tsx scripts/build-movie-cache.mjs');
console.error('  3. npx tsx scripts/build-overlap-index.mjs');
