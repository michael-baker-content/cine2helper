// build-service-the-fans-wikidata.mjs
//
// Uses Wikidata to:
// 1. For every film in service-the-fans.ts, look up its series and ordinal position
// 2. Find additional films in those same series that we may have missed
// 3. Output a CSV with tmdbId, title, year, seriesName, sequenceNum, source
//
// Run: node scripts/build-service-the-fans-wikidata.mjs
// Requires TMDB_READ_ACCESS_TOKEN in .env.local
// Output: scripts/service-the-fans-wikidata.csv
//         scripts/service-the-fans-wikidata-report.txt

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envSrc = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const TMDB_TOKEN = envSrc.match(/TMDB_READ_ACCESS_TOKEN=(.+)/)[1].trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Parse current service-the-fans.ts ────────────────────────────────────────
const src = fs.readFileSync(
  path.join(__dirname, '..', 'lib', 'service-the-fans.ts'), 'utf8'
);
const currentFilms = new Map(); // tmdbId -> { title, year }
for (const m of src.matchAll(/\{\s*tmdbId:\s*(\d+),\s*title:\s*'([^']+)',\s*year:\s*(\d+)\s*\}/g)) {
  currentFilms.set(parseInt(m[1]), { title: m[2], year: parseInt(m[3]) });
}
console.log(`Loaded ${currentFilms.size} films from service-the-fans.ts`);

// ── TMDB helpers ──────────────────────────────────────────────────────────────
const imdbCache = new Map(); // tmdbId -> imdbId

async function getImdbId(tmdbId) {
  if (imdbCache.has(tmdbId)) return imdbCache.get(tmdbId);
  await sleep(120);
  const res = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}/external_ids`, {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}` }
  });
  if (!res.ok) { imdbCache.set(tmdbId, null); return null; }
  const data = await res.json();
  const id = data.imdb_id ?? null;
  imdbCache.set(tmdbId, id);
  return id;
}

async function getTmdbByImdb(imdbId) {
  await sleep(120);
  const res = await fetch(
    `https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id`,
    { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.movie_results?.[0] ?? null;
}

async function getTmdbById(tmdbId) {
  await sleep(120);
  const res = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}`, {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}` }
  });
  if (!res.ok) return null;
  return res.json();
}

