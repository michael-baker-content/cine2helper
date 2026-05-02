// sort-oscar-winners.mjs
//
// Reads lib/oscar-winners.ts, sorts the OSCAR_WINNERS array by year
// descending (newest first), removes year comments, deduplicates by
// tmdbId, and writes the result back to the file.
//
// Run: node scripts/sort-oscar-winners.mjs
// No TMDB calls — purely a static file operation.

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const filePath = resolve(projectRoot, 'lib', 'oscar-winners.ts');

const source = readFileSync(filePath, 'utf-8');

// ── Extract the array contents ────────────────────────────────────────────────

const arrayStart = source.indexOf('export const OSCAR_WINNERS: OscarWinner[] = [');
const arrayEnd   = source.lastIndexOf('];');

if (arrayStart === -1 || arrayEnd === -1) {
  console.error('Could not locate OSCAR_WINNERS array in file.');
  process.exit(1);
}

const before = source.slice(0, arrayStart);
const after  = source.slice(arrayEnd + 2); // "];".length === 2

const arrayBody = source.slice(
  arrayStart + 'export const OSCAR_WINNERS: OscarWinner[] = ['.length,
  arrayEnd
);

// ── Parse individual entries ──────────────────────────────────────────────────
// Each entry looks like:
//   { tmdbId: 665, title: 'Ben-Hur', year: 1960 },
//   { tmdbId: 665, title: 'Ben-Hur', year: 1960, tmdbTitle: 'Ben-Hur (1959)' },

const entryRegex = /\{\s*tmdbId:\s*(\d+),\s*title:\s*(?:'([^']*)'|"([^"]*)")\s*,\s*year:\s*(\d+)(?:\s*,\s*tmdbTitle:\s*(?:'([^']*)'|"([^"]*)"))?[^}]*\}/g;

const entries = [];
let match;

while ((match = entryRegex.exec(arrayBody)) !== null) {
  const tmdbId    = parseInt(match[1]);
  const title     = match[2] ?? match[3]; // single or double quoted
  const year      = parseInt(match[4]);
  const tmdbTitle = match[5] ?? match[6] ?? null;
  entries.push({ tmdbId, title, year, tmdbTitle });
}

console.log(`Parsed ${entries.length} entries`);

// ── Deduplicate by tmdbId ─────────────────────────────────────────────────────

const seen = new Set();
const deduped = entries.filter(e => {
  if (seen.has(e.tmdbId)) return false;
  seen.add(e.tmdbId);
  return true;
});

const removed = entries.length - deduped.length;
if (removed > 0) console.log(`Removed ${removed} duplicate entries`);

// ── Sort by year descending, then title ascending ─────────────────────────────

deduped.sort((a, b) => b.year - a.year || a.title.localeCompare(b.title));

// ── Serialise entries ─────────────────────────────────────────────────────────

function escapeTitle(t) {
  // Use double quotes if title contains a single quote, otherwise single quotes
  if (t.includes("'")) return `"${t}"`;
  return `'${t}'`;
}

const lines = deduped.map(e => {
  const idStr    = String(e.tmdbId).padEnd(7);
  const titleStr = escapeTitle(e.title);
  const base     = `  { tmdbId: ${idStr}, title: ${titleStr}, year: ${e.year} }`;
  if (e.tmdbTitle) {
    return `  { tmdbId: ${idStr}, title: ${titleStr}, year: ${e.year}, tmdbTitle: ${escapeTitle(e.tmdbTitle)} }`;
  }
  return base;
});

// ── Rebuild the file ──────────────────────────────────────────────────────────

const newArrayBody = '\n' + lines.join(',\n') + ',\n';

const newSource =
  before +
  'export const OSCAR_WINNERS: OscarWinner[] = [' +
  newArrayBody +
  '];' +
  after;

writeFileSync(filePath, newSource, 'utf-8');

console.log(`Done. ${deduped.length} entries written to lib/oscar-winners.ts, sorted by year descending.`);
