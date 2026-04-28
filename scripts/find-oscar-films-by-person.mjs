// find-oscar-films-by-person.mjs
//
// For every person tracked in our win conditions, queries Wikidata for all
// films they've been involved with that won any Academy Award in any category.
// Cross-references against oscar-winners.ts to flag films we're missing.
// Finally resolves missing films to TMDB IDs via TMDB's /find endpoint.
//
// Run: node scripts/find-oscar-films-by-person.mjs
// Requires TMDB_READ_ACCESS_TOKEN in .env.local
// Output: scripts/oscar-by-person-report.txt
//
// Wikidata property reference:
//   P161  = cast member
//   P57   = director
//   P58   = screenwriter
//   P344  = director of photography
//   P86   = composer
//   P166  = award received
//   P31   = instance of
//   Q19020 = Academy Award (the award class)
//   P585  = point in time (ceremony date)
//   P345  = IMDB ID
//   P4947 = TMDB movie ID

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load .env.local ───────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env.local');
const env = fs.readFileSync(envPath, 'utf8');
const tokenMatch = env.match(/TMDB_READ_ACCESS_TOKEN=(.+)/);
if (!tokenMatch) { console.error('TMDB_READ_ACCESS_TOKEN not found in .env.local'); process.exit(1); }
const TMDB_TOKEN = tokenMatch[1].trim();

// ── People to check ───────────────────────────────────────────────────────────
const PEOPLE = [
  // Individual conditions
  { name: 'Amy Madigan',              tmdbId: 23882,   condition: 'person-amy-madigan' },
  { name: 'Emma Stone',               tmdbId: 54693,   condition: 'person-emma-stone' },
  { name: 'Ethan Hawke',              tmdbId: 569,     condition: 'person-ethan-hawke' },
  { name: 'Jacob Elordi',             tmdbId: 2034418, condition: 'person-jacob-elordi' },
  { name: 'Jessie Buckley',           tmdbId: 1498158, condition: 'person-jessie-buckley' },
  { name: 'Kate Hudson',              tmdbId: 11661,   condition: 'person-kate-hudson' },
  { name: 'Rose Byrne',               tmdbId: 9827,    condition: 'person-rose-byrne' },
  { name: 'Timothée Chalamet',        tmdbId: 1190668, condition: 'person-timothee-chalamet' },
  { name: 'Wagner Moura',             tmdbId: 52583,   condition: 'person-wagner-moura' },
  // join-the-revolution
  { name: 'Paul Thomas Anderson',     tmdbId: 4762,    condition: 'join-the-revolution' },
  { name: 'Leonardo DiCaprio',        tmdbId: 6193,    condition: 'join-the-revolution' },
  { name: 'Teyana Taylor',            tmdbId: 964679,  condition: 'join-the-revolution' },
  { name: 'Benicio Del Toro',         tmdbId: 1121,    condition: 'join-the-revolution' },
  { name: 'Sean Penn',                tmdbId: 2228,    condition: 'join-the-revolution' },
  { name: 'Regina Hall',              tmdbId: 35705,   condition: 'join-the-revolution' },
  // sing-the-blues
  { name: 'Ryan Coogler',             tmdbId: 1056121, condition: 'sing-the-blues' },
  { name: 'Michael B. Jordan',        tmdbId: 135651,  condition: 'sing-the-blues' },
  { name: 'Delroy Lindo',             tmdbId: 18792,   condition: 'sing-the-blues' },
  { name: 'Wunmi Mosaku',             tmdbId: 134774,  condition: 'sing-the-blues' },
  { name: 'Hailee Steinfeld',         tmdbId: 130640,  condition: 'sing-the-blues' },
  // get-sentimental
  { name: 'Joachim Trier',            tmdbId: 71609,   condition: 'get-sentimental' },
  { name: 'Renate Reinsve',           tmdbId: 1576786, condition: 'get-sentimental' },
  { name: 'Stellan Skarsgård',        tmdbId: 1640,    condition: 'get-sentimental' },
  { name: 'Elle Fanning',             tmdbId: 18050,   condition: 'get-sentimental' },
  { name: 'Inga Ibsdotter Lilleaas',  tmdbId: 1421850, condition: 'get-sentimental' },
];