// ── Wikidata helpers ──────────────────────────────────────────────────────────
async function wikidataQuery(sparql) {
  const url = 'https://query.wikidata.org/sparql?query=' +
    encodeURIComponent(sparql) + '&format=json';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Cine2Helper/1.0 (series research)' }
  });
  if (!res.ok) throw new Error(`Wikidata ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.results.bindings;
}

// Get series info for a single film by IMDB ID
async function getSeriesForFilm(imdbId) {
  const sparql = `
    SELECT ?seriesLabel ?ordinal ?film ?filmLabel ?filmImdb WHERE {
      ?film wdt:P345 "${imdbId}" .
      ?film wdt:P179 ?series .
      OPTIONAL { ?film wdt:P1545 ?ordinal }
      OPTIONAL {
        ?seriesMember wdt:P179 ?series .
        ?seriesMember wdt:P345 ?filmImdb .
        BIND(?seriesMember AS ?film)
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }
  `;
  try {
    const bindings = await wikidataQuery(sparql);
    if (!bindings.length) return null;
    return {
      seriesLabel: bindings[0].seriesLabel?.value ?? null,
      ordinal: bindings[0].ordinal?.value ?? null,
    };
  } catch { return null; }
}

// Get ALL films in a series given one member's IMDB ID
async function getAllSeriesFilms(imdbId) {
  const sparql = `
    SELECT DISTINCT ?filmLabel ?filmImdb ?ordinal WHERE {
      ?anchor wdt:P345 "${imdbId}" .
      ?anchor wdt:P179 ?series .
      ?member wdt:P179 ?series .
      ?member wdt:P31 wd:Q11424 .
      OPTIONAL { ?member wdt:P345 ?filmImdb }
      OPTIONAL { ?member wdt:P1545 ?ordinal }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }
    ORDER BY ?ordinal
  `;
  try {
    return await wikidataQuery(sparql);
  } catch { return []; }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const lines = [];
  const log = (...args) => { console.log(...args); lines.push(args.join(' ')); };

  // Results map: tmdbId -> { title, year, seriesName, sequenceNum, source, inCurrent }
  const results = new Map();
  const processedSeries = new Set(); // track series we've already fully expanded

  const tmdbIds = [...currentFilms.keys()];
  log(`Processing ${tmdbIds.length} films...`);

  for (let i = 0; i < tmdbIds.length; i++) {
    const tmdbId = tmdbIds[i];
    const film = currentFilms.get(tmdbId);

    if ((i + 1) % 50 === 0) log(`  ...${i + 1}/${tmdbIds.length}`);

    // Get IMDB ID
    const imdbId = await getImdbId(tmdbId);
    if (!imdbId) {
      results.set(tmdbId, {
        ...film, tmdbId, seriesName: '', sequenceNum: '', source: 'no-imdb', inCurrent: true
      });
      continue;
    }

    // Get series info + all members from Wikidata
    const seriesKey = imdbId;
    const allMembers = await getAllSeriesFilms(imdbId);
    await sleep(400);

    if (!allMembers.length) {
      results.set(tmdbId, {
        ...film, tmdbId, seriesName: '', sequenceNum: '', source: 'no-series', inCurrent: true
      });
      continue;
    }

    // Get series name from first result that has one
    const seriesNameBinding = allMembers.find(b => b.filmLabel?.value);

    // Re-query for series label
    const seriesInfoSparql = `
      SELECT ?seriesLabel ?ordinal WHERE {
        ?film wdt:P345 "${imdbId}" .
        ?film wdt:P179 ?series .
        OPTIONAL { ?film wdt:P1545 ?ordinal }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
      } LIMIT 1
    `;
    let seriesName = '';
    let thisOrdinal = '';
    try {
      const sInfo = await wikidataQuery(seriesInfoSparql);
      await sleep(300);
      if (sInfo.length) {
        seriesName = sInfo[0].seriesLabel?.value ?? '';
        thisOrdinal = sInfo[0].ordinal?.value ?? '';
      }
    } catch {}

    // Mark current film
    results.set(tmdbId, {
      ...film, tmdbId, seriesName,
      sequenceNum: thisOrdinal,
      source: thisOrdinal ? 'wikidata-ordinal' : 'wikidata-series',
      inCurrent: true
    });

    // Skip full series expansion if we've seen this series
    if (processedSeries.has(seriesName)) continue;
    processedSeries.add(seriesName);

    // Expand: find all series members, check if any are new
    for (const b of allMembers) {
      const memberImdb = b.filmImdb?.value;
      const memberOrdinal = b.ordinal?.value ?? '';
      if (!memberImdb || memberImdb === imdbId) continue;

      // Check if we already have this film by IMDB->TMDB lookup
      const memberTmdb = await getTmdbByImdb(memberImdb);
      if (!memberTmdb) continue;

      const memberId = memberTmdb.id;
      const memberYear = memberTmdb.release_date?.slice(0, 4)
        ? parseInt(memberTmdb.release_date.slice(0, 4)) : 0;

      // Only include parts 1-5
      const ordinalNum = parseInt(memberOrdinal);
      if (memberOrdinal && (ordinalNum < 1 || ordinalNum > 5)) continue;
      // Skip future films
      const today = new Date().toISOString().slice(0, 10);
      if (memberTmdb.release_date && memberTmdb.release_date > today) continue;

      if (!results.has(memberId)) {
        results.set(memberId, {
          title: memberTmdb.title,
          year: memberYear,
          tmdbId: memberId,
          seriesName,
          sequenceNum: memberOrdinal,
          source: memberOrdinal ? 'wikidata-ordinal' : 'wikidata-series',
          inCurrent: false, // NEW film not in current list
        });
      } else if (!results.get(memberId).sequenceNum && memberOrdinal) {
        // Update with ordinal if we now have one
        results.get(memberId).sequenceNum = memberOrdinal;
        results.get(memberId).source = 'wikidata-ordinal';
      }
    }
  }

  // ── Reports ───────────────────────────────────────────────────────────────
  const all = [...results.values()].sort((a, b) =>
    (a.seriesName || 'zzz').localeCompare(b.seriesName || 'zzz') ||
    parseInt(a.sequenceNum || '99') - parseInt(b.sequenceNum || '99')
  );

  const newFilms = all.filter(f => !f.inCurrent);
  const withOrdinal = all.filter(f => f.inCurrent && f.sequenceNum);
  const withoutOrdinal = all.filter(f => f.inCurrent && !f.sequenceNum);

  log(`\n${'═'.repeat(60)}`);
  log(`SUMMARY`);
  log(`${'═'.repeat(60)}`);
  log(`Current films with sequence number: ${withOrdinal.length}`);
  log(`Current films without sequence number: ${withoutOrdinal.length}`);
  log(`NEW films found in same series: ${newFilms.length}`);

  if (newFilms.length) {
    log(`\nNEW FILMS TO CONSIDER ADDING:`);
    for (const f of newFilms.sort((a,b) => (a.seriesName||'').localeCompare(b.seriesName||''))) {
      log(`  + [${f.year}] ${f.title} (TMDB:${f.tmdbId}) — ${f.seriesName} #${f.sequenceNum||'?'}`);
    }
  }

  // ── Write CSV ─────────────────────────────────────────────────────────────
  const esc = v => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const header = 'tmdbId,title,year,sequence,seriesName,source,inCurrentList';
  const rows = all.map(f =>
    [f.tmdbId, f.title, f.year, f.sequenceNum, f.seriesName, f.source, f.inCurrent ? 'yes' : 'NO-NEW']
      .map(esc).join(',')
  );

  const csvPath = path.join(__dirname, 'service-the-fans-wikidata.csv');
  fs.writeFileSync(csvPath, [header, ...rows].join('\n'), 'utf8');
  log(`\nCSV written to scripts/service-the-fans-wikidata.csv`);

  const txtPath = path.join(__dirname, 'service-the-fans-wikidata-report.txt');
  fs.writeFileSync(txtPath, lines.join('\n'), 'utf8');
  log(`Report written to scripts/service-the-fans-wikidata-report.txt`);
}

main().catch(e => { console.error(e); process.exit(1); });
