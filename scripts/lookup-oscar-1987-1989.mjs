import { readFileSync } from 'fs';
import { join } from 'path';

const envPath = join(process.cwd(), '.env.local');
const envVars = readFileSync(envPath, 'utf8');
const tokenMatch = envVars.match(/TMDB_READ_ACCESS_TOKEN=(.+)/);
const TOKEN = tokenMatch?.[1]?.trim();
if (!TOKEN) { console.error('No token'); process.exit(1); }

const films = [
  ['Driving Miss Daisy',            1989],
  ['Born on the Fourth of July',    1989],
  ['My Left Foot',                  1989],
  ['Glory',                         1989],
  ['The Little Mermaid',            1989],
  ['Dead Poets Society',            1989],
  ['Indiana Jones and the Last Crusade', 1989],
  ['Henry V',                       1989],
  ['Cinema Paradiso',               1989],
  ['Batman',                        1989],
  ['Rain Man',                      1988],
  ['Dangerous Liaisons',            1988],
  ['Who Framed Roger Rabbit',       1988],
  ['Mississippi Burning',           1988],
  ['Working Girl',                  1988],
  ['The Accidental Tourist',        1988],
  ['A Fish Called Wanda',           1988],
  ['Beetlejuice',                   1988],
  ['The Last Emperor',              1987],
  ['Moonstruck',                    1987],
  ['Wall Street',                   1987],
  ['Dirty Dancing',                 1987],
  ['Harry and the Hendersons',      1987],
  ['Innerspace',                    1987],
  ["Babette's Feast",               1987],
];

async function lookup(title, year) {
  const url = 'https://api.themoviedb.org/3/search/movie?query=' +
    encodeURIComponent(title) + '&year=' + year + '&language=en-US';
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + TOKEN } });
  const data = await res.json();
  const top = data.results?.[0];
  if (top) {
    console.log(top.id + '\t' + top.title + '\t' + (top.release_date?.slice(0,4) ?? '?') + '\t' + title);
  } else {
    console.log('NOT_FOUND\tNOT_FOUND\t' + year + '\t' + title);
  }
  await new Promise(r => setTimeout(r, 150));
}

for (const [title, year] of films) {
  await lookup(title, year);
}
