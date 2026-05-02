// check-new-releases.mjs
//
// Finds films released in the last two weeks that qualify for any win condition.
// Run this routinely (e.g. weekly) to keep data files current.
//
// Covers four phases:
//   Phase 1 — Curated decade/genre lists (TMDB discover)
//   Phase 2 — Service the Fans (new films in known collections, positions 1-5)
//   Phase 3 — Person filmographies (individual conditions)
//   Phase 4 — Group conditions (Join the Revolution, Sing the Blues, etc.)
//
// Oscar winners are excluded — those are updated manually once per year.
//
// Output: paste-ready entries grouped by condition, stdout
// Progress: stderr
//
// Run: node scripts/check-new-releases.mjs
// Capture: node scripts/check-new-releases.mjs > new-releases.txt
// Requires TMDB_READ_ACCESS_TOKEN in .env.local

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

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

// ── Date helpers ──────────────────────────────────────────────────────────────

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const TODAY     = new Date().toISOString().slice(0, 10);
const TWO_WEEKS = daysAgo(14);

console.error(`Checking for new releases between ${TWO_WEEKS} and ${TODAY}\n`);

// ── Load static data ──────────────────────────────────────────────────────────

console.error('Loading static data...');

const [
  { WIN_CONDITIONS },
  { SERVICE_THE_FANS, SERVICE_THE_FANS_IDS },
  { CURATED_LISTS },
  { FILMOGRAPHY_MAP, PERSON_FILMOGRAPHIES },
  { MOVIE_CACHE },
] = await Promise.all([
  import('../lib/win-conditions.ts'),
  import('../lib/service-the-fans.ts'),
  import('../lib/decade-genre-lists.ts'),
  import('../lib/person-filmographies.ts'),
  import('../lib/movie-cache.ts'),
]);

// Build existing ID sets for quick lookup
const existingServiceIds  = new Set(SERVICE_THE_FANS_IDS);

// Track originals that need to be added when a sequel is detected
// Map of collectionId -> { originalId, originalTitle, originalYear, colName }
const originalsToAdd = new Map();
const existingCuratedIds  = {};
for (const [id, films] of Object.entries(CURATED_LISTS)) {
  existingCuratedIds[id] = new Set(films.map(f => f.tmdbId));
}

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

async function getAllPages(path, params = {}, maxPages = 5) {
  const first = await tmdbGet(path, { ...params, page: 1 });
  if (!first?.results) return [];
  const results = [...first.results];
  const total = Math.min(first.total_pages ?? 1, maxPages);
  for (let p = 2; p <= total; p++) {
    const page = await tmdbGet(path, { ...params, page: p });
    if (page?.results) results.push(...page.results);
    await new Promise(r => setTimeout(r, DELAY));
  }
  return results;
}

function isFeature(film) {
  if (film.runtime != null && film.runtime < 60) return false;
  return true;
}

function isDocumentary(film) {
  return (film.genre_ids ?? film.genres?.map(g => g.id) ?? []).includes(99);
}

function isReleased(film) {
  return film.release_date && film.release_date <= TODAY && film.release_date >= TWO_WEEKS;
}

// ── Results store ─────────────────────────────────────────────────────────────

const results = new Map(); // conditionId -> { label, entries[] }

function addResult(conditionId, label, entry) {
  if (!results.has(conditionId)) results.set(conditionId, { label, entries: [] });
  results.get(conditionId).entries.push(entry);
}

// ── Phase 1: Curated decade/genre lists ──────────────────────────────────────

console.error('Phase 1: Checking curated decade/genre conditions...');

const decadeConditions = WIN_CONDITIONS.filter(
  wc => wc.category === 'decade' && wc.genreIds?.length && wc.decadeStart && wc.decadeEnd
);

