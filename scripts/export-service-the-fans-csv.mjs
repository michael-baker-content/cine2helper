// export-service-the-fans-csv.mjs
//
// Exports the SERVICE_THE_FANS list to a CSV with sequence numbers.
// Sequence numbers are derived from TMDB collection position where available,
// with a title-parsing fallback for films not in a TMDB collection.
//
// The CSV is intended for manual review and editing. Once corrected, a
// future script can re-import it back into service-the-fans.ts.
//
// Run: node scripts/export-service-the-fans-csv.mjs
// Requires TMDB_READ_ACCESS_TOKEN in .env.local
// Output: scripts/service-the-fans.csv

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load env ──────────────────────────────────────────────────────────────────
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
console.log(`Loaded ${films.length} films from service-the-fans.ts`);

// ── Title-based sequence number fallback ──────────────────────────────────────
// Matches things like "2", "II", "III", "IV", "V", "Part 2", "Part Two" etc.
const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5 };
const WRITTEN = { one: 1, two: 2, three: 3, four: 4, five: 5 };

function sequenceFromTitle(title) {
  const t = title.toLowerCase();

  // "Part X" or "Part Roman"
  const partMatch = t.match(/\bpart\s+([ivxone-five\d]+)\b/);
  if (partMatch) {
    const val = partMatch[1];
    if (ROMAN[val]) return ROMAN[val];
    if (WRITTEN[val]) return WRITTEN[val];
    const n = parseInt(val);
    if (n >= 1 && n <= 5) return n;
  }

  // Trailing digit or roman numeral: "Alien 3", "Rocky IV", "Fast Five"
  const trailMatch = t.match(/\s([ivone-five\d]+)[\s:,!?]*$/);
  if (trailMatch) {
    const val = trailMatch[1].trim();
    if (ROMAN[val]) return ROMAN[val];
    if (WRITTEN[val]) return WRITTEN[val];
    const n = parseInt(val);
    if (n >= 1 && n <= 5) return n;
  }

  return null;
}

// ── TMDB helpers ──────────────────────────────────────────────────────────────
async function getMovieCollection(tmdbId) {
  const res = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}`, {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}` }
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.belongs_to_collection ?? null;
}

// Cache collection details to avoid re-fetching for films in the same franchise
const collectionCache = new Map();

async function getCollectionParts(collectionId) {
  if (collectionCache.has(collectionId)) return collectionCache.get(collectionId);
  const res = await fetch(`https://api.themoviedb.org/3/collection/${collectionId}`, {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}` }
  });
  if (!res.ok) { collectionCache.set(collectionId, []); return []; }
  const data = await res.json();
  // Sort parts by release date ascending — position = sequence number
  const parts = (data.parts ?? [])
    .filter(p => p.release_date)
    .sort((a, b) => a.release_date.localeCompare(b.release_date));
  collectionCache.set(collectionId, parts);
  return parts;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const rows = [];
  let resolved = 0, fromCollection = 0, fromTitle = 0, unresolved = 0;

  for (let i = 0; i < films.length; i++) {
    const film = films[i];

    // Step 1: Try TMDB collection position
    let sequenceNum = null;
    let collectionName = '';
    let method = '';

    const collection = await getMovieCollection(film.tmdbId);
    await sleep(120);

    if (collection) {
      collectionName = collection.name;
      const parts = await getCollectionParts(collection.id);
      const pos = parts.findIndex(p => p.id === film.tmdbId);
      if (pos !== -1) {
        sequenceNum = pos + 1; // 1-indexed
        method = 'collection';
        fromCollection++;
      }
    }

    // Step 2: Title fallback
    if (sequenceNum === null) {
      sequenceNum = sequenceFromTitle(film.title);
      if (sequenceNum !== null) {
        method = 'title';
        fromTitle++;
      } else {
        method = 'unknown';
        unresolved++;
      }
    }

    resolved++;
    if (resolved % 50 === 0) {
      console.log(`  ...${resolved}/${films.length} processed`);
    }

    rows.push({
      tmdbId: film.tmdbId,
      title: film.title,
      year: film.year,
      sequenceNum: sequenceNum ?? '',
      collectionName,
      method,
    });
  }

  // ── Write CSV ───────────────────────────────────────────────────────────────
  const csvEscape = val => {
    const s = String(val ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const header = 'tmdbId,title,year,sequence,collection,method';
  const csvRows = rows.map(r =>
    [r.tmdbId, r.title, r.year, r.sequenceNum, r.collectionName, r.method]
      .map(csvEscape).join(',')
  );

  const csv = [header, ...csvRows].join('\n');
  const outPath = path.join(__dirname, 'service-the-fans.csv');
  fs.writeFileSync(outPath, csv, 'utf8');

  console.log(`\nDone.`);
  console.log(`  From collection position: ${fromCollection}`);
  console.log(`  From title parsing:       ${fromTitle}`);
  console.log(`  Unresolved:               ${unresolved}`);
  console.log(`\nCSV written to scripts/service-the-fans.csv`);
  console.log(`Open in Excel or Google Sheets to review and correct sequence numbers.`);
  console.log(`Unresolved entries (method=unknown) are likely franchise firsts — sequence=1.`);
}

main().catch(e => { console.error(e); process.exit(1); });
