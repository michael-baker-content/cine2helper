// lookup-oscar-additions.mjs
import { readFileSync } from 'fs';
import { join } from 'path';

const envPath = join(process.cwd(), '.env.local');
const envVars = readFileSync(envPath, 'utf8');
const tokenMatch = envVars.match(/TMDB_READ_ACCESS_TOKEN=(.+)/);
const TOKEN = tokenMatch?.[1]?.trim();

if (!TOKEN) { console.error('No token'); process.exit(1); }

const films = [
  ['The Matrix', 1999],
  ['The Cider House Rules', 1999],
  ['Topsy-Turvy', 1999],
  ['Sleepy Hollow', 1999],
  ['American Beauty', 1999],
  ['The Curious Case of Benjamin Button', 2008],
  ['The Reader', 2008],
  ['The Duchess', 2008],
  ['The Social Network', 2010],
  ['The Fighter', 2010],
  ['In a Better World', 2010],
  ['The Wolfman', 2010],
  ['Bridge of Spies', 2015],
  ['The Hateful Eight', 2015],
  ['The Danish Girl', 2015],
  ['Spectre', 2015],
  ['American Sniper', 2014],
  ['Boyhood', 2014],
  ['Big Hero 6', 2014],
  ['The Great Gatsby', 2013],
  ['Anna Karenina', 2012],
  ['Zero Dark Thirty', 2012],
  ['The Girl with the Dragon Tattoo', 2011],
  ['The Help', 2011],
  ['The Muppets', 2011],
  ['Beginners', 2011],
  ['The King\'s Speech', 2010],
  ['Black Swan', 2010],
  ['Crazy Heart', 2009],
  ['Star Trek', 2009],
  ['The Young Victoria', 2009],
  ['The Blind Side', 2009],
  ['The Hours', 2002],
  ['Road to Perdition', 2002],
  ['Talk to Her', 2002],
  ['Gosford Park', 2001],
  ['Monsters Inc', 2001],
  ['Iris', 2001],
  ['Pearl Harbor', 2001],
  ['Wonder Boys', 2000],
  ['How the Grinch Stole Christmas', 2000],
  ['Pollock', 2000],
  ['Topsy-Turvy', 1999],
  ['The Red Violin', 1999],
  ['Elizabeth', 1998],
  ['The Prince of Egypt', 1998],
  ['Affliction', 1998],
  ['The Full Monty', 1997],
  ['Evita', 1996],
  ['Emma', 1996],
  ['Sling Blade', 1996],
  ['The Usual Suspects', 1995],
  ['Dead Man Walking', 1995],
  ['Il Postino', 1995],
  ['Sense and Sensibility', 1995],
  ['Mighty Aphrodite', 1995],
  ['Pocahontas', 1995],
  ['Bullets Over Broadway', 1994],
  ['The Madness of King George', 1994],
  ['Legends of the Fall', 1994],
  ['The Adventures of Priscilla Queen of the Desert', 1994],
  ['Blue Sky', 1994],
  ['The Age of Innocence', 1993],
  ['Jurassic Park', 1993],
  ['The Fugitive', 1993],
  ['Howards End', 1992],
  ['A River Runs Through It', 1992],
  ['My Cousin Vinny', 1992],
  ['The Last of the Mohicans', 1992],
  ['Death Becomes Her', 1992],
  ['Bugsy', 1991],
  ['Thelma and Louise', 1991],
  ['The Fisher King', 1991],
  ['City Slickers', 1991],
  ['Platoon', 1986],
  ['Hannah and Her Sisters', 1986],
  ['A Room with a View', 1986],
  ['Aliens', 1986],
  ['The Mission', 1986],
  ['Children of a Lesser God', 1986],
  ['The Color of Money', 1986],
  ['Top Gun', 1986],
  ['Round Midnight', 1986],
  ['The Fly', 1986],
  ['Out of Africa', 1985],
  ['Witness', 1985],
  ['Cocoon', 1985],
  ['Back to the Future', 1985],
  ['Kiss of the Spider Woman', 1985],
  ['Ran', 1985],
  ['The Trip to Bountiful', 1985],
  ['Amadeus', 1984],
  ['The Killing Fields', 1984],
  ['A Passage to India', 1984],
  ['Indiana Jones and the Temple of Doom', 1984],
  ['Purple Rain', 1984],
  ['Terms of Endearment', 1983],
  ['The Right Stuff', 1983],
  ['Fanny and Alexander', 1983],
  ['Tender Mercies', 1983],
  ['Yentl', 1983],
  ['Flashdance', 1983],
  ['Return of the Jedi', 1983],
  ['Gandhi', 1982],
  ['E.T. the Extra-Terrestrial', 1982],
  ['An Officer and a Gentleman', 1982],
  ['Tootsie', 1982],
  ['Sophie\'s Choice', 1982],
  ['Victor Victoria', 1982],
  ['Missing', 1982],
  ['Quest for Fire', 1982],
  ['Chariots of Fire', 1981],
  ['Raiders of the Lost Ark', 1981],
  ['Reds', 1981],
  ['On Golden Pond', 1981],
  ['Arthur', 1981],
  ['An American Werewolf in London', 1981],
  ['Ordinary People', 1980],
  ['Tess', 1980],
  ['Raging Bull', 1980],
  ['Fame', 1980],
  ['Coal Miner\'s Daughter', 1980],
  ['The Empire Strikes Back', 1980],
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
}

for (const [title, year] of films) {
  await lookup(title, year);
  await new Promise(r => setTimeout(r, 150));
}
