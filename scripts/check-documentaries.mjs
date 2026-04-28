import { readFileSync } from 'fs';
import { join } from 'path';

const envPath = join(process.cwd(), '.env.local');
const envVars = readFileSync(envPath, 'utf8');
const tokenMatch = envVars.match(/TMDB_READ_ACCESS_TOKEN=(.+)/);
const TOKEN = tokenMatch?.[1]?.trim();
if (!TOKEN) { console.error('No token'); process.exit(1); }

// Extract all unique tmdbIds from person-filmographies.ts
const filmo = readFileSync(
  join(process.cwd(), 'lib/person-filmographies.ts'), 'utf8'
);

const idTitlePairs = [];
const regex = /tmdbId:\s*(\d+),\s*title:\s*['"]([^'"]+)['"]/g;
let match;
while ((match = regex.exec(filmo)) !== null) {
  idTitlePairs.push({ id: parseInt(match[1]), title: match[2] });
}

// Deduplicate
const unique = [...new Map(idTitlePairs.map(f => [f.id, f])).values()];
console.error(`Checking ${unique.length} unique films...`);

const docs = [];

for (let i = 0; i < unique.length; i += 20) {
  const batch = unique.slice(i, i + 20);
  await Promise.all(batch.map(async (film) => {
    const url = `https://api.themoviedb.org/3/movie/${film.id}?language=en-US`;
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + TOKEN } });
    if (!res.ok) return;
    const data = await res.json();
    const genres = (data.genres || []).map(g => g.name);
    if (genres.includes('Documentary')) {
      docs.push({ id: film.id, title: film.title, genres: genres.join(', ') });
    }
  }));
  await new Promise(r => setTimeout(r, 200));
}

console.log(`\nDocumentaries found: ${docs.length}`);
for (const d of docs) {
  console.log(`${d.id}\t${d.title}\t${d.genres}`);
}
