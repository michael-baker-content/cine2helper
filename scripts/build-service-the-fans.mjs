// build-service-the-fans.mjs
// Finds films qualifying for "Service the Fans" win condition:
// - Sequels 1-5 in a series (numbered or via TMDB collection membership)
// - Minimum 500 votes for relevance
//
// Run: node build-service-the-fans.mjs > service-the-fans.txt
// Requires TMDB_READ_ACCESS_TOKEN in .env.local

import { readFileSync } from 'fs';
import { join } from 'path';

const envPath = join(process.cwd(), '.env.local');
const envVars = readFileSync(envPath, 'utf8');
const tokenMatch = envVars.match(/TMDB_READ_ACCESS_TOKEN=(.+)/);
const TOKEN = tokenMatch?.[1]?.trim();
if (!TOKEN) { console.error('No token'); process.exit(1); }

const MIN_VOTES = 500;
const DISCOVER_PAGES = 20; // top ~400 films by vote count

// ── Regex patterns for numbered sequels ──────────────────────────────────────

const SEQUEL_PATTERNS = [
  // Arabic numerals: "2", "3", "4", "5" as standalone word
  /\b(2|3|4|5)\b/,
  // Roman numerals: standalone II-V
  /\b(II|III|IV|V)\b/,
  // Written numbers
  /\b(Two|Three|Four|Five)\b/i,
  // Explicit part/chapter/volume
  /\b(Part|Chapter|Vol\.?|Volume|Episode)\s*(2|3|4|5|II|III|IV|V|Two|Three|Four|Five)\b/i,
];

// Titles to exclude even if they match the regex (false positives)
const EXCLUDE_TITLES = new Set([
  'The Magnificent Seven',  // "Seven" matches Five-ish
  '2001: A Space Odyssey',  // year, not sequel number
  '2010',                   // year
  '1984',                   // year
  'Three Colors: Blue',
  'Three Colors: Red',
  'Three Colors: White',
  'The Three Musketeers',
  'Three Billboards Outside Ebbing, Missouri',
  'Three Billboards Outside Ebbing Missouri',
  'Five Easy Pieces',
  'Five Nights at Freddy\'s',
  'The Hateful Eight',
  'Ocean\'s Eleven',
  'Ocean\'s Twelve',
  'Ocean\'s Thirteen',
  'Se7en',
  'The Magnificent 7',
  'Four Weddings and a Funeral',
  'Four Rooms',
  'Five',
  'Two for the Road',
  'Two Lovers',
  'Two Days One Night',
]);

function isSequel(title) {
  if (EXCLUDE_TITLES.has(title)) return false;
  return SEQUEL_PATTERNS.some(p => p.test(title));
}

// ── TMDB helpers ──────────────────────────────────────────────────────────────

async function tmdbGet(path, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: 'Bearer ' + TOKEN }
  });
  return res.json();
}

async function getCollection(collectionId) {
  return tmdbGet(`/collection/${collectionId}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const results = new Map(); // tmdbId → { title, year, votes, reason }

// Phase 1: discover popular films, check for numbered sequels and collections
console.error('Phase 1: Scanning popular films...');

for (let page = 1; page <= DISCOVER_PAGES; page++) {
  const data = await tmdbGet('/discover/movie', {
    sort_by: 'vote_count.desc',
    'vote_count.gte': MIN_VOTES,
    page,
    language: 'en-US',
  });

  for (const film of data.results || []) {
    // Check 1: numbered sequel title
    if (isSequel(film.title)) {
      results.set(film.id, {
        id: film.id,
        title: film.title,
        year: film.release_date?.slice(0, 4) ?? '?',
        votes: film.vote_count,
        reason: 'numbered-title',
      });
    }
  }
  await new Promise(r => setTimeout(r, 100));
}

console.error(`Phase 1 complete: ${results.size} numbered sequels found`);

// Phase 2: check collections for first films
// Fetch details for top films and look for belongs_to_collection
console.error('Phase 2: Checking collections for first films...');

const collectionsSeen = new Set();
const firstFilmCandidates = new Map();

for (let page = 1; page <= DISCOVER_PAGES; page++) {
  const data = await tmdbGet('/discover/movie', {
    sort_by: 'vote_count.desc',
    'vote_count.gte': MIN_VOTES,
    page,
    language: 'en-US',
  });

  for (const film of data.results || []) {
    // Fetch full details to get belongs_to_collection
    const detail = await tmdbGet(`/movie/${film.id}`);
    const collection = detail.belongs_to_collection;

    if (collection && !collectionsSeen.has(collection.id)) {
      collectionsSeen.add(collection.id);

      // Fetch full collection to count parts
      const col = await getCollection(collection.id);
      const parts = (col.parts || [])
        .filter(p => p.release_date) // only released films
        .sort((a, b) => a.release_date.localeCompare(b.release_date));

      if (parts.length >= 2) {
        // Collection has sequels — add parts 1-5
        parts.slice(0, 5).forEach((part, idx) => {
          const partNum = idx + 1;
          const votes = part.vote_count ?? 0;
          if (votes >= MIN_VOTES || partNum === 1) {
            if (!results.has(part.id)) {
              results.set(part.id, {
                id: part.id,
                title: part.title,
                year: part.release_date?.slice(0, 4) ?? '?',
                votes,
                reason: partNum === 1 ? `collection-first (${col.name})` : `collection-part-${partNum} (${col.name})`,
              });
            }
          }
        });
      }

      await new Promise(r => setTimeout(r, 100));
    }
  }
  await new Promise(r => setTimeout(r, 100));
}

console.error(`Phase 2 complete. Total: ${results.size} films`);

// Output results sorted by votes desc
const sorted = [...results.values()].sort((a, b) => b.votes - a.votes);

console.log('\n=== SERVICE THE FANS — Qualifying Films ===');
console.log(`Total: ${sorted.length}\n`);
for (const f of sorted) {
  console.log(`${f.id}\t${f.title}\t${f.year}\t${f.votes} votes\t${f.reason}`);
}
