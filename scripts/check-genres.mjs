// check-genres.mjs
// Checks that every film in a curated list has the expected TMDB genre.
// Run: node check-genres.mjs
// Requires TMDB_READ_ACCESS_TOKEN in .env.local

import { readFileSync } from 'fs';
import { join } from 'path';

const envPath = join(process.cwd(), '.env.local');
const envVars = readFileSync(envPath, 'utf8');
const tokenMatch = envVars.match(/TMDB_READ_ACCESS_TOKEN=(.+)/);
const TOKEN = tokenMatch?.[1]?.trim();
if (!TOKEN) { console.error('No token'); process.exit(1); }

const GENRE_IDS = {
  'Science Fiction': 878,
  'Horror': 27,
  'Romance': 10749,
};

const LISTS = {
  'romance-90s': {
    genre: 'Romance',
    films: [
      { tmdbId: 4951, title: '10 Things I Hate About You' },
      { tmdbId: 402, title: 'Basic Instinct' },
      { tmdbId: 9390, title: 'Jerry Maguire' },
      { tmdbId: 76, title: 'Before Sunrise' },
      { tmdbId: 11003, title: 'The Wedding Singer' },
      { tmdbId: 6435, title: 'Practical Magic' },
      { tmdbId: 454, title: 'Romeo + Juliet' },
      { tmdbId: 2293, title: 'Mallrats' },
      { tmdbId: 251, title: 'Ghost' },
      { tmdbId: 2277, title: 'Bicentennial Man' },
      { tmdbId: 11970, title: 'Hercules' },
      { tmdbId: 509, title: 'Notting Hill' },
      { tmdbId: 319, title: 'True Romance' },
      { tmdbId: 4476, title: 'Legends of the Fall' },
      { tmdbId: 796, title: 'Cruel Intentions' },
      { tmdbId: 544, title: 'There' },
      { tmdbId: 4584, title: 'Sense and Sensibility' },
      { tmdbId: 297, title: 'Meet Joe Black' },
      { tmdbId: 9820, title: 'The Parent Trap' },
      { tmdbId: 4032, title: 'My Girl' },
      { tmdbId: 812, title: 'Aladdin' },
      { tmdbId: 9361, title: 'The Last of the Mohicans' },
      { tmdbId: 2898, title: 'As Good as It Gets' },
      { tmdbId: 1443, title: 'The Virgin Suicides' },
      { tmdbId: 913, title: 'The Thomas Crown Affair' },
      { tmdbId: 712, title: 'Four Weddings and a Funeral' },
      { tmdbId: 9489, title: 'You' },
      { tmdbId: 10020, title: 'Beauty and the Beast' },
      { tmdbId: 137, title: 'Groundhog Day' },
      { tmdbId: 9769, title: 'Lolita' },
      { tmdbId: 13531, title: 'Empire Records' },
      { tmdbId: 858, title: 'Sleepless in Seattle' },
      { tmdbId: 162, title: 'Edward Scissorhands' },
      { tmdbId: 8367, title: 'Robin Hood: Prince of Thieves' },
      { tmdbId: 11104, title: 'Chungking Express' },
      { tmdbId: 241, title: 'Natural Born Killers' },
      { tmdbId: 619, title: 'The Bodyguard' },
      { tmdbId: 409, title: 'The English Patient' },
      { tmdbId: 12106, title: 'The Quick and the Dead' },
      { tmdbId: 1715, title: 'The Cider House Rules' },
      { tmdbId: 9444, title: 'Anastasia' },
      { tmdbId: 9464, title: 'Buffalo ' },
      { tmdbId: 4478, title: 'Indecent Proposal' },
      { tmdbId: 9342, title: 'The Mask of Zorro' },
      { tmdbId: 8005, title: 'Robin Hood: Men in Tights' },
      { tmdbId: 451, title: 'Leaving Las Vegas' },
      { tmdbId: 10312, title: 'Patch Adams' },
      { tmdbId: 12159, title: 'What Dreams May Come' },
      { tmdbId: 11846, title: 'Father of the Bride' },
      { tmdbId: 10530, title: 'Pocahontas' },
      { tmdbId: 10314, title: 'She' },
      { tmdbId: 1389, title: 'Out of Sight' },
      { tmdbId: 8874, title: 'My Best Friend' },
      { tmdbId: 10436, title: 'The Age of Innocence' },
      { tmdbId: 10215, title: 'Sliding Doors' },
      { tmdbId: 11220, title: 'Fallen Angels' },
      { tmdbId: 11971, title: 'Much Ado About Nothing' },
      { tmdbId: 2064, title: 'While You Were Sleeping' },
      { tmdbId: 10207, title: 'Message in a Bottle' },
      { tmdbId: 2255, title: 'Chasing Amy' },
      { tmdbId: 11386, title: 'The Crying Game' },
      { tmdbId: 9587, title: 'Little Women' },
      { tmdbId: 795, title: 'City of Angels' },
      { tmdbId: 688, title: 'The Bridges of Madison County' },
      { tmdbId: 1934, title: 'Shakespeare in Love' },
      { tmdbId: 11545, title: 'Rushmore' },
      { tmdbId: 37797, title: 'Whisper of the Heart' },
      { tmdbId: 108, title: 'Three Colors: Blue' },
      { tmdbId: 1245, title: 'The Remains of the Day' },
      { tmdbId: 18329, title: 'Happy Together' },
      { tmdbId: 226, title: 'Boys Don' },
      { tmdbId: 110, title: 'Three Colors: Red' },
      { tmdbId: 10997, title: 'Farewell My Concubine' },
      { tmdbId: 9434, title: 'Grosse Pointe Blank' },
      { tmdbId: 4806, title: 'Runaway Bride' },
      { tmdbId: 713, title: 'The Piano' },
      { tmdbId: 4104, title: 'Benny & Joon' },
      { tmdbId: 10404, title: 'Raise the Red Lantern' },
      { tmdbId: 10376, title: 'The Legend of 1900' },
      { tmdbId: 397, title: 'French Kiss' },
      { tmdbId: 19404, title: 'Dilwale Dulhania Le Jayenge' },
      { tmdbId: 9087, title: 'The American President' },
      { tmdbId: 18311, title: 'Days of Being Wild' },
      { tmdbId: 2788, title: 'Reality Bites' },
      { tmdbId: 10660, title: 'It Could Happen to You' },
      { tmdbId: 11355, title: 'Never Been Kissed' },
      { tmdbId: 11622, title: 'Blast from the Past' },
      { tmdbId: 10545, title: 'The Hunchback of Notre Dame' },
      { tmdbId: 9263, title: 'Now and Then' },
      { tmdbId: 109, title: 'Three Colors: White' },
      { tmdbId: 15080, title: 'Only Yesterday' },
      { tmdbId: 5910, title: 'Fireworks' },
      { tmdbId: 15804, title: 'A Brighter Summer Day' },
      { tmdbId: 17474, title: 'The Man in the Moon' },
      { tmdbId: 13701, title: 'Immortal Beloved' },
      { tmdbId: 2767, title: 'The Lovers on the Bridge' }
    ]
  },
  'horror-2000s': {
    genre: 'Horror',
    films: [
      { tmdbId: 170, title: '28 Days Later' },
      { tmdbId: 1359, title: 'American Psycho' },
      { tmdbId: 1562, title: '28 Weeks Later' },
      { tmdbId: 1576, title: 'Resident Evil' },
      { tmdbId: 1933, title: 'The Others' },
      { tmdbId: 9392, title: 'The Descent' },
      { tmdbId: 176, title: 'Saw' },
      { tmdbId: 561, title: 'Constantine' },
      { tmdbId: 747, title: 'Shaun of the Dead' },
      { tmdbId: 588, title: 'Silent Hill' },
      { tmdbId: 5876, title: 'The Mist' },
      { tmdbId: 19908, title: 'Zombieland' },
      { tmdbId: 19994, title: 'Jennifer' },
      { tmdbId: 9532, title: 'Final Destination' },
      { tmdbId: 9539, title: 'Martyrs' },
      { tmdbId: 6479, title: 'I Am Legend' },
      { tmdbId: 7191, title: 'Cloverfield' },
      { tmdbId: 8329, title: '[REC]' },
      { tmdbId: 1690, title: 'Hostel' },
      { tmdbId: 13310, title: 'Let the Right One In' },
      { tmdbId: 924, title: 'Dawn of the Dead' },
      { tmdbId: 565, title: 'The Ring' },
      { tmdbId: 13885, title: 'Sweeney Todd: The Demon Barber of Fleet Street' },
      { tmdbId: 1487, title: 'Hellboy' },
      { tmdbId: 10665, title: 'The Strangers' },
      { tmdbId: 8922, title: 'Jeepers Creepers' },
      { tmdbId: 3021, title: '1408' },
      { tmdbId: 9792, title: 'The Hills Have Eyes' },
      { tmdbId: 16871, title: 'Drag Me to Hell' },
      { tmdbId: 1255, title: 'The Host' },
      { tmdbId: 13812, title: 'Quarantine' },
      { tmdbId: 23827, title: 'Paranormal Activity' },
      { tmdbId: 1433, title: 'The Devil' },
      { tmdbId: 10226, title: 'High Tension' },
      { tmdbId: 285923, title: 'Grindhouse' },
      { tmdbId: 9885, title: 'Wolf Creek' },
      { tmdbId: 9373, title: 'The Texas Chainsaw Massacre' },
      { tmdbId: 46420, title: 'The Loved Ones' },
      { tmdbId: 1696, title: 'The Devil' },
      { tmdbId: 2662, title: 'House of 1000 Corpses' },
      { tmdbId: 9871, title: 'Ginger Snaps' },
      { tmdbId: 215, title: 'Saw II' },
      { tmdbId: 1970, title: 'The Grudge' },
      { tmdbId: 10972, title: 'Session 9' },
      { tmdbId: 8643, title: 'The Exorcism of Emily Rose' },
      { tmdbId: 6537, title: 'The Orphanage' },
      { tmdbId: 13207, title: 'Friday the 13th' },
      { tmdbId: 4552, title: 'A Tale of Two Sisters' },
      { tmdbId: 22536, title: 'Thirst' },
      { tmdbId: 2787, title: 'Pitch Black' },
      { tmdbId: 13510, title: 'Eden Lake' },
      { tmdbId: 9902, title: 'Wrong Turn' },
      { tmdbId: 4513, title: '30 Days of Night' },
      { tmdbId: 10873, title: 'Shadow of the Vampire' },
      { tmdbId: 19901, title: 'Daybreakers' },
      { tmdbId: 2082, title: 'Halloween' },
      { tmdbId: 21208, title: 'Orphan' },
      { tmdbId: 14451, title: 'Dead Snow' },
      { tmdbId: 6312, title: 'Brotherhood of the Wolf' },
      { tmdbId: 2046, title: 'The Gift' },
      { tmdbId: 19898, title: 'Pandorum' },
      { tmdbId: 2655, title: 'What Lies Beneath' },
      { tmdbId: 6466, title: 'Freddy vs. Jason' },
      { tmdbId: 768, title: 'From Hell' },
      { tmdbId: 11547, title: 'Cabin Fever' }
    ]
  },
};

async function checkFilm(tmdbId, title, targetGenreId) {
  const url = `https://api.themoviedb.org/3/movie/${tmdbId}?language=en-US`;
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + TOKEN } });
  const data = await res.json();
  const genreIds = (data.genres || []).map(g => g.id);
  const genreNames = (data.genres || []).map(g => g.name).join(', ');
  const hasGenre = genreIds.includes(targetGenreId);
  return { tmdbId, title, hasGenre, genreNames };
}

for (const [listId, { genre, films }] of Object.entries(LISTS)) {
  const targetId = GENRE_IDS[genre];
  console.log(`\n=== ${listId} — checking for "${genre}" (ID ${targetId}) ===`);
  const missing = [];
  for (const film of films) {
    const result = await checkFilm(film.tmdbId, film.title, targetId);
    if (!result.hasGenre) {
      missing.push(result);
      console.log(`✗ ${result.title} — TMDB genres: ${result.genreNames}`);
    }
    await new Promise(r => setTimeout(r, 150));
  }
  console.log(`\n${films.length - missing.length}/${films.length} have "${genre}" on TMDB`);
  if (missing.length === 0) console.log('All clear ✓');
}
