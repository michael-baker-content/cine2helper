// build-filmographies.mjs
// Fetches TMDB credits for every person in the win conditions,
// filters to Cine2Nerdle-relevant roles, and outputs one film list per person.
// Run: node build-filmographies.mjs > filmographies.txt
// Requires TMDB_READ_ACCESS_TOKEN in .env.local

import { readFileSync } from 'fs';
import { join } from 'path';

const envPath = join(process.cwd(), '.env.local');
const envVars = readFileSync(envPath, 'utf8');
const tokenMatch = envVars.match(/TMDB_READ_ACCESS_TOKEN=(.+)/);
const TOKEN = tokenMatch?.[1]?.trim();
if (!TOKEN) { console.error('No token'); process.exit(1); }

// Crew jobs that count as a qualifying connection in Cine2Nerdle
const QUALIFYING_JOBS = new Set([
  'Director',
  'Writer',
  'Screenplay',
  'Story',
  'Novel',
  'Original Story',
  'Screen Story',
  'Director of Photography',
  'Cinematography',
  'Original Music Composer',
  'Music',
  'Composer',
]);

const PEOPLE = [
  // Individual person conditions
  { id: 23882,   name: 'Amy Madigan',             conditionId: 'person-amy-madigan' },
  { id: 54693,   name: 'Emma Stone',              conditionId: 'person-emma-stone' },
  { id: 569,     name: 'Ethan Hawke',             conditionId: 'person-ethan-hawke' },
  { id: 2034418, name: 'Jacob Elordi',            conditionId: 'person-jacob-elordi' },
  { id: 1498158, name: 'Jessie Buckley',          conditionId: 'person-jessie-buckley' },
  { id: 11661,   name: 'Kate Hudson',             conditionId: 'person-kate-hudson' },
  { id: 9827,    name: 'Rose Byrne',              conditionId: 'person-rose-byrne' },
  { id: 1190668, name: 'Timothée Chalamet',       conditionId: 'person-timothee-chalamet' },
  { id: 52583,   name: 'Wagner Moura',            conditionId: 'person-wagner-moura' },
  // Join The Revolution
  { id: 4762,    name: 'Paul Thomas Anderson',    conditionId: 'join-the-revolution-pta' },
  { id: 6193,    name: 'Leonardo DiCaprio',       conditionId: 'join-the-revolution-dicaprio' },
  { id: 964679,  name: 'Teyana Taylor',           conditionId: 'join-the-revolution-teyana' },
  { id: 1121,    name: 'Benicio Del Toro',        conditionId: 'join-the-revolution-benicio' },
  { id: 2228,    name: 'Sean Penn',               conditionId: 'join-the-revolution-penn' },
  { id: 35705,   name: 'Regina Hall',             conditionId: 'join-the-revolution-hall' },
  // Sing The Blues
  { id: 1056121, name: 'Ryan Coogler',            conditionId: 'sing-the-blues-coogler' },
  { id: 135651,  name: 'Michael B. Jordan',       conditionId: 'sing-the-blues-jordan' },
  { id: 18792,   name: 'Delroy Lindo',            conditionId: 'sing-the-blues-lindo' },
  { id: 134774,  name: 'Wunmi Mosaku',            conditionId: 'sing-the-blues-mosaku' },
  { id: 130640,  name: 'Hailee Steinfeld',        conditionId: 'sing-the-blues-steinfeld' },
  // Get Sentimental
  { id: 71609,   name: 'Joachim Trier',           conditionId: 'get-sentimental-trier' },
  { id: 1576786, name: 'Renate Reinsve',          conditionId: 'get-sentimental-reinsve' },
  { id: 1640,    name: 'Stellan Skarsgård',       conditionId: 'get-sentimental-skarsgard' },
  { id: 18050,   name: 'Elle Fanning',            conditionId: 'get-sentimental-fanning' },
  { id: 1421850, name: 'Inga Ibsdotter Lilleaas', conditionId: 'get-sentimental-lilleaas' },
];

async function getCredits(personId) {
  const url = `https://api.themoviedb.org/3/person/${personId}/movie_credits?language=en-US`;
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + TOKEN } });
  return res.json();
}

for (const person of PEOPLE) {
  const credits = await getCredits(person.id);
  const seen = new Set();
  const films = [];

  // Cast credits (acting)
  for (const film of credits.cast || []) {
    if (!seen.has(film.id) && film.release_date) {
      seen.add(film.id);
      films.push({
        id: film.id,
        title: film.title,
        year: film.release_date.slice(0, 4),
        role: 'Actor',
        votes: film.vote_count,
      });
    }
  }

  // Crew credits (filtered to qualifying jobs)
  for (const film of credits.crew || []) {
    if (!QUALIFYING_JOBS.has(film.job)) continue;
    if (!film.release_date) continue;
    if (!seen.has(film.id)) {
      seen.add(film.id);
      films.push({
        id: film.id,
        title: film.title,
        year: film.release_date.slice(0, 4),
        role: film.job,
        votes: film.vote_count,
      });
    } else {
      // Already added via cast — note the additional crew role
      const existing = films.find(f => f.id === film.id);
      if (existing && existing.role === 'Actor') {
        existing.role = `Actor + ${film.job}`;
      }
    }
  }

  // Sort by vote count desc
  films.sort((a, b) => b.votes - a.votes);

  console.log(`\n=== ${person.name} (${person.conditionId}) ===`);
  console.log(`Total qualifying films: ${films.length}\n`);
  for (const f of films) {
    console.log(`${f.id}\t${f.title}\t${f.year}\t${f.votes} votes\t${f.role}`);
  }

  await new Promise(r => setTimeout(r, 250));
}
