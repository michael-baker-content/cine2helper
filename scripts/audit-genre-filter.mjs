// audit-genre-filter.mjs
//
// Checks what TMDB genre tags are on known false-positive entries,
// then audits all person filmography films to show which would be
// removed by filtering those genre IDs.
//
// Run: node scripts/audit-genre-filter.mjs
// Requires TMDB_READ_ACCESS_TOKEN in .env.local
// Output: scripts/genre-filter-audit.txt

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envSrc = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const TMDB_TOKEN = envSrc.match(/TMDB_READ_ACCESS_TOKEN=(.+)/)[1].trim();

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getMovie(tmdbId) {
  const res = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}`, {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}` }
  });
  if (!res.ok) return null;
  return res.json();
}

async function searchMovie(query) {
  const res = await fetch(
    `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}&language=en-US`,
    { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.[0] ?? null;
}

// Parse all tmdbIds from person-filmographies.ts
function parseFilmographyIds(src) {
  const films = [];
  for (const m of src.matchAll(/\{\s*tmdbId:\s*(\d+),\s*title:\s*'([^']+)'[^}]*year:\s*(\d+)/g)) {
    films.push({ tmdbId: parseInt(m[1]), title: m[2], year: parseInt(m[3]) });
  }
  return films;
}

async function main() {
  const lines = [];
  const log = (...args) => { console.log(...args); lines.push(args.join(' ')); };

  // ── Step 1: Check known false positives ────────────────────────────────────
  log('KNOWN FALSE POSITIVES — GENRE CHECK');
  log('═'.repeat(60));

  const falsePositives = [
    { query: 'Netflix Tudum 2025',             tmdbId: 1491034 },
    { query: 'Saving Our Selves BET COVID',    tmdbId: null    },
  ];

  const suspectGenreIds = new Set();

  for (const fp of falsePositives) {
    let movie = fp.tmdbId ? await getMovie(fp.tmdbId) : await searchMovie(fp.query);
    if (!movie) { log(`  NOT FOUND: ${fp.query}`); continue; }
    const genres = movie.genres ?? [];
    log(`\n  ${movie.title} (TMDB:${movie.id})`);
    log(`  Runtime: ${movie.runtime ?? 'null'} min`);
    log(`  Genres:  ${genres.map(g => `${g.name} (${g.id})`).join(', ') || 'none'}`);
    genres.forEach(g => suspectGenreIds.add(g.id));
    await sleep(300);
  }

  log(`\nSuspect genre IDs found on false positives: ${[...suspectGenreIds].join(', ')}`);

  if (suspectGenreIds.size === 0) {
    log('\nNo genre IDs to audit — false positives may have no genre tags.');
    fs.writeFileSync(path.join(__dirname, 'genre-filter-audit.txt'), lines.join('\n'));
    return;
  }

  // ── Step 2: Audit all filmography films against those genre IDs ────────────
  log('\n' + '═'.repeat(60));
  log('FILMOGRAPHY AUDIT — FILMS THAT WOULD BE REMOVED BY GENRE FILTER');
  log('═'.repeat(60));

  const filmSrc = fs.readFileSync(
    path.join(__dirname, '..', 'lib', 'person-filmographies.ts'), 'utf8'
  );
  const allFilms = parseFilmographyIds(filmSrc);
  const uniqueIds = [...new Set(allFilms.map(f => f.tmdbId))];
  log(`\nChecking ${uniqueIds.length} unique films from filmographies...`);

  const wouldRemove = [];
  const checked = [];

  for (let i = 0; i < uniqueIds.length; i++) {
    const tmdbId = uniqueIds[i];
    const film = allFilms.find(f => f.tmdbId === tmdbId);
    const movie = await getMovie(tmdbId);
    if (!movie) { await sleep(150); continue; }

    const genres = movie.genres ?? [];
    const matchedGenres = genres.filter(g => suspectGenreIds.has(g.id));

    if (matchedGenres.length > 0) {
      wouldRemove.push({
        tmdbId,
        title: movie.title,
        year: movie.release_date?.slice(0, 4),
        runtime: movie.runtime,
        genres: genres.map(g => g.name).join(', '),
        matchedGenres: matchedGenres.map(g => `${g.name} (${g.id})`).join(', '),
      });
    }

    checked.push(tmdbId);
    if ((i + 1) % 50 === 0) log(`  ...${i + 1}/${uniqueIds.length} checked`);
    await sleep(150);
  }

  log(`\nChecked ${checked.length} films.`);
  log(`Would remove: ${wouldRemove.length} films\n`);

  if (wouldRemove.length === 0) {
    log('✓ No legitimate films would be removed by this genre filter.');
  } else {
    log('Films that would be REMOVED:');
    for (const f of wouldRemove) {
      log(`  ✗ [${f.year}] ${f.title} (TMDB:${f.tmdbId}, runtime:${f.runtime}min)`);
      log(`       All genres:     ${f.genres}`);
      log(`       Matched genres: ${f.matchedGenres}`);
    }
  }

  const outPath = path.join(__dirname, 'genre-filter-audit.txt');
  fs.writeFileSync(outPath, lines.join('\n'));
  log(`\nReport written to scripts/genre-filter-audit.txt`);
}

main().catch(e => { console.error(e); process.exit(1); });
