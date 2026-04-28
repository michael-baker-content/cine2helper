import { readFileSync } from 'fs';
import { join } from 'path';

const envPath = join(process.cwd(), '.env.local');
const envVars = readFileSync(envPath, 'utf8');
const tokenMatch = envVars.match(/TMDB_READ_ACCESS_TOKEN=(.+)/);
const TOKEN = tokenMatch?.[1]?.trim();
if (!TOKEN) { console.error('No token'); process.exit(1); }

const films = [
  ['One Battle After Another',                    2025],
  ['Frankenstein',                                2025],
  ['Hamnet',                                      2025],
  ['Weapons',                                     2025],
  ['Sentimental Value',                           2025],
  ['F1',                                          2025],
  ['Avatar: Fire and Ash',                        2025],
  ['The Substance',                               2024],
  ["I'm Still Here",                              2024],
  ['A Real Pain',                                 2024],
  ['No Other Land',                               2024],
  ['The Boy and the Heron',                       2023],
  ['Godzilla Minus One',                          2023],
  ['20 Days in Mariupol',                         2023],
  ["Guillermo del Toro's Pinocchio",              2022],
  ['Navalny',                                     2022],
  ['RRR',                                         2022],
  ['Belfast',                                     2021],
  ['Cruella',                                     2021],
  ['Mank',                                        2020],
  ["Ma Rainey's Black Bottom",                    2020],
  ['Tenet',                                       2020],
  ['Bombshell',                                   2019],
  ['Rocketman',                                   2019],
  ['Vice',                                        2018],
  ['First Man',                                   2018],
  ['Phantom Thread',                              2017],
  ['I, Tonya',                                    2017],
  ['Icarus',                                      2017],
  ['Fantastic Beasts and Where to Find Them',     2016],
  ['The Jungle Book',                             2016],
  ['Suicide Squad',                               2016],
  ['Son of Saul',                                 2015],
  ['Ida',                                         2014],
  ['The Great Beauty',                            2013],
  ['20 Feet from Stardom',                        2013],
  ['Searching for Sugar Man',                     2012],
  ['Inside Job',                                  2010],
  ['The Secret in Their Eyes',                    2009],
  ['Man on Wire',                                 2008],
  ['La Vie en rose',                              2007],
  ['Sweeney Todd: The Demon Barber of Fleet Street', 2007],
  ['The Bourne Ultimatum',                        2007],
  ['The Counterfeiters',                          2007],
  ["Pan's Labyrinth",                             2006],
  ['Dreamgirls',                                  2006],
  ['An Inconvenient Truth',                       2006],
  ['The Queen',                                   2006],
  ['Letters from Iwo Jima',                       2006],
  ['Pirates of the Caribbean: Dead Man\'s Chest', 2006],
  ['The Last King of Scotland',                   2006],
  ['The Lives of Others',                         2006],
  ['Memoirs of a Geisha',                         2005],
  ['King Kong',                                   2005],
  ['The Constant Gardener',                       2005],
  ['Hustle & Flow',                               2005],
  ['Tsotsi',                                      2005],
  ['The Aviator',                                 2004],
  ['The Incredibles',                             2004],
  ['Finding Neverland',                           2004],
  ['The Sea Inside',                              2004],
  ['Born into Brothels',                          2004],
  ['Master and Commander: The Far Side of the World', 2003],
  ['Mystic River',                                2003],
  ['Cold Mountain',                               2003],
  ['Lost in Translation',                         2003],
  ['Finding Nemo',                                2003],
  ['The Barbarian Invasions',                     2003],
  ['The Fog of War',                              2003],
  ['The Pianist',                                 2002],
  ['Bowling for Columbine',                       2002],
  ["Monster's Ball",                              2001],
  ["No Man's Land",                               2001],
  ["Boys Don't Cry",                              1999],
  ['Tarzan',                                      1999],
  ['What Dreams May Come',                        1998],
  ['Independence Day',                            1996],
  ["Schindler's List",                            1993],
  ["Bram Stoker's Dracula",                       1992],
  ['Thelma & Louise',                             1991],
  ['Driving Miss Daisy',                          1989],
  ['Born on the Fourth of July',                  1989],
  ['My Left Foot',                                1989],
  ['Glory',                                       1989],
  ['The Little Mermaid',                          1989],
  ['Dead Poets Society',                          1989],
  ['Indiana Jones and the Last Crusade',          1989],
  ['Cinema Paradiso',                             1989],
  ['Batman',                                      1989],
  ['Rain Man',                                    1988],
  ['Dangerous Liaisons',                          1988],
  ['Who Framed Roger Rabbit',                     1988],
  ['Mississippi Burning',                         1988],
  ['Working Girl',                                1988],
  ['The Accidental Tourist',                      1988],
  ['A Fish Called Wanda',                         1988],
  ['Beetlejuice',                                 1988],
  ['The Last Emperor',                            1987],
  ['Moonstruck',                                  1987],
  ['Wall Street',                                 1987],
  ['Dirty Dancing',                               1987],
  ['Innerspace',                                  1987],
  ["Babette's Feast",                             1987],
  ["Sophie's Choice",                             1982],
  ["Coal Miner's Daughter",                       1980],
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
    const url2 = 'https://api.themoviedb.org/3/search/movie?query=' +
      encodeURIComponent(title) + '&language=en-US';
    const res2 = await fetch(url2, { headers: { Authorization: 'Bearer ' + TOKEN } });
    const data2 = await res2.json();
    const top2 = data2.results?.[0];
    if (top2) {
      console.log(top2.id + '\t' + top2.title + '\t' + (top2.release_date?.slice(0,4) ?? '?') + '\t' + title + '\t(no-year)');
    } else {
      console.log('NOT_FOUND\tNOT_FOUND\t' + year + '\t' + title);
    }
  }
  await new Promise(r => setTimeout(r, 150));
}

for (const [title, year] of films) {
  await lookup(title, year);
}
