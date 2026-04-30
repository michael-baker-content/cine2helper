// find-new-sequels.mjs
//
// Checks newly added decade-list films to identify which ones are sequels
// that should also appear in SERVICE_THE_FANS.
//
// Two detection methods:
//   1. TMDB collection data — checks if the film is in a collection and
//      what position it holds (positions 2-5 are sequels; position 1 is
//      the original, only included if the collection already has a sequel
//      in SERVICE_THE_FANS or the new list).
//   2. Title pattern matching — catches sequels TMDB doesn't tag or
//      put in collections (e.g. "Part II", "2", "III", "The Return of...")
//
// Output: ready-to-paste lines for lib/service-the-fans.ts
//
// Run: node scripts/find-new-sequels.mjs
// Requires TMDB_READ_ACCESS_TOKEN in .env.local

import { readFileSync } from 'fs';
import { join } from 'path';

const envPath = join(process.cwd(), '.env.local');
const envVars = readFileSync(envPath, 'utf8');
const tokenMatch = envVars.match(/TMDB_READ_ACCESS_TOKEN=(.+)/);
const TOKEN = tokenMatch?.[1]?.trim();
if (!TOKEN) { console.error('No TMDB_READ_ACCESS_TOKEN in .env.local'); process.exit(1); }

// ── All IDs already in SERVICE_THE_FANS ──────────────────────────────────────
// (copied from build-service-the-fans-v2.mjs EXISTING_IDS)

