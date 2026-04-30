// find-all-sequels.mjs
//
// Checks every film ID across all static data sources (Oscar winners,
// curated decade/genre lists, person filmographies, and Service the Fans
// itself) to find sequels not yet in SERVICE_THE_FANS.
//
// Two detection methods:
//   1. TMDB collection data — chronological position within the collection.
//      Positions 2-5 are sequels. Position 1 (originals) are included only
//      if another film in the same collection is already in SERVICE_THE_FANS
//      or is being added by this run (i.e. the series is already represented).
//   2. Title pattern matching — catches sequels TMDB doesn't put in
//      collections (e.g. "Part II", "2", "III", "Critters 2" etc.)
//
// Output: ready-to-paste entries for lib/service-the-fans.ts
// Progress: stderr (won't pollute captured output)
//
// Run:    node scripts/find-all-sequels.mjs
// Capture output only: node scripts/find-all-sequels.mjs > all-sequels.txt
// Requires TMDB_READ_ACCESS_TOKEN in .env.local

import { readFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
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
  } catch {
    console.warn('No .env.local found.');
  }
}

loadEnv();

const TOKEN = process.env.TMDB_READ_ACCESS_TOKEN;
if (!TOKEN) { console.error('No TMDB_READ_ACCESS_TOKEN set.'); process.exit(1); }

// ── Load all source IDs via tsx imports ──────────────────────────────────────

console.error('Loading source data files...');

const [
  { OSCAR_WINNER_TMDB_IDS },
  { SERVICE_THE_FANS, SERVICE_THE_FANS_IDS },
  { CURATED_LISTS },
  { PERSON_FILMOGRAPHIES },
] = await Promise.all([
  import('../lib/oscar-winners.ts'),
  import('../lib/service-the-fans.ts'),
  import('../lib/decade-genre-lists.ts'),
  import('../lib/person-filmographies.ts'),
]);

// Build the set of IDs already in SERVICE_THE_FANS (including sequence info)
const EXISTING_SERVICE_IDS = new Set(SERVICE_THE_FANS_IDS);
const EXISTING_SERVICE_MAP = new Map(SERVICE_THE_FANS.map(f => [f.tmdbId, f.sequence]));

// Collect all unique IDs across every source
const allIds = new Set();
for (const id of OSCAR_WINNER_TMDB_IDS) allIds.add(id);
for (const films of Object.values(CURATED_LISTS)) {
  for (const f of films) allIds.add(f.tmdbId);
}
for (const person of PERSON_FILMOGRAPHIES) {
  for (const f of person.films) allIds.add(f.tmdbId);
}
// Also include SERVICE_THE_FANS IDs — we check against these but don't re-add them
for (const id of SERVICE_THE_FANS_IDS) allIds.add(id);

// IDs to check = all IDs minus those already in SERVICE_THE_FANS
const idsToCheck = [...allIds].filter(id => !EXISTING_SERVICE_IDS.has(id));

console.error(`Total unique IDs across all sources: ${allIds.size}`);
console.error(`Already in SERVICE_THE_FANS:         ${EXISTING_SERVICE_IDS.size}`);
console.error(`IDs to check:                        ${idsToCheck.length}\n`);

// ── Title pattern matching ────────────────────────────────────────────────────

function detectSequenceFromTitle(title) {
  const t = title.toLowerCase();

  // "Part X" — "Part Two", "Part 2" etc.
  const partWord = t.match(/\bpart\s+(one|two|three|four|five|1|2|3|4|5)\b/);
  if (partWord) {
    const map = { one: 1, two: 2, three: 3, four: 4, five: 5,
                  '1': 1, '2': 2, '3': 3, '4': 4, '5': 5 };
    return map[partWord[1]] ?? null;
  }

  // Roman numerals at word boundary: "Alien II", "Rocky III", "Saw IV"
  // Must appear at end of title or before a colon/dash
  const roman = t.match(/\b(ii|iii|iv|v)\b(?:\s*[:–\-]|\s*$)/);
  if (roman) {
    const map = { ii: 2, iii: 3, iv: 4, v: 5 };
    return map[roman[1]] ?? null;
  }

  // Arabic digit sequel: "Critters 2", "Saw 2", "Alien 3"
  // Digit must follow a word and appear at end or before colon
  const arabic = t.match(/\b\w[\w\s]*\s+(2|3|4|5)(?:\s*[:–\-]|\s*$)/);
  if (arabic) {
    const n = parseInt(arabic[1]);
    if (n >= 2 && n <= 5) return n;
  }

  return null;
}

// ── TMDB helpers ──────────────────────────────────────────────────────────────

const DELAY = 120; // ms between requests — stays well within TMDB rate limits
const BATCH = 40;

async function tmdbGet(path, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url.toString(), {
    headers: { Authorization: 'Bearer ' + TOKEN },
  });
  if (!res.ok) return null;
  return res.json();
}

const collectionCache = new Map();

async function getCollectionPosition(collectionId, movieId) {
  if (!collectionCache.has(collectionId)) {
    const col = await tmdbGet(`/collection/${collectionId}`);
    collectionCache.set(collectionId, col);
    await new Promise(r => setTimeout(r, DELAY));
  }
  const col = collectionCache.get(collectionId);
  if (!col?.parts) return null;
  const parts = col.parts
    .filter(p => p.release_date)
    .sort((a, b) => a.release_date.localeCompare(b.release_date));
  const idx = parts.findIndex(p => p.id === movieId);
  return idx === -1 ? null : idx + 1; // 1-based
}

