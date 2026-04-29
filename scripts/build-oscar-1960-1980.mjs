// build-oscar-1960-1980.mjs
//
// Queries Wikidata for all films that won any Academy Award at ceremonies
// held between 1960 and 1980 (covering films from roughly 1959-1979).
// Resolves TMDB IDs via the /find endpoint using IMDB IDs.
// Cross-references against existing oscar-winners.ts to show what's new.
//
// Run: node scripts/build-oscar-1960-1980.mjs
// Requires TMDB_READ_ACCESS_TOKEN in .env.local
// Output: scripts/oscar-1960-1980-report.txt

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envSrc = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const TMDB_TOKEN = envSrc.match(/TMDB_READ_ACCESS_TOKEN=(.+)/)[1].trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Load existing TMDB IDs so we can flag what's already in the list
const oscarSrc = fs.readFileSync(
  path.join(__dirname, '..', 'lib', 'oscar-winners.ts'), 'utf8'
);
const existingIds = new Set(
  [...oscarSrc.matchAll(/tmdbId:\s*(\d+)/g)].map(m => parseInt(m[1]))
);
console.log(`Loaded ${existingIds.size} existing Oscar winner TMDB IDs`);

async function wikidataQuery(sparql) {
  const url = 'https://query.wikidata.org/sparql?query=' +
    encodeURIComponent(sparql) + '&format=json';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Cine2Helper/1.0 (oscar research tool)' }
  });
  if (!res.ok) throw new Error(`Wikidata ${res.status}`);
  const json = await res.json();
  return json.results.bindings;
}

async function findTmdbByImdb(imdbId) {
  const res = await fetch(
    `https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id`,
    { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.movie_results?.[0] ?? null;
}

async function main() {
  const lines = [];
  const log = (...args) => { console.log(...args); lines.push(args.join(' ')); };

  log('Querying Wikidata for Oscar-winning films 1960–1980...');

  // Query: films that won any Academy Award, ceremony year 1960-1980
  // P179 = part of series, Q19020 = Academy Award
  // We use ceremony year (when award was given) not film release year
  const sparql = `
    SELECT DISTINCT ?film ?filmLabel ?imdbId ?tmdbId ?year WHERE {
      ?film wdt:P31 wd:Q11424 .
      ?film p:P166 ?awardStatement .
      ?awardStatement ps:P166 ?award .
      ?award wdt:P31/wdt:P279* wd:Q19020 .
      ?awardStatement pq:P585 ?date .
      BIND(YEAR(?date) AS ?year)
      FILTER(?year >= 1960 && ?year <= 1981)
      OPTIONAL { ?film wdt:P345 ?imdbId }
      OPTIONAL { ?film wdt:P4947 ?tmdbId }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }
    ORDER BY ?year ?filmLabel
  `;

  const bindings = await wikidataQuery(sparql);
  log(`Wikidata returned ${bindings.length} records`);

  // Deduplicate by film
  const films = new Map(); // imdbId or title -> entry
  for (const b of bindings) {
    const title  = b.filmLabel?.value ?? 'Unknown';
    const imdbId = b.imdbId?.value ?? null;
    const tmdbId = b.tmdbId?.value ? parseInt(b.tmdbId.value) : null;
    const year   = parseInt(b.year?.value ?? '0');
    const key    = imdbId ?? title;

    if (!films.has(key)) {
      films.set(key, { title, imdbId, tmdbId, year });
    }
  }
  log(`Unique films: ${films.size}`);

  // Resolve TMDB IDs for films that don't have one from Wikidata
  log('\nResolving missing TMDB IDs...');
  let resolved = 0;
  for (const [, entry] of films) {
    if (!entry.tmdbId && entry.imdbId) {
      await sleep(200);
      const movie = await findTmdbByImdb(entry.imdbId);
      if (movie) {
        entry.tmdbId = movie.id;
        entry.tmdbTitle = movie.title;
        resolved++;
      }
    }
  }
  log(`Resolved ${resolved} additional TMDB IDs`);

  // Sort by year then title
  const sorted = [...films.values()].sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.title.localeCompare(b.title)
  );

  // Split into already-in-list vs new
  const alreadyIn = sorted.filter(f => f.tmdbId && existingIds.has(f.tmdbId));
  const newFilms  = sorted.filter(f => !f.tmdbId || !existingIds.has(f.tmdbId));
  const noTmdb    = newFilms.filter(f => !f.tmdbId);
  const toAdd     = newFilms.filter(f => f.tmdbId);

  log(`\n${'═'.repeat(60)}`);
  log(`ALREADY IN oscar-winners.ts: ${alreadyIn.length}`);
  for (const f of alreadyIn) {
    log(`  ✓ [${f.year}] ${f.title} (TMDB:${f.tmdbId})`);
  }

  log(`\nNEW — no TMDB ID found: ${noTmdb.length}`);
  for (const f of noTmdb) {
    log(`  ? [${f.year}] ${f.title} (IMDB:${f.imdbId ?? 'none'})`);
  }

  log(`\nNEW — ready to add: ${toAdd.length}`);
  for (const f of toAdd) {
    log(`  + [${f.year}] ${f.title} (TMDB:${f.tmdbId})`);
    if (f.tmdbTitle && f.tmdbTitle !== f.title) {
      log(`       TMDB title: ${f.tmdbTitle}`);
    }
  }

  log(`\n${'═'.repeat(60)}`);
  log(`READY-TO-PASTE for oscar-winners.ts (sorted by year):`);
  log(`${'═'.repeat(60)}`);

  // Group by year for easy insertion
  let currentYear = 0;
  for (const f of toAdd) {
    if (f.year !== currentYear) {
      currentYear = f.year;
      log(`\n  // ${f.year}`);
    }
    const titleField = f.title.replace(/'/g, "\\'");
    const tmdbTitleField = f.tmdbTitle && f.tmdbTitle !== f.title
      ? `, tmdbTitle: '${f.tmdbTitle.replace(/'/g, "\\'")}'`
      : '';
    log(`  { tmdbId: ${f.tmdbId}, title: '${titleField}', year: ${f.year}${tmdbTitleField} },`);
  }

  const outPath = path.join(__dirname, 'oscar-1960-1980-report.txt');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  log(`\nReport written to scripts/oscar-1960-1980-report.txt`);
}

main().catch(e => { console.error(e); process.exit(1); });