for (const cond of decadeConditions) {
  // Only check if the current date falls within the condition's decade range
  const currentYear = new Date().getFullYear();
  if (currentYear < cond.decadeStart || currentYear > cond.decadeEnd) {
    console.error(`  ${cond.label}: skipping (not current decade)`);
    continue;
  }

  console.error(`  ${cond.label}: discovering...`);

  const films = await getAllPages('/discover/movie', {
    with_genres: cond.genreIds.join(','),
    'primary_release_date.gte': TWO_WEEKS,
    'primary_release_date.lte': TODAY,
    'vote_count.gte': 0,
    sort_by: 'primary_release_date.desc',
    language: 'en-US',
  });

  await new Promise(r => setTimeout(r, DELAY));

  for (const film of films) {
    if (existingCuratedIds[cond.id]?.has(film.id)) continue;
    if (isDocumentary(film)) continue;
    if (!isReleased(film)) continue;

    addResult(cond.id, cond.label, {
      tmdbId: film.id,
      title:  film.title,
      year:   parseInt(film.release_date.slice(0, 4)),
      votes:  film.vote_count,
      note:   '',
    });
  }

  console.error(`    → ${results.get(cond.id)?.entries.length ?? 0} new films`);
}

// ── Phase 2: Service the Fans ─────────────────────────────────────────────────

console.error('\nPhase 2: Checking Service the Fans (new sequels)...');

// Discover all films released in the last two weeks
const recentFilms = await getAllPages('/discover/movie', {
  'primary_release_date.gte': TWO_WEEKS,
  'primary_release_date.lte': TODAY,
  'vote_count.gte': 0,
  sort_by: 'primary_release_date.desc',
  language: 'en-US',
}, 10);

await new Promise(r => setTimeout(r, DELAY));

// Build set of collection IDs already represented in SERVICE_THE_FANS
// so we can detect new entries in known franchises
const knownCollectionIds = new Set();
const collectionCache = new Map();

// Pre-fetch collections for a sample of existing service-the-fans films
// to know which franchises we're already tracking
console.error(`  Checking ${recentFilms.length} recent films for sequel status...`);

let serviceFound = 0;
for (const film of recentFilms) {
  if (existingServiceIds.has(film.id)) continue;
  if (isDocumentary(film)) continue;

  // Get full detail to check collection membership
  const detail = await tmdbGet(`/movie/${film.id}`);
  await new Promise(r => setTimeout(r, DELAY));
  if (!detail) continue;

  if (!detail.belongs_to_collection) {
    // No collection — check title pattern as fallback
    const t = detail.title.toLowerCase();
    const roman = t.match(/\b(ii|iii|iv|v)\b(?:\s*[:–\-]|\s*$)/);
    const arabic = t.match(/\b\w[\w\s]*\s+(2|3|4|5)(?:\s*[:–\-]|\s*$)/);
    const part = t.match(/\bpart\s+(two|three|four|five|2|3|4|5)\b/);

    if (!roman && !arabic && !part) continue;

    const seqMap = { ii: 2, iii: 3, iv: 4, v: 5, two: 2, three: 3, four: 4, five: 5 };
    const sequence = roman ? seqMap[roman[1]]
      : arabic ? parseInt(arabic[1])
      : part ? (seqMap[part[1]] ?? parseInt(part[1]))
      : null;

    if (!sequence || sequence < 1 || sequence > 5) continue;
    if (isDocumentary(detail)) continue;
    if (detail.runtime != null && detail.runtime < 60) continue;

    addResult('service-the-fans', 'Service the Fans', {
      tmdbId:   detail.id,
      title:    detail.title,
      year:     parseInt(detail.release_date?.slice(0, 4) ?? '0'),
      sequence,
      votes:    detail.vote_count ?? 0,
      note:     'title pattern',
    });
    serviceFound++;
    continue;
  }

  // Has a collection — get position
  const colId = detail.belongs_to_collection.id;
  if (!collectionCache.has(colId)) {
    const col = await tmdbGet(`/collection/${colId}`);
    collectionCache.set(colId, col);
    await new Promise(r => setTimeout(r, DELAY));
  }

  const col = collectionCache.get(colId);
  if (!col?.parts) continue;

  const parts = col.parts
    .filter(p => p.release_date)
    .sort((a, b) => a.release_date.localeCompare(b.release_date));

  const idx = parts.findIndex(p => p.id === detail.id);
  if (idx === -1) continue;

  const sequence = idx + 1;
  if (sequence < 1 || sequence > 5) continue;
  if (isDocumentary(detail)) continue;
  if (detail.runtime != null && detail.runtime < 60) continue;

  addResult('service-the-fans', 'Service the Fans', {
    tmdbId:   detail.id,
    title:    detail.title,
    year:     parseInt(detail.release_date?.slice(0, 4) ?? '0'),
    sequence,
    votes:    detail.vote_count ?? 0,
    note:     `collection: "${col.name}" pos ${sequence}`,
  });
  serviceFound++;

  // Check if the original film (position 1) needs to be added
  if (sequence >= 2 && !originalsToAdd.has(colId)) {
    const original = parts[0]; // first film in chronological order
    if (original && !existingServiceIds.has(original.id)) {
      originalsToAdd.set(colId, {
        originalId:    original.id,
        originalTitle: original.title,
        originalYear:  parseInt(original.release_date?.slice(0, 4) ?? '0'),
        colName:       col.name,
        triggeredBy:   detail.title,
      });
    }
  }
}

