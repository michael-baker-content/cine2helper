// build-sequence-numbers.mjs
//
// For every film in service-the-fans.ts, determines its sequence number
// (position in its franchise) using TMDB collection data as primary source,
// with title-parsing as fallback.
//
// Outputs:
//   scripts/sequence-numbers.json  — machine-readable results for import
//   scripts/sequence-report.txt    — human-readable report
//   scripts/sequence-unclear.txt   — films needing manual review
//
// Run: node scripts/build-sequence-numbers.mjs
// Requires TMDB_READ_ACCESS_TOKEN in .env.local

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envSrc = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const TMDB_TOKEN = envSrc.match(/TMDB_READ_ACCESS_TOKEN=(.+)/)[1].trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Parse service-the-fans.ts ─────────────────────────────────────────────────
const src = fs.readFileSync(
  path.join(__dirname, '..', 'lib', 'service-the-fans.ts'), 'utf8'
);
const films = [];
for (const m of src.matchAll(/\{\s*tmdbId:\s*(\d+),\s*title:\s*'([^']+)',\s*year:\s*(\d+)\s*\}/g)) {
  films.push({ tmdbId: parseInt(m[1]), title: m[2], year: parseInt(m[3]) });
}
console.log(`Loaded ${films.length} films`);

// ── TMDB helpers ──────────────────────────────────────────────────────────────
const collectionCache = new Map();

async function getMovieData(tmdbId) {
  await sleep(110);
  const res = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}`, {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}` }
  });
  if (!res.ok) return null;
  return res.json();
}

async function getCollection(collectionId) {
  if (collectionCache.has(collectionId)) return collectionCache.get(collectionId);
  await sleep(200);
  const res = await fetch(`https://api.themoviedb.org/3/collection/${collectionId}`, {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}` }
  });
  if (!res.ok) { collectionCache.set(collectionId, null); return null; }
  const data = await res.json();
  const parts = (data.parts ?? [])
    .filter(p => p.release_date)
    .sort((a, b) => a.release_date.localeCompare(b.release_date));
  const result = { name: data.name, parts };
  collectionCache.set(collectionId, result);
  return result;
}

// ── Title parsing fallback ────────────────────────────────────────────────────
const ROMAN = { 'i':1,'ii':2,'iii':3,'iv':4,'v':5,'vi':6 };
const WRITTEN = { 'one':1,'two':2,'three':3,'four':4,'five':5,'six':6 };

function sequenceFromTitle(title) {
  const t = title.toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[:\-–]/g, ' ');

  // "part X"
  const partMatch = t.match(/\bpart\s+([ivone-six\d]+)\b/);
  if (partMatch) {
    const v = partMatch[1];
    if (ROMAN[v]) return ROMAN[v];
    if (WRITTEN[v]) return WRITTEN[v];
    const n = parseInt(v);
    if (n >= 1 && n <= 6) return n;
  }

  // Trailing numeral/word
  const trailMatch = t.match(/\s([ivone-six\d]+)\s*$/);
  if (trailMatch) {
    const v = trailMatch[1].trim();
    if (ROMAN[v] && v !== 'i') return ROMAN[v]; // skip lone 'i' - too many false positives
    if (WRITTEN[v]) return WRITTEN[v];
    const n = parseInt(v);
    if (n >= 1 && n <= 6) return n;
  }

  // No numeral = likely first in series
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const results = []; // { tmdbId, title, year, sequence, collectionName, method }

  for (let i = 0; i < films.length; i++) {
    const film = films[i];
    let sequence = null;
    let collectionName = '';
    let method = 'unknown';

    if ((i + 1) % 50 === 0) console.log(`  ...${i + 1}/${films.length}`);

    const data = await getMovieData(film.tmdbId);
    if (data?.belongs_to_collection) {
      const col = await getCollection(data.belongs_to_collection.id);
      if (col) {
        collectionName = col.name;
        const pos = col.parts.findIndex(p => p.id === film.tmdbId);
        if (pos !== -1) {
          sequence = pos + 1;
          method = 'collection';
        }
      }
    }

    // Title fallback
    if (sequence === null) {
      const fromTitle = sequenceFromTitle(film.title);
      if (fromTitle !== null) {
        sequence = fromTitle;
        method = 'title';
      }
    }

    results.push({
      tmdbId: film.tmdbId,
      title: film.title,
      year: film.year,
      sequence,
      collectionName,
      method,
    });
  }

  // ── Write JSON ───────────────────────────────────────────────────────────
  const jsonPath = path.join(__dirname, 'sequence-numbers.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

  // ── Write reports ─────────────────────────────────────────────────────────
  const byMethod = results.reduce((a, r) => {
    a[r.method] = (a[r.method] || 0) + 1; return a;
  }, {});

  const overLimit = results.filter(r => r.sequence !== null && r.sequence > 5);
  const unclear   = results.filter(r => r.sequence === null);
  const resolved  = results.filter(r => r.sequence !== null && r.sequence <= 5);

  const reportLines = [
    'SEQUENCE NUMBER REPORT',
    '═'.repeat(60),
    `Total films: ${results.length}`,
    `Resolved (seq 1-5): ${resolved.length}`,
    `Over limit (seq 6+): ${overLimit.length}`,
    `Unclear (unknown): ${unclear.length}`,
    '',
    'By method:',
    ...Object.entries(byMethod).map(([k,v]) => `  ${k}: ${v}`),
    '',
    '═'.repeat(60),
    'FILMS WITH SEQUENCE > 5 (candidates for removal):',
    '═'.repeat(60),
    ...overLimit.sort((a,b) => a.sequence - b.sequence).map(r =>
      `  seq ${r.sequence} [${r.year}] ${r.title} (TMDB:${r.tmdbId}) [${r.method}]${r.collectionName ? ' — ' + r.collectionName : ''}`
    ),
  ];

  const unclearLines = [
    'FILMS WITH UNCLEAR SEQUENCE — NEEDS MANUAL REVIEW',
    '═'.repeat(60),
    `${unclear.length} films could not have their position determined.`,
    'These are likely first entries in their series (sequence=1),',
    'or standalone films that were incorrectly included.',
    '',
    ...unclear.sort((a,b) => a.title.localeCompare(b.title)).map(r =>
      `  [${r.year}] ${r.title} (TMDB:${r.tmdbId})`
    ),
  ];

  fs.writeFileSync(path.join(__dirname, 'sequence-report.txt'), reportLines.join('\n'));
  fs.writeFileSync(path.join(__dirname, 'sequence-unclear.txt'), unclearLines.join('\n'));

  console.log('\nDone.');
  console.log(`  Resolved: ${resolved.length}, Over-limit: ${overLimit.length}, Unclear: ${unclear.length}`);
  console.log('  sequence-numbers.json, sequence-report.txt, sequence-unclear.txt written');
}

main().catch(e => { console.error(e); process.exit(1); });
