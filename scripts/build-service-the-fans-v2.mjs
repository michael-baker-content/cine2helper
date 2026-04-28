// build-service-the-fans-v2.mjs
// Extends v1 with sequel keyword (TMDB keyword ID 9717) to catch
// unnumbered sequels like The Dark Knight Rises, Creed, Fury Road etc.
// Only includes films in position 1-5 of their collection.
//
// Run: node build-service-the-fans-v2.mjs > service-v2.txt 2>progress-v2.txt

import { readFileSync } from 'fs';
import { join } from 'path';

const envPath = join(process.cwd(), '.env.local');
const envVars = readFileSync(envPath, 'utf8');
const tokenMatch = envVars.match(/TMDB_READ_ACCESS_TOKEN=(.+)/);
const TOKEN = tokenMatch?.[1]?.trim();
if (!TOKEN) { console.error('No token'); process.exit(1); }

const MIN_VOTES = 500;
const SEQUEL_KEYWORD_ID = 9717;

// Films already in our existing list — load their IDs to report new ones only
const EXISTING_IDS = new Set([
  24428,19995,293660,118340,671,1726,603,475557,120,284054,150540,284052,
  70160,315635,238,1771,272,10195,11,22,297761,105,354912,297762,102899,
  98,245891,557,12,346364,862,585,259316,8587,49051,24,694,9806,808,
  1930,198663,18785,269149,274,329,207703,109445,335983,324857,75656,
  299537,348,49521,20352,447332,920,78,297802,438631,607,12155,10528,
  1271,218,8966,10191,425,546554,277834,102651,85,157350,141,68726,
  70981,19908,72105,82690,61791,138843,9502,161,771,216015,23483,38757,
  562,1858,36657,8681,812,414906,953,578,411,310,8844,2080,854,293167,
  211672,64688,539,1593,9799,420818,10020,502356,405774,392044,13475,
  10674,602,454626,627,287947,2501,591,176,954,564,156022,124905,620,
  744,9659,391,646,121,68721,283995,10138,12445,383498,558,10193,
  122917,559,393,1895,863,1894,324552,280,102382,165,240,260513,809,
  131634,93456,458156,291805,196,45243,41154,608,772,301528,82702,
  330457,474350,155,299536,99861,76338,284053,135397,168259,49026,
  24429,209112,76341,315837,597,1726,321612,458423,429617,330459,
  675353,566525,447277,585511,447365,524434,616037,438631,545611,
  872585,507089,1022789,774752,823464,748783,934433,933260,1233413,
]);

async function tmdbGet(path, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: 'Bearer ' + TOKEN }
  });
  return res.json();
}

const collectionCache = new Map();
async function getCollection(id) {
  if (collectionCache.has(id)) return collectionCache.get(id);
  const col = await tmdbGet(`/collection/${id}`);
  collectionCache.set(id, col);
  await new Promise(r => setTimeout(r, 100));
  return col;
}

async function getCollectionPosition(collectionId, movieId) {
  const col = await getCollection(collectionId);
  const parts = (col.parts || [])
    .filter(p => p.release_date)
    .sort((a, b) => a.release_date.localeCompare(b.release_date));
  const idx = parts.findIndex(p => p.id === movieId);
  return idx === -1 ? null : idx + 1; // 1-based position
}

const newFilms = new Map();

// Discover films tagged with "sequel" keyword
console.error('Scanning sequel keyword films...');

for (let page = 1; page <= 15; page++) {
  const data = await tmdbGet('/discover/movie', {
    with_keywords: SEQUEL_KEYWORD_ID,
    'vote_count.gte': MIN_VOTES,
    sort_by: 'vote_count.desc',
    page,
    language: 'en-US',
  });

  if (!data.results?.length) break;

  for (const film of data.results) {
    if (EXISTING_IDS.has(film.id)) continue; // already in list

    // Get full details to check collection
    const detail = await tmdbGet(`/movie/${film.id}`);
    const collection = detail.belongs_to_collection;

    if (!collection) {
      // Tagged sequel but no collection — skip, can't verify position
      continue;
    }

    const position = await getCollectionPosition(collection.id, film.id);

    if (position === null || position > 5) {
      console.error(`  SKIP (position ${position}): ${film.title}`);
      continue;
    }

    newFilms.set(film.id, {
      id: film.id,
      title: film.title,
      year: film.release_date?.slice(0, 4) ?? '?',
      votes: film.vote_count,
      position,
      collection: collection.name,
    });

    console.error(`  ADD (pos ${position}): ${film.title} [${collection.name}]`);
    await new Promise(r => setTimeout(r, 100));
  }

  await new Promise(r => setTimeout(r, 200));
}

const sorted = [...newFilms.values()].sort((a, b) => b.votes - a.votes);

console.log(`\n=== NEW films via sequel keyword (not in existing list) ===`);
console.log(`Total: ${sorted.length}\n`);
for (const f of sorted) {
  console.log(`${f.id}\t${f.title}\t${f.year}\t${f.votes} votes\tpos-${f.position}\t${f.collection}`);
}