console.error(`  → ${serviceFound} new sequel candidates`);

// ── Phase 3 & 4: Person filmographies (individual + group) ────────────────────

console.error('\nPhase 3 & 4: Checking person filmographies...');

// Build a map of personId -> list of conditionIds that use them
const personConditions = new Map(); // personId -> [{ conditionId, label, isGroup }]

for (const wc of WIN_CONDITIONS) {
  if (wc.category === 'person') {
    // Individual condition — find matching filmography
    const filmography = FILMOGRAPHY_MAP.get(wc.id);
    if (filmography) {
      const pid = filmography.personId;
      if (!personConditions.has(pid)) personConditions.set(pid, []);
      personConditions.get(pid).push({ conditionId: wc.id, label: wc.label, isGroup: false });
    }
  } else if (wc.category === 'themed' && wc.groupPersonIds?.length) {
    for (let i = 0; i < wc.groupPersonIds.length; i++) {
      const pid = wc.groupPersonIds[i];
      if (!personConditions.has(pid)) personConditions.set(pid, []);
      personConditions.get(pid).push({
        conditionId: wc.id,
        label: `${wc.label} (${wc.groupDisplayNames?.[i] ?? pid})`,
        isGroup: true,
      });
    }
  }
}

// Build existing filmography ID sets per conditionId
const existingFilmographyIds = new Map(); // conditionId -> Set<tmdbId>
for (const [condId, filmography] of FILMOGRAPHY_MAP) {
  existingFilmographyIds.set(condId, new Set(filmography.films.map(f => f.tmdbId)));
}

// For group conditions, merge all member filmographies
for (const wc of WIN_CONDITIONS.filter(w => w.category === 'themed' && w.groupPersonIds?.length)) {
  const merged = new Set();
  for (const pid of wc.groupPersonIds) {
    const filmography = [...FILMOGRAPHY_MAP.values()].find(f => f.personId === pid);
    if (filmography) filmography.films.forEach(f => merged.add(f.tmdbId));
  }
  existingFilmographyIds.set(wc.id, merged);
}

let personTotal = 0;

for (const [personId, conditions] of personConditions) {
  const name = conditions[0].label.split('(')[0].trim();
  console.error(`  Checking ${name} (personId: ${personId})...`);

  const credits = await tmdbGet(`/person/${personId}/movie_credits`, { language: 'en-US' });
  await new Promise(r => setTimeout(r, DELAY));

  if (!credits) {
    console.error(`    ✗ Failed to fetch credits`);
    continue;
  }

  // Combine cast and crew, deduplicate by film ID
  const allFilms = new Map();
  for (const f of [...(credits.cast ?? []), ...(credits.crew ?? [])]) {
    if (!allFilms.has(f.id)) allFilms.set(f.id, f);
  }

  for (const film of allFilms.values()) {
    if (!isReleased(film)) continue;
    if (isDocumentary(film)) continue;

    // Get full detail for runtime check
    const detail = MOVIE_CACHE[film.id]
      ?? await tmdbGet(`/movie/${film.id}`);
    if (detail && !isFeature(detail)) continue;

    for (const cond of conditions) {
      const existing = existingFilmographyIds.get(cond.conditionId);
      if (existing?.has(film.id)) continue;

      addResult(cond.conditionId, cond.label, {
        tmdbId: film.id,
        title:  film.title,
        year:   parseInt(film.release_date?.slice(0, 4) ?? '0'),
        votes:  film.vote_count ?? 0,
        note:   film.job ? `crew: ${film.job}` : `cast`,
      });
      personTotal++;
    }
  }

  await new Promise(r => setTimeout(r, DELAY));
}