// ── Existing oscar-winners TMDB IDs (to detect gaps) ─────────────────────────
// Paste updated list here by running: node scripts/find-oscar-films-by-person.mjs
// For bootstrapping, we load them dynamically from the ts file via regex
const oscarWinnersPath = path.join(__dirname, '..', 'lib', 'oscar-winners.ts');
const oscarWinnersSource = fs.readFileSync(oscarWinnersPath, 'utf8');
const existingTmdbIds = new Set(
  [...oscarWinnersSource.matchAll(/tmdbId:\s*(\d+)/g)].map(m => parseInt(m[1]))
);
console.log(`Loaded ${existingTmdbIds.size} existing Oscar winner TMDB IDs`);

// ── Helpers ───────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function wikidataQuery(sparql) {
  const url = 'https://query.wikidata.org/sparql?query=' + encodeURIComponent(sparql) +
    '&format=json';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Cine2Helper/1.0 (cine2helper research tool)' }
  });
  if (!res.ok) throw new Error(`Wikidata error ${res.status}`);
  const json = await res.json();
  return json.results.bindings;
}

async function getTmdbIdForPerson(tmdbId) {
  // Fetch IMDB ID from TMDB person endpoint
  const res = await fetch(`https://api.themoviedb.org/3/person/${tmdbId}/external_ids`, {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}` }
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.imdb_id ?? null;
}

async function findTmdbMovieByImdbId(imdbId) {
  const res = await fetch(
    `https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id`,
    { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.movie_results?.[0] ?? null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const lines = [];
  const log = (...args) => { console.log(...args); lines.push(args.join(' ')); };

  // Track all Oscar-winning films found across all people
  // Map: imdbId -> { title, year, categories, people, tmdbId? }
  const allOscarFilms = new Map();

  for (const person of PEOPLE) {
    log(`\n${'─'.repeat(60)}`);
    log(`${person.name}  (TMDB: ${person.tmdbId}, condition: ${person.condition})`);

    // Step 1: Get IMDB nconst for this person
    const imdbPersonId = await getTmdbIdForPerson(person.tmdbId);
    if (!imdbPersonId) {
      log(`  ✗ Could not resolve IMDB ID — skipping`);
      await sleep(300);
      continue;
    }
    log(`  IMDB ID: ${imdbPersonId}`);
    await sleep(300);

    // Step 2: Query Wikidata — films this person worked on that won an Oscar
    // We check all major crew/cast relationships
    const sparql = `
      SELECT DISTINCT ?film ?filmLabel ?imdbId ?tmdbId ?awardLabel ?year WHERE {
        ?person wdt:P345 "${imdbPersonId}" .
        {
          { ?film wdt:P161 ?person }  UNION
          { ?film wdt:P57  ?person }  UNION
          { ?film wdt:P58  ?person }  UNION
          { ?film wdt:P344 ?person }  UNION
          { ?film wdt:P86  ?person }
        }
        ?film wdt:P31 wd:Q11424 .
        ?film p:P166 ?awardStatement .
        ?awardStatement ps:P166 ?award .
        ?award wdt:P31/wdt:P279* wd:Q19020 .
        ?awardStatement pq:P585 ?date .
        BIND(YEAR(?date) AS ?year)
        OPTIONAL { ?film wdt:P345 ?imdbId }
        OPTIONAL { ?film wdt:P4947 ?tmdbId }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
      }
      ORDER BY ?year ?filmLabel
    `;

    let bindings;
    try {
      bindings = await wikidataQuery(sparql);
    } catch (e) {
      log(`  ✗ Wikidata query failed: ${e.message}`);
      await sleep(1000);
      continue;
    }

    if (bindings.length === 0) {
      log(`  No Oscar-winning films found on Wikidata`);
    } else {
      log(`  Found ${bindings.length} Oscar-winning film records`);
    }

    for (const b of bindings) {
      const filmLabel = b.filmLabel?.value ?? 'Unknown';
      const imdbId    = b.imdbId?.value ?? null;
      const tmdbId    = b.tmdbId?.value ? parseInt(b.tmdbId.value) : null;
      const award     = b.awardLabel?.value ?? 'Unknown award';
      const year      = b.year?.value ?? '?';
      const filmKey   = imdbId ?? filmLabel;

      if (!allOscarFilms.has(filmKey)) {
        allOscarFilms.set(filmKey, {
          title: filmLabel, year, imdbId, tmdbId,
          categories: new Set(), people: new Set()
        });
      }
      const entry = allOscarFilms.get(filmKey);
      entry.categories.add(award);
      entry.people.add(person.name);
    }

    await sleep(500); // be polite to Wikidata
  }

  // ── Resolve missing TMDB IDs ─────────────────────────────────────────────
  log(`\n${'═'.repeat(60)}`);
  log(`RESOLVING TMDB IDs FOR FILMS WITHOUT ONE...`);
  for (const [key, entry] of allOscarFilms) {
    if (!entry.tmdbId && entry.imdbId) {
      await sleep(250);
      const movie = await findTmdbMovieByImdbId(entry.imdbId);
      if (movie) {
        entry.tmdbId = movie.id;
        entry.tmdbTitle = movie.title;
      }
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────
  log(`\n${'═'.repeat(60)}`);
  log(`FULL RESULTS — ALL OSCAR-WINNING FILMS ACROSS ALL TRACKED PEOPLE`);
  log(`${'═'.repeat(60)}`);

  const inList = [];
  const missing = [];

  for (const [, entry] of [...allOscarFilms.entries()].sort((a, b) =>
    (a[1].year ?? '').localeCompare(b[1].year ?? '')
  )) {
    const inOscarList = entry.tmdbId && existingTmdbIds.has(entry.tmdbId);
    const row = {
      title: entry.title,
      year: entry.year,
      imdbId: entry.imdbId,
      tmdbId: entry.tmdbId,
      tmdbTitle: entry.tmdbTitle,
      categories: [...entry.categories].join('; '),
      people: [...entry.people].join(', '),
      inOscarList,
    };
    if (inOscarList) inList.push(row);
    else missing.push(row);
  }

  log(`\nIN oscar-winners.ts already: ${inList.length} films`);
  for (const r of inList) {
    log(`  ✓ [${r.year}] ${r.title}  (TMDB:${r.tmdbId})  — ${r.people}`);
  }

  log(`\nMISSING from oscar-winners.ts: ${missing.length} films`);
  for (const r of missing) {
    const tmdbStr = r.tmdbId ? `TMDB:${r.tmdbId}` : 'NO TMDB ID';
    const imdbStr = r.imdbId ? `IMDB:${r.imdbId}` : 'NO IMDB ID';
    log(`  ✗ [${r.year}] ${r.title}  (${tmdbStr} / ${imdbStr})`);
    log(`       Categories: ${r.categories}`);
    log(`       People:     ${r.people}`);
    if (r.tmdbTitle && r.tmdbTitle !== r.title) {
      log(`       TMDB title: ${r.tmdbTitle}`);
    }
  }

  log(`\n${'═'.repeat(60)}`);
  log(`READY-TO-PASTE additions for oscar-winners.ts:`);
  log(`${'═'.repeat(60)}`);
  for (const r of missing.filter(r => r.tmdbId)) {
    const titleField = r.tmdbTitle && r.tmdbTitle !== r.title
      ? `, tmdbTitle: '${r.tmdbTitle.replace(/'/g, "\\'")}'`
      : '';
    log(`  { tmdbId: ${r.tmdbId}, title: '${r.title.replace(/'/g, "\\'")}', year: ${r.year}${titleField} },`);
  }

  // ── Write report ─────────────────────────────────────────────────────────
  const outPath = path.join(__dirname, 'oscar-by-person-report.txt');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`\nReport written to scripts/oscar-by-person-report.txt`);
}

main().catch(e => { console.error(e); process.exit(1); });
