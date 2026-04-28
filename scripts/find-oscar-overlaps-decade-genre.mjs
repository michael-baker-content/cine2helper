// find-oscar-overlaps-decade-genre.mjs
//
// Checks every film in our three decade-genre curated lists (SCIFI_80S,
// ROMANCE_90S, HORROR_2000S) against Wikidata to find which ones have won
// any Academy Award in any category.
//
// Cross-references results against oscar-winners.ts to show:
//   - Films already in both lists (confirmed overlap)
//   - Films that won Oscars but are NOT in oscar-winners.ts (missing additions)
//
// Run: node scripts/find-oscar-overlaps-decade-genre.mjs
// Requires TMDB_READ_ACCESS_TOKEN in .env.local
// Output: scripts/oscar-decade-genre-report.txt

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load env ──────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env.local');
const envSrc  = fs.readFileSync(envPath, 'utf8');
const tokenMatch = envSrc.match(/TMDB_READ_ACCESS_TOKEN=(.+)/);
if (!tokenMatch) { console.error('TMDB_READ_ACCESS_TOKEN not found'); process.exit(1); }
const TMDB_TOKEN = tokenMatch[1].trim();

// ── Parse curated lists from source ──────────────────────────────────────────
function parseList(src, listName) {
  const start = src.indexOf(`export const ${listName}`);
  const end   = src.indexOf('];', start) + 2;
  const chunk = src.slice(start, end);
  const films = [];
  for (const m of chunk.matchAll(/\{\s*tmdbId:\s*(\d+),\s*title:\s*'([^']+)'(?:,\s*tmdbTitle:\s*'([^']+)')?,\s*year:\s*(\d+)/g)) {
    films.push({ tmdbId: parseInt(m[1]), title: m[2], tmdbTitle: m[3] ?? null, year: parseInt(m[4]) });
  }
  return films;
}

const listsSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'decade-genre-lists.ts'), 'utf8');
const LISTS = {
  SCIFI_80S:    parseList(listsSrc, 'SCIFI_80S'),
  ROMANCE_90S:  parseList(listsSrc, 'ROMANCE_90S'),
  HORROR_2000S: parseList(listsSrc, 'HORROR_2000S'),
};

// ── Parse existing oscar-winners TMDB IDs ────────────────────────────────────
const oscarSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'oscar-winners.ts'), 'utf8');
const existingOscarIds = new Set(
  [...oscarSrc.matchAll(/tmdbId:\s*(\d+)/g)].map(m => parseInt(m[1]))
);
console.log(`Loaded ${existingOscarIds.size} existing Oscar winner TMDB IDs`);

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Step 1: Resolve TMDB IDs → IMDB IDs ──────────────────────────────────────
async function getImdbId(tmdbId) {
  const res = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}/external_ids`, {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}` }
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.imdb_id ?? null;
}