// ── Main loop ─────────────────────────────────────────────────────────────────

const toAdd    = [];   // confirmed sequels to add
const originals = []; // position-1 films — reviewed after loop to check if series represented
let processed  = 0;
let notFound   = 0;

for (let i = 0; i < idsToCheck.length; i += BATCH) {
  const batch = idsToCheck.slice(i, i + BATCH);

  const settled = await Promise.allSettled(
    batch.map(id => tmdbGet(`/movie/${id}`))
  );

  for (let j = 0; j < settled.length; j++) {
    const id = batch[j];
    const result = settled[j];

    if (result.status === 'rejected' || !result.value?.id) {
      notFound++;
      continue;
    }

    const detail = result.value;
    processed++;

    let sequence = null;
    let method   = '';

    // Method 1: TMDB collection position
    if (detail.belongs_to_collection) {
      const pos = await getCollectionPosition(detail.belongs_to_collection.id, id);
      if (pos !== null && pos >= 2 && pos <= 5) {
        sequence = pos;
        method = `TMDB collection pos ${pos} — "${detail.belongs_to_collection.name}"`;
      } else if (pos === 1) {
        // Stash originals — decide after loop whether to include
        originals.push({
          id,
          title: detail.title,
          year: parseInt(detail.release_date?.slice(0, 4) ?? '0'),
          collectionId: detail.belongs_to_collection.id,
          collectionName: detail.belongs_to_collection.name,
        });
        continue;
      }
    }

    // Method 2: Title pattern (used when no collection data, or as confirmation)
    if (sequence === null) {
      const titleSeq = detectSequenceFromTitle(detail.title);
      if (titleSeq !== null) {
        sequence = titleSeq;
        method = `title pattern — "${detail.title}"`;
      }
    }

    if (sequence !== null) {
      toAdd.push({
        id,
        title: detail.title,
        year: parseInt(detail.release_date?.slice(0, 4) ?? '0'),
        sequence,
        method,
      });
      console.error(`  ✓ seq-${sequence}: ${detail.title}`);
    }
  }

  // Small pause between batches
  await new Promise(r => setTimeout(r, 200));

  const done = Math.min(i + BATCH, idsToCheck.length);
  process.stderr.write(`  Progress: ${done}/${idsToCheck.length} checked, ${toAdd.length} found so far\r`);
}

console.error(''); // clear progress line

// ── Resolve originals — include if their collection is represented ─────────────
// A collection is "represented" if:
//   (a) another film from it is already in SERVICE_THE_FANS, or
//   (b) we're adding a sequel from it in this run

const addedCollectionIds = new Set();
for (const f of toAdd) {
  // Re-check via cache which collection each toAdd film belongs to
  // We stored collectionId on originals; for toAdd we need to re-derive
  // This is approximate — use title matching as proxy for now
}

// Build set of collection IDs that are already represented in SERVICE_THE_FANS
const representedCollections = new Set();
for (const id of EXISTING_SERVICE_IDS) {
  // We don't have collection IDs stored for existing entries,
  // but we can check originals against collections of films we're adding
}

// Simpler: for each original, check if any film in its collection is
// already in EXISTING_SERVICE_IDS or toAdd
const toAddIds = new Set(toAdd.map(f => f.id));

for (const orig of originals) {
  const col = collectionCache.get(orig.collectionId);
  if (!col?.parts) continue;

  const collectionMemberIds = col.parts.map(p => p.id);

  const alreadyRepresented = collectionMemberIds.some(
    mid => mid !== orig.id && EXISTING_SERVICE_IDS.has(mid)
  );
  const beingAdded = collectionMemberIds.some(
    mid => mid !== orig.id && toAddIds.has(mid)
  );

  if (alreadyRepresented || beingAdded) {
    toAdd.push({
      id: orig.id,
      title: orig.title,
      year: orig.year,
      sequence: 1,
      method: `TMDB collection pos 1 — "${orig.collectionName}" (series represented)`,
    });
    console.error(`  ✓ seq-1 (original): ${orig.title}`);
  }
}

// ── Output ────────────────────────────────────────────────────────────────────

toAdd.sort((a, b) => a.sequence - b.sequence || b.year - a.year || a.title.localeCompare(b.title));

console.log(`// ── New SERVICE_THE_FANS entries found across all sources ────────────────────`);
console.log(`// Add these to lib/service-the-fans.ts after review.`);
console.log(`// Detection method shown in comment — review title-pattern entries carefully.\n`);

if (toAdd.length === 0) {
  console.log('// No new sequel entries found.');
} else {
  for (const f of toAdd) {
    const idStr    = String(f.id).padEnd(9);
    const titleStr = JSON.stringify(f.title).padEnd(55);
    console.log(`  { tmdbId: ${idStr} title: ${titleStr} year: ${f.year}, sequence: ${f.sequence} }, // ${f.method}`);
  }
}

console.log(`\n// Total: ${toAdd.length} new entries`);
console.error(`\nDone. ${processed} films checked, ${toAdd.length} to add, ${notFound} not found on TMDB.`);