const EXISTING_SERVICE_IDS = new Set([
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

// ── Newly added IDs from the three decade lists ───────────────────────────────

const NEW_IDS = [
  // '80s Sci-Fi additions
  9531, 11336, 1694, 168, 10676, 11411, 172, 10658, 3980, 4437,
  11285, 11649, 9663, 11704, 9964, 9980, 10134, 15301, 11548, 11827,
  11495, 11542, 10344, 41428, 10540, 9651, 8738, 15239, 11966, 10176,
  10724, 849, 1857, 12120, 15762, 14372, 18502, 10127, 10017, 9872,
  11379, 11591, 12476, 17918, 33914, 10606, 18462, 7012, 2210, 28941,
  17835, 15158, 33518, 29787, 16248, 11333, 15035, 11607, 10128, 421467,
  328, 24739, 24099, 23730, 27814, 18289, 15668, 20874, 9507, 64131,
  31909, 15050, 18410, 29343, 20196, 15785, 33278, 19142, 28893, 15482,
  25834, 40095, 9063, 14460, 5677, 12921, 19761, 24194, 10179, 13766,
  28165, 39256, 26554, 19596, 42251, 19877, 28774, 43680, 22501, 5709,
  14571, 28319, 27150, 10001, 27072, 22572, 19184, 36349, 155, 21512,
  18252, 20043, 4296, 26883, 39916, 22500, 24749, 44932, 21259, 74747,
  31245, 26978, 83223, 20980, 150273, 21874, 73920, 40219, 58903, 49802,
  27786, 39868, 37433, 14916, 61755, 47340, 46364, 12472, 30194, 14443,
  3418, 20787, 111, 31127, 51259, 40059, 28370, 28223, 17421, 14132,
  23807, 39899, 43967, 39228, 33172, 87710, 26889, 16471, 42114, 48311,
  67221, 61968, 53150, 71933, 45937, 36677, 86, 45295, 29077, 47892,
  44801, 40222, 37843, 46188, 27380, 20894, 33155, 61904, 32148, 36832,
  54287, 31278, 22976, 84107, 48660, 38329, 42872, 32033, 27244, 66664,
  34028, 16157, 2265, 4365, 48490, 31397, 27462, 19736, 66881, 41972,
  40028, 26639, 24828, 81850, 40078, 39229, 204611, 44796, 40041, 107983,
  64789, 40026, 35642, 29345, 70500, 47822, 39230, 31769, 26873, 91691,
  82085, 49069, 29173, 17790, 185354, 69870, 22379, 7011, 69276, 40352,
  70358, 69152, 67642, 60591, 42033, 66045, 38849, 32014, 57949, 41243,
  161704, 73922, 38219, 32147, 28850, 14157, 97262, 73218, 69469, 52837,
  154738, 105927,
  // '90s Romance additions
  13, 597, 14919, 11982, 13313, 38366, 2687, 12158, 10154, 1641,
  11894, 18183, 823, 28032, 12157, 10533, 9715, 28384, 20235, 8067,
  11777, 236, 9079, 14249, 10442, 10390, 10407, 14709, 11198, 14283,
  10464, 9413, 2058, 11854, 11068, 15602, 14429, 1049, 25284, 10452,
  12618, 9096, 10951, 12187, 10210, 26748, 11498, 16562, 4507, 12538,
  10451, 10433, 9283, 9400, 9024, 12145, 2107, 25189, 10449, 31439,
  10409, 17894, 12220, 19286, 10908, 8866, 51980, 10938, 8217, 2149,
  10399, 17127, 10170, 2020, 4482, 12518, 10612, 10278, 1713, 9066,
  4823, 25095, 10445, 8986, 12186, 13345, 16992, 10333, 13203, 26338,
  14864, 12717, 9450, 21349, 8583, 26255, 9261, 3101, 23719, 10563,
  8291, 1414, 18203, 32669, 9452, 20024, 11363, 11853, 26333, 47002,
  37563, 21835, 1610, 12723, 4307, 16172, 10371, 36758, 15556, 8970,
  56374, 21539, 9287, 27381, 825, 18215, 58128, 47333, 12531, 60047,
  10635, 1413, 9302, 28387, 2731, 12772, 41659, 17993, 11796, 10879,
  10401, 7975, 12276, 31962, 48150, 40413, 40001, 12709, 2612, 24137,
  9308, 24070, 17915, 10486, 23606, 19552, 16980, 53168, 42884, 47104,
  22267, 2088, 2470, 17709, 1496, 31357, 10593, 37703, 11861, 48781,
  37975, 21210, 10467, 9089, 24584, 13986, 2611, 17589, 41804, 41003,
  28005, 26422, 20096, 15389, 55563, 11239, 12656, 19087, 15256, 10434,
  14398, 18417, 37185, 36094, 18801, 10241, 46717, 28213, 27098, 2625,
  46029, 34376, 24405, 37291, 16129, 28117, 16233, 50512, 22189, 10525,
  51300, 19601, 2817, 11876, 18392, 26949, 57834, 6463, 12251, 37718,
  17771, 40156, 28212, 27804, 10219, 2528, 18220, 22512, 17015, 26933,
  47090, 37636, 12652, 25147, 14667, 34444,
  // 2000s Horror additions
  13648, 10885, 3603, 13121, 6933, 13492, 8968, 8617, 15999, 13220,
  15356, 10012, 13008, 13022, 38410, 10577, 11908, 9592, 10894, 10375,
  10829, 9022, 12205, 10007, 23963, 27374, 24056, 246355, 5072, 27324,
  12142, 1977, 10093, 10727, 11348, 168705, 26688, 12526, 18476, 10070,
  9656, 10984, 11427, 2269, 10832, 9682, 10092, 7342, 12720, 14223,
  4241, 11058, 10008, 12597, 12212, 10891, 12192, 10961, 12590, 23988,
  10288, 3602, 9694, 10726, 9711, 10836, 21786, 14125, 10389, 15206,
  10253, 4283, 30974, 13613, 10384, 11056, 13009, 11059, 9997, 18238,
  10063, 21506, 28739, 1450, 12700, 16342, 33908, 9544, 14211, 14456,
  9456, 11429, 11246, 5857, 11217, 20606, 10213, 14138, 9666, 12699,
  14353, 37534, 13742, 13803, 23966, 13190, 17455, 7182, 919, 14863,
  16061, 10929, 1961, 10361, 12517, 10900, 23410, 15742, 14098, 19543,
  35626, 24001, 13059, 10075, 13564, 25853, 1698, 12619, 14397, 10391,
  14219, 9756, 10292, 32250, 9841, 30685, 12583, 6948, 15212, 1596,
  15641, 1872, 14913, 17, 8997, 12171, 10854, 10845, 16028, 13561,
  7006, 19592, 15440, 10263, 9782, 5956, 281, 9674, 16763, 14457,
  79896, 44351, 42968, 17911, 9017, 18011, 12591, 39436, 15741, 11366,
  9060, 17456, 13849, 11662, 26587, 24935, 17038, 10790, 16456, 10605,
  37973, 27297, 14458, 35831, 15262, 19166, 10706, 13548, 8991, 15667,
  15483, 15846, 17618, 12487, 22476, 572, 40723, 29979, 16077, 11494,
  13964, 10004, 19288, 12576, 24939, 4627, 18882, 16184, 18897, 3511,
  16440, 12483, 39468, 16921, 13094, 22007, 19599, 15069, 13557, 14126,
  23127, 10842, 25754, 28635, 25967, 21910, 16304, 13489, 19025, 10383,
  10085, 60086, 16764,
];

// ── Title pattern matching for sequence numbers ───────────────────────────────

// Returns a sequence number (1-5) if the title clearly indicates it,
// or null if no pattern matches.
function detectSequenceFromTitle(title) {
  const t = title.toLowerCase();

  // "Part X" or "Part N" patterns
  const partWord = t.match(/\bpart\s+(one|two|three|four|five|1|2|3|4|5)\b/);
  if (partWord) {
    const map = { one: 1, two: 2, three: 3, four: 4, five: 5,
                  '1': 1, '2': 2, '3': 3, '4': 4, '5': 5 };
    return map[partWord[1]] ?? null;
  }

  // Roman numerals at end of title: "Alien II", "Rocky III" etc.
  const roman = t.match(/\b(ii|iii|iv|v)\b(?:\s*[:–\-]|$)/);
  if (roman) {
    const map = { ii: 2, iii: 3, iv: 4, v: 5 };
    return map[roman[1]] ?? null;
  }

  // Arabic digit sequel: "Saw 2", "Critters 2", "Alien 3" etc.
  // Must be preceded by a word char (not be a year or standalone number)
  const arabic = t.match(/\b\w+\s+(2|3|4|5)\b(?:\s*[:–\-]|$)/);
  if (arabic) {
    return parseInt(arabic[1]);
  }

  // "2:" or "3:" at end of subtitle pattern: "Halloween III: ...", "Saw 3: ..."
  // Already caught above, but catch "Title 2: Subtitle" form
  const colonDigit = t.match(/:\s*(2|3|4|5)\b/);
  if (colonDigit) return parseInt(colonDigit[1]);

  // Written ordinals as sequel indicators
  if (t.includes(' two ') || t.endsWith(' two')) return 2;
  if (t.includes(' three ') || t.endsWith(' three')) return 3;

  // "Return of", "Revenge of", "Rise of" often signal a sequel
  // but we can't reliably assign a number — skip these

  return null;
}

// ── TMDB helpers ──────────────────────────────────────────────────────────────

async function tmdbGet(path, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url.toString(), {
    headers: { Authorization: 'Bearer ' + TOKEN }
  });
  if (!res.ok) return null;
  return res.json();
}

const collectionCache = new Map();
async function getCollectionPosition(collectionId, movieId) {
  if (!collectionCache.has(collectionId)) {
    const col = await tmdbGet(`/collection/${collectionId}`);
    collectionCache.set(collectionId, col);
    await new Promise(r => setTimeout(r, 100));
  }
  const col = collectionCache.get(collectionId);
  if (!col?.parts) return null;
  const parts = col.parts
    .filter(p => p.release_date)
    .sort((a, b) => a.release_date.localeCompare(b.release_date));
  const idx = parts.findIndex(p => p.id === movieId);
  return idx === -1 ? null : idx + 1;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const toAdd = [];
const skipped = [];
let processed = 0;

console.error(`Checking ${NEW_IDS.length} new IDs for sequel status...\n`);

for (const id of NEW_IDS) {
  // Skip if already in service-the-fans
  if (EXISTING_SERVICE_IDS.has(id)) continue;

  const detail = await tmdbGet(`/movie/${id}`);
  if (!detail?.id) {
    console.error(`  ✗ ${id}: not found on TMDB`);
    continue;
  }

  processed++;
  if (processed % 50 === 0) console.error(`  ...processed ${processed}`);

  let sequence = null;
  let method = '';

  // Method 1: TMDB collection position
  if (detail.belongs_to_collection) {
    const pos = await getCollectionPosition(detail.belongs_to_collection.id, id);
    if (pos !== null && pos >= 2 && pos <= 5) {
      sequence = pos;
      method = `TMDB collection pos ${pos} in "${detail.belongs_to_collection.name}"`;
    } else if (pos === 1) {
      // Position 1 = original film — only include if it has sequels
      // and isn't already covered. Skip for now; original films are
      // handled by the main service-the-fans build process.
      skipped.push({ id, title: detail.title, reason: `collection pos 1 (original)` });
      await new Promise(r => setTimeout(r, 50));
      continue;
    }
  }

  // Method 2: Title pattern (fallback or override)
  if (sequence === null) {
    const titleSeq = detectSequenceFromTitle(detail.title);
    if (titleSeq !== null) {
      sequence = titleSeq;
      method = `title pattern "${detail.title}"`;
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
    console.error(`  ✓ ADD seq-${sequence}: ${detail.title} (${method})`);
  }

  await new Promise(r => setTimeout(r, 100));
}

// ── Output ────────────────────────────────────────────────────────────────────

console.log(`\n// ── New SERVICE_THE_FANS entries from decade list additions ─────────────────`);
console.log(`// Add these to lib/service-the-fans.ts\n`);

if (toAdd.length === 0) {
  console.log('// No new sequel entries found.');
} else {
  toAdd.sort((a, b) => b.year - a.year || a.title.localeCompare(b.title));
  for (const f of toAdd) {
    const idPad   = String(f.id).padEnd(8);
    const titleQ  = JSON.stringify(f.title).padEnd(52);
    console.log(`  { tmdbId: ${idPad} title: ${titleQ} year: ${f.year}, sequence: ${f.sequence} }, // ${f.method}`);
  }
}

console.log(`\n// Total new entries: ${toAdd.length}`);
console.error(`\nDone. ${toAdd.length} entries to add, ${skipped.length} skipped.`);