// ── Step 2: Batch Wikidata query for a set of IMDB IDs ────────────────────────
// Wikidata SPARQL has a limit on VALUES clause size, so we batch in chunks of 50
async function queryOscarWinsByImdbIds(imdbIds) {
  if (imdbIds.length === 0) return new Map();

  const values = imdbIds.map(id => `"${id}"`).join(' ');
  const sparql = `
    SELECT DISTINCT ?imdbId ?filmLabel ?awardLabel ?year WHERE {
      VALUES ?imdbId { ${values} }
      ?film wdt:P345 ?imdbId .
      ?film wdt:P31 wd:Q11424 .
      ?film p:P166 ?awardStatement .
      ?awardStatement ps:P166 ?award .
      ?award wdt:P31/wdt:P279* wd:Q19020 .
      ?awardStatement pq:P585 ?date .
      BIND(YEAR(?date) AS ?year)
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }
    ORDER BY ?imdbId ?year
  `;

  const url = 'https://query.wikidata.org/sparql?query=' +
    encodeURIComponent(sparql) + '&format=json';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Cine2Helper/1.0 (research tool)' }
  });
  if (!res.ok) {
    console.warn(`  Wikidata error ${res.status} — skipping batch`);
    return new Map();
  }
  const json = await res.json();

  // Group results by imdbId
  const results = new Map(); // imdbId -> [{ award, year }]
  for (const b of json.results.bindings) {
    const id    = b.imdbId.value;
    const award = b.awardLabel?.value ?? 'Unknown';
    const year  = b.year?.value ?? '?';
    if (!results.has(id)) results.set(id, []);
    results.get(id).push({ award, year });
  }
  return results;
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const lines = [];
  const log = (...args) => { console.log(...args); lines.push(args.join(' ')); };

  // Collect all unique films across all lists
  const allFilms = new Map(); // tmdbId -> { title, year, lists[] }
  for (const [listName, films] of Object.entries(LISTS)) {
    for (const film of films) {
      if (!allFilms.has(film.tmdbId)) {
        allFilms.set(film.tmdbId, { ...film, lists: [] });
      }
      allFilms.get(film.tmdbId).lists.push(listName);
    }
  }
  log(`Total unique films across all three lists: ${allFilms.size}`);

  // Step 1: Resolve all TMDB IDs to IMDB IDs
  log(`\nResolving IMDB IDs from TMDB (${allFilms.size} films)...`);
  const tmdbToImdb = new Map(); // tmdbId -> imdbId
  const imdbToTmdb = new Map(); // imdbId -> tmdbId
  let resolved = 0;
  for (const [tmdbId] of allFilms) {
    const imdbId = await getImdbId(tmdbId);
    if (imdbId) {
      tmdbToImdb.set(tmdbId, imdbId);
      imdbToTmdb.set(imdbId, tmdbId);
      resolved++;
    }
    if (resolved % 50 === 0) log(`  ...${resolved} resolved`);
    await sleep(120); // ~8 req/s, well within TMDB limits
  }
  log(`Resolved ${resolved} of ${allFilms.size} IMDB IDs`);

  // Step 2: Query Wikidata in batches of 50
  log(`\nQuerying Wikidata for Oscar wins (batches of 50)...`);
  const imdbIds = [...imdbToTmdb.keys()];
  const oscarResults = new Map(); // imdbId -> [{ award, year }]

  for (const batch of chunkArray(imdbIds, 50)) {
    const batchResults = await queryOscarWinsByImdbIds(batch);
    for (const [id, awards] of batchResults) {
      oscarResults.set(id, awards);
    }
    process.stdout.write('.');
    await sleep(800); // polite to Wikidata
  }
  log(`\nFound Oscar wins for ${oscarResults.size} films`);

  // Step 3: Build report
  log(`\n${'═'.repeat(60)}`);
  log(`RESULTS BY LIST`);
  log(`${'═'.repeat(60)}`);

  const alreadyInOscar   = []; // in both lists
  const missingFromOscar = []; // won Oscar but not in oscar-winners.ts

  for (const [listName, films] of Object.entries(LISTS)) {
    const winners = films.filter(f => {
      const imdbId = tmdbToImdb.get(f.tmdbId);
      return imdbId && oscarResults.has(imdbId);
    });

    log(`\n── ${listName} (${films.length} films, ${winners.length} Oscar winners) ──`);

    for (const film of winners) {
      const imdbId = tmdbToImdb.get(film.tmdbId);
      const awards = oscarResults.get(imdbId) ?? [];
      const inOscar = existingOscarIds.has(film.tmdbId);
      const cats = [...new Set(awards.map(a => a.award))].join('; ');

      if (inOscar) {
        log(`  ✓ [${film.year}] ${film.title}  (TMDB:${film.tmdbId})`);
        log(`       ${cats}`);
        alreadyInOscar.push({ ...film, listName, cats });
      } else {
        log(`  ✗ [${film.year}] ${film.title}  (TMDB:${film.tmdbId} / IMDB:${imdbId})`);
        log(`       ${cats}`);
        missingFromOscar.push({ ...film, listName, imdbId, cats });
      }
    }
  }

  // Summary
  log(`\n${'═'.repeat(60)}`);
  log(`SUMMARY`);
  log(`${'═'.repeat(60)}`);
  log(`Already in oscar-winners.ts: ${alreadyInOscar.length} films`);
  log(`Missing from oscar-winners.ts: ${missingFromOscar.length} films`);

  if (missingFromOscar.length > 0) {
    log(`\n${'═'.repeat(60)}`);
    log(`READY-TO-PASTE additions for oscar-winners.ts:`);
    log(`${'═'.repeat(60)}`);
    // Sort by year
    missingFromOscar.sort((a, b) => a.year - b.year);
    for (const f of missingFromOscar) {
      const tmdbTitleField = f.tmdbTitle ? `, tmdbTitle: '${f.tmdbTitle.replace(/'/g, "\\'")}'` : '';
      log(`  // ${f.listName} | ${f.cats}`);
      log(`  { tmdbId: ${f.tmdbId}, title: '${f.title.replace(/'/g, "\\'")}', year: ${f.year}${tmdbTitleField} },`);
    }
  }

  const outPath = path.join(__dirname, 'oscar-decade-genre-report.txt');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`\nReport written to scripts/oscar-decade-genre-report.txt`);
}

main().catch(e => { console.error(e); process.exit(1); });