console.error(`  → ${personTotal} new person filmography entries`);

// ── Output ────────────────────────────────────────────────────────────────────

const totalNew = [...results.values()].reduce((sum, r) => sum + r.entries.length, 0);
console.error(`\nTotal new entries across all conditions: ${totalNew}`);

if (totalNew === 0) {
  console.log(`// No new qualifying films found for the period ${TWO_WEEKS} to ${TODAY}.`);
  process.exit(0);
}

console.log(`// ════════════════════════════════════════════════════════════════════════════`);
console.log(`// NEW RELEASES — ${TWO_WEEKS} to ${TODAY}`);
console.log(`// ════════════════════════════════════════════════════════════════════════════`);
console.log(`// Review each entry before adding to the relevant data file.`);
console.log(`// After adding, run:`);
console.log(`//   npx tsx scripts/build-movie-cache.mjs`);
console.log(`//   npx tsx scripts/build-overlap-index.mjs\n`);

for (const [conditionId, { label, entries }] of results) {
  if (!entries.length) continue;

  console.log(`\n// ── ${label} ──────────────────────────────────────────────────────────────`);

  if (conditionId === 'service-the-fans') {
    console.log(`// Add to SERVICE_THE_FANS in lib/service-the-fans.ts\n`);
    for (const e of entries.sort((a, b) => b.votes - a.votes)) {
      const idStr    = String(e.tmdbId).padEnd(8);
      const titleStr = JSON.stringify(e.title).padEnd(52);
      console.log(`  { tmdbId: ${idStr}, title: ${titleStr} year: ${e.year}, sequence: ${e.sequence} }, // ${e.votes} votes  ${e.note}`);
    }
  } else if (FILMOGRAPHY_MAP.has(conditionId) || WIN_CONDITIONS.find(w => w.id === conditionId && (w.category === 'person' || w.category === 'themed'))) {
    console.log(`// Add to PERSON_FILMOGRAPHIES entry for '${conditionId}' in lib/person-filmographies.ts\n`);
    for (const e of entries.sort((a, b) => b.votes - a.votes)) {
      const idStr    = String(e.tmdbId).padEnd(8);
      const titleStr = JSON.stringify(e.title).padEnd(52);
      console.log(`  { tmdbId: ${idStr}, title: ${titleStr} year: ${e.year}, role: '${e.note?.startsWith('crew') ? 'Crew' : 'Actor'}' }, // ${e.votes} votes  ${e.note}`);
    }
  } else {
    console.log(`// Add to CURATED_LISTS['${conditionId}'] in lib/decade-genre-lists.ts\n`);
    for (const e of entries.sort((a, b) => b.votes - a.votes)) {
      const idStr    = String(e.tmdbId).padEnd(8);
      const titleStr = JSON.stringify(e.title).padEnd(52);
      console.log(`  { tmdbId: ${idStr}, title: ${titleStr} year: ${e.year} }, // ${e.votes} votes`);
    }
  }
}

console.log(`\n// Total: ${totalNew} new entries across ${results.size} conditions`);

// ── Originals reminder ────────────────────────────────────────────────────────

if (originalsToAdd.size > 0) {
  console.log('\n\n// ════════════════════════════════════════════════════════════════════════════');
  console.log('// ALSO ADD ORIGINALS — these series originals are not yet in Service the Fans');
  console.log('// Add to SERVICE_THE_FANS in lib/service-the-fans.ts with sequence: 1');
  console.log('// ════════════════════════════════════════════════════════════════════════════\n');
  for (const { originalId, originalTitle, originalYear, colName, triggeredBy } of originalsToAdd.values()) {
    const idStr    = String(originalId).padEnd(8);
    const titleStr = JSON.stringify(originalTitle).padEnd(52);
    console.log(`  { tmdbId: ${idStr}, title: ${titleStr} year: ${originalYear}, sequence: 1 }, // triggered by: ${triggeredBy} — collection: "${colName}"`);
  }
}

console.error('\nDone.');
