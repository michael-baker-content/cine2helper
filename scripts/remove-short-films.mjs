// remove-short-films.mjs
//
// Reads a TSV file of films to remove (produced by find-shortest-films.mjs)
// and removes each entry from the relevant data files.
//
// Run: node scripts/remove-short-films.mjs
// Place the TSV file at: scripts/remove-short-films.tsv
//
// After running, rebuild overlap index only:
//   npx tsx scripts/build-overlap-index.mjs
//
// Do NOT rebuild the movie cache after removals — the cache can safely
// contain extra films that are no longer in the condition lists.
// Only rebuild the cache when you have added new IDs to data files.

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// ── Load TSV ──────────────────────────────────────────────────────────────────

const tsvPath = resolve(__dirname, 'remove-short-films.tsv');
if (!existsSync(tsvPath)) {
  console.error(`TSV file not found at scripts/remove-short-films.tsv`);
  process.exit(1);
}

const raw = readFileSync(tsvPath);
let text = raw.toString('utf-8');
if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // strip BOM

const lines = text.split('\n')
  .map(l => l.replace(/\r/g, '').trim())
  .filter(l => l && !l.startsWith('RUNTIME') && !l.startsWith('0\t'));

const toRemove = lines.map(l => {
  const parts = l.split('\t');
  return {
    tmdbId:  parseInt(parts[1]?.trim()),
    title:   parts[2]?.trim(),
    sources: (parts[4]?.trim() ?? '').split(',').map(s => s.trim()).filter(Boolean),
  };
}).filter(f => !isNaN(f.tmdbId));

console.log(`Loaded ${toRemove.length} films to remove.\n`);

// ── File paths ────────────────────────────────────────────────────────────────

const FILES = {
  oscar:         resolve(projectRoot, 'lib/oscar-winners.ts'),
  service:       resolve(projectRoot, 'lib/service-the-fans.ts'),
  decade:        resolve(projectRoot, 'lib/decade-genre-lists.ts'),
  filmographies: resolve(projectRoot, 'lib/person-filmographies.ts'),
};

function getFilePath(source) {
  if (source === 'thank-the-academy') return FILES.oscar;
  if (source === 'service-the-fans')  return FILES.service;
  if (['scifi-80s', 'romance-90s', 'horror-2000s'].includes(source)) return FILES.decade;
  // All person and group conditions (person-*, join-*, sing-*, get-sentimental-*)
  return FILES.filmographies;
}

// ── Remove entry from file ────────────────────────────────────────────────────

function removeFromFile(filePath, tmdbId, label) {
  const content = readFileSync(filePath, 'utf-8');

  // Match a line containing this tmdbId as a complete number
  // Use a line-by-line approach for reliability
  const lines = content.split('\n');
  const pattern = new RegExp(`\\btmdbId:\\s*${tmdbId}\\b`);

  const filtered = lines.filter(line => !pattern.test(line));

  if (filtered.length === lines.length) {
    console.log(`  ⚠  ${label}: ID ${tmdbId} not found in ${filePath.split(/[/\\]/).pop()}`);
    return false;
  }

  const removed = lines.length - filtered.length;
  writeFileSync(filePath, filtered.join('\n'), 'utf-8');
  console.log(`  ✓  ${label}: removed ${removed} line(s) for ID ${tmdbId} from ${filePath.split(/[/\\]/).pop()}`);
  return true;
}

// ── Process each film ─────────────────────────────────────────────────────────

let totalRemoved = 0;
let totalNotFound = 0;

for (const film of toRemove) {
  console.log(`\n${film.title} (${film.tmdbId}):`);

  // Deduplicate by file path — only edit each file once per film
  const filePaths = new Map();
  for (const source of film.sources) {
    const fp = getFilePath(source);
    if (!filePaths.has(fp)) filePaths.set(fp, source);
  }

  for (const [fp, source] of filePaths) {
    const removed = removeFromFile(fp, film.tmdbId, source);
    if (removed) totalRemoved++;
    else totalNotFound++;
  }
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`Done. ${totalRemoved} entries removed, ${totalNotFound} not found.`);
console.log(`\nNext steps:`);
console.log(`  npx tsx scripts/build-overlap-index.mjs`);
console.log(`\nDo NOT rebuild the movie cache after removals.`);
console.log(`Only rebuild the cache when adding new IDs to data files.\n`);
