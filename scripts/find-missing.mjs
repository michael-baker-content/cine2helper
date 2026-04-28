// find-missing.mjs
// Queries TMDB discover for each decade+genre condition and reports
// films that meet the criteria but are NOT in our curated lists.
// Run: node find-missing.mjs
// Requires TMDB_READ_ACCESS_TOKEN in .env.local

import { readFileSync } from 'fs';
import { join } from 'path';

const envPath = join(process.cwd(), '.env.local');
const envVars = readFileSync(envPath, 'utf8');
const tokenMatch = envVars.match(/TMDB_READ_ACCESS_TOKEN=(.+)/);
const TOKEN = tokenMatch?.[1]?.trim();
if (!TOKEN) { console.error('No token'); process.exit(1); }

const CURATED = {
  'scifi-80s': new Set([
    957, 105, 149, 218, 78, 1091, 679, 1891, 865, 106,
    601, 1892, 9354, 2756, 8337, 841, 5548, 1103, 165, 11814,
    9426, 68, 860, 1648, 2614, 8810, 2605, 8536, 9314, 97,
    11884, 837, 14370, 10328, 3604, 36819, 11864, 11954, 154, 9355,
    9538, 10925, 13820, 16296, 9599, 157, 10122, 14510,
  ]),
  'romance-90s': new Set([
    4951, 9390, 76, 11003, 6435, 454, 2293, 251, 11970, 509,
    319, 4476, 796, 544, 4584, 6114, 297, 9820, 812, 9361,
    2898, 1443, 913, 712, 9489, 10020, 137, 9769, 858, 162,
    11104, 619, 409, 12106, 9464, 4478, 451, 12159, 11846, 10530,
    10314, 1389, 8874, 10436, 9454, 10215, 11220, 11971, 2064, 10207,
    2255, 9587, 795, 688, 1934, 1245, 18329, 110, 9434, 4806,
    713, 397, 19404, 9087, 18311, 2788, 10660, 11355, 11622, 9263,
    15080, 15804, 17474, 13701, 2767, 854, 114, 2105, 782, 9603,
    9732, 1587, 15969, 9327, 10603, 1844, 15789, 483, 6068, 9768,
    9441, 10402, 9356, 13761, 3036, 11000, 6520, 9294, 10897, 11259,
    10003, 11010, 547, 9560, 145, 38251, 10057, 1727, 10395, 9429,
    21057, 10326, 33689, 9591, 28260, 18937, 10497, 11673, 1439, 1075,
    14533, 10413, 10155, 1909, 11044, 10995, 16270, 11520, 11448, 6552,
    267, 2259, 7300, 9716, 11472, 2469, 11860, 9410, 4415, 11821,
    11012, 3573, 3784, 11364, 11066, 2124, 14553, 9304, 1968, 8293,
    11634, 4587, 15037, 10478, 2565, 9058, 36834,
  ]),
  'horror-2000s': new Set([
    170, 1562, 1576, 1933, 9392, 176, 561, 747, 588, 5876,
    19908, 19994, 9532, 9539, 8329, 1690, 13310, 924, 565, 13885,
    10665, 8922, 3021, 9792, 16871, 1255, 13812, 23827, 1433, 10226,
    285923, 9885, 9373, 46420, 1696, 2662, 9871, 215, 1970, 10972,
    8643, 6537, 13207, 4552, 22536, 13510, 9902, 4513, 10873, 2082,
    21208, 9707, 14451, 6312, 2046, 19898, 2655, 6466, 768, 11547,
    7131, 2675, 36586, 395, 214, 9358, 1577, 9533, 7737, 9286,
    36648, 663, 4234, 19912, 1992, 11917, 22804, 10066, 440, 26466,
    17609, 9645, 4970, 10320, 14001, 8814, 1248, 28355, 37169, 10065,
    9378, 9913, 8461, 1691, 10664, 23202, 13515, 326, 18405, 10781,
    6171, 11351, 11075, 11249, 11683, 11096, 9035, 8843, 4858, 21407,
    10294, 14254, 9793, 24150, 13186, 11470, 25769, 13788, 11152, 9890,
    9708, 11442, 17111, 8869, 14435, 34480, 23823, 1730, 10185, 2637,
    36419, 10016, 18781, 806, 11979, 10053, 9030, 83, 1975, 9009,
    9954, 11237, 9696, 9042, 8090, 8398, 11880, 19904, 11838, 13474,
    13312, 11531, 1683, 467, 9796, 11026, 13025, 11804, 9966, 25983,
    8555, 791, 10069,
  ]),
};

const CONDITIONS = [
  {
    id: 'scifi-80s',
    label: "'80s Sci-Fi",
    genreId: 878,
    dateGte: '1980-01-01',
    dateLte: '1989-12-31',
    minVotes: 500,
    pages: 8,
  },
  {
    id: 'romance-90s',
    label: "'90s Romance",
    genreId: 10749,
    dateGte: '1990-01-01',
    dateLte: '1999-12-31',
    minVotes: 500,
    pages: 8,
  },
  {
    id: 'horror-2000s',
    label: '2000s Horror',
    genreId: 27,
    dateGte: '2000-01-01',
    dateLte: '2009-12-31',
    minVotes: 500,
    pages: 8,
  },
];

async function discoverPage(genreId, dateGte, dateLte, minVotes, page) {
  const params = new URLSearchParams({
    with_genres: genreId,
    'primary_release_date.gte': dateGte,
    'primary_release_date.lte': dateLte,
    'vote_count.gte': minVotes,
    sort_by: 'vote_count.desc',
    page,
    language: 'en-US',
  });
  const url = `https://api.themoviedb.org/3/discover/movie?${params}`;
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + TOKEN } });
  return res.json();
}

for (const cond of CONDITIONS) {
  console.log(`\n=== ${cond.label} — films on TMDB not in our list ===`);
  const missing = [];

  for (let page = 1; page <= cond.pages; page++) {
    const data = await discoverPage(
      cond.genreId, cond.dateGte, cond.dateLte, cond.minVotes, page
    );
    for (const film of data.results || []) {
      if (!CURATED[cond.id].has(film.id)) {
        missing.push({
          id: film.id,
          title: film.title,
          year: film.release_date?.slice(0, 4),
          votes: film.vote_count,
          rating: film.vote_average.toFixed(1),
        });
      }
    }
    await new Promise(r => setTimeout(r, 200));
  }

  missing.sort((a, b) => b.votes - a.votes);

  console.log(`Found ${missing.length} films not in our list (min ${cond.minVotes} votes):\n`);
  for (const f of missing) {
    console.log(`${f.id}\t${f.title}\t${f.year}\t${f.votes} votes\t⭐${f.rating}`);
  }
}
