// remove-from-cache.mjs
//
// Removes specific film IDs from lib/movie-cache.ts based on a TSV file.
// Uses the same TSV format as remove-short-films.mjs.
//
// Run: node scripts/remove-from-cache.mjs
// Place the TSV file at: scripts/remove-short-films.tsv
//
// No rebuild needed after running this script — the cache is edited in place.

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
if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

const toRemove = new Set(
  text.split('\n')
    .map(l => l.replace(/\r/g, '').trim())
    .filter(l => l && !l.startsWith('RUNTIME'))
    .map(l => parseInt(l.split('\t')[1]?.trim()))
    .filter(id => !isNaN(id))
);

console.log(`IDs to remove from cache: ${toRemove.size}\n`);

// ── Edit movie-cache.ts line by line ──────────────────────────────────────────

const cachePath = resolve(projectRoot, 'lib/movie-cache.ts');
const content = readFileSync(cachePath, 'utf-8');
const lines = content.split('\n');

let removed = 0;
const filtered = lines.filter(line => {
  // Match cache entries like:  12345: { id: 12345, ...
  const match = line.match(/^\s+(\d+):\s*\{/);
  if (!match) return true;
  const id = parseInt(match[1]);
  if (toRemove.has(id)) {
    console.log(`  ✓ Removed ID ${id} from movie-cache.ts`);
    removed++;
    return false;
  }
  return true;
});

writeFileSync(cachePath, filtered.join('\n'), 'utf-8');

console.log(`\nDone. ${removed} entries removed from lib/movie-cache.ts.`);
if (toRemove.size - removed > 0) {
  console.log(`${toRemove.size - removed} IDs were not found in the cache (already absent).`);
}
console.log(`\nNo rebuild needed — the cache is already updated.\n`);
