import { WinCondition } from '@/types/tmdb';
import { GENRE_IDS } from './tmdb';

/**
 * Cine2Nerdle Battle – Current Season Win Conditions
 *
 * Update this file each season when the game rotates its win condition pool.
 * TMDB person IDs can be found in the URL when viewing a person's page:
 * e.g. themoviedb.org/person/135651-michael-b-jordan → ID is 135651
 */

export const WIN_CONDITIONS: WinCondition[] = [

  // ── DECADE + GENRE CONDITIONS ─────────────────────────────────────────────

  {
    id: 'scifi-80s',
    label: "'80s Sci-Fi",
    description: 'Science Fiction films released in the 1980s',
    category: 'decade',
    targetCount: 8,
    genreIds: [GENRE_IDS['Science Fiction']],
    decadeStart: 1980,
    decadeEnd: 1989,
  },
  {
    id: 'romance-90s',
    label: "'90s Romance",
    description: 'Romance films released in the 1990s',
    category: 'decade',
    targetCount: 8,
    genreIds: [GENRE_IDS['Romance']],
    decadeStart: 1990,
    decadeEnd: 1999,
  },
  {
    id: 'horror-2000s',
    label: '2000s Horror',
    description: 'Horror films released in the 2000s',
    category: 'decade',
    targetCount: 8,
    genreIds: [GENRE_IDS['Horror']],
    decadeStart: 2000,
    decadeEnd: 2009,
  },

  // ── INDIVIDUAL PERSON CONDITIONS ──────────────────────────────────────────

  {
    id: 'person-amy-madigan',
    label: 'Amy Madigan',
    description: 'Films involving Amy Madigan',
    category: 'person',
    targetCount: 4,
    personId: 23882,
    personName: 'Amy Madigan',
    personRole: 'both',
  },
  {
    id: 'person-emma-stone',
    label: 'Emma Stone',
    description: 'Films involving Emma Stone',
    category: 'person',
    targetCount: 4,
    personId: 54693,
    personName: 'Emma Stone',
    personRole: 'both',
  },
  {
    id: 'person-ethan-hawke',
    label: 'Ethan Hawke',
    description: 'Films involving Ethan Hawke',
    category: 'person',
    targetCount: 4,
    personId: 569,
    personName: 'Ethan Hawke',
    personRole: 'both',
  },
  {
    id: 'person-jacob-elordi',
    label: 'Jacob Elordi',
    description: 'Films involving Jacob Elordi',
    category: 'person',
    targetCount: 4,
    personId: 2034418,
    personName: 'Jacob Elordi',
    personRole: 'cast',
  },
  {
    id: 'person-jessie-buckley',
    label: 'Jessie Buckley',
    description: 'Films involving Jessie Buckley',
    category: 'person',
    targetCount: 4,
    personId: 1498158,
    personName: 'Jessie Buckley',
    personRole: 'both',
  },
  {
    id: 'person-kate-hudson',
    label: 'Kate Hudson',
    description: 'Films involving Kate Hudson',
    category: 'person',
    targetCount: 4,
    personId: 11661,
    personName: 'Kate Hudson',
    personRole: 'cast',
  },
  {
    id: 'person-rose-byrne',
    label: 'Rose Byrne',
    description: 'Films involving Rose Byrne',
    category: 'person',
    targetCount: 4,
    personId: 9827,
    personName: 'Rose Byrne',
    personRole: 'cast',
  },
  {
    id: 'person-timothee-chalamet',
    label: 'Timothée Chalamet',
    description: 'Films involving Timothée Chalamet',
    category: 'person',
    targetCount: 4,
    personId: 1190668,
    personName: 'Timothée Chalamet',
    personRole: 'cast',
  },
  {
    id: 'person-wagner-moura',
    label: 'Wagner Moura',
    description: 'Films involving Wagner Moura',
    category: 'person',
    targetCount: 4,
    personId: 52583,
    personName: 'Wagner Moura',
    personRole: 'both',
  },

  // ── "JOIN THE REVOLUTION" — One Battle After Another (PTA, 2025) ──────────

  {
    id: 'join-the-revolution',
    label: 'Join The Revolution',
    description: 'Films connected to One Battle After Another — featuring Paul Thomas Anderson, Leonardo DiCaprio, Teyana Taylor, Benicio Del Toro, Sean Penn, or Regina Hall',
    category: 'themed',
    targetCount: 4,
    groupPersonIds:    [4762,                    6193,               964679,          1121,                 2228,       35705        ],
    groupPersonNames:  ['Paul Thomas Anderson',  'Leonardo DiCaprio', 'Teyana Taylor', 'Benicio Del Toro',  'Sean Penn', 'Regina Hall'],
    groupDisplayNames: ['Anderson',              'DiCaprio',          'Taylor',        'Del Toro',          'Penn',      'Hall'        ],
  },

  // ── "SING THE BLUES" — Sinners (Coogler, 2025) ───────────────────────────

  {
    id: 'sing-the-blues',
    label: 'Sing The Blues',
    description: 'Films connected to Sinners — featuring Ryan Coogler, Michael B. Jordan, Delroy Lindo, Wunmi Mosaku, or Hailee Steinfeld',
    category: 'themed',
    targetCount: 4,
    groupPersonIds:    [1056121,        135651,             18792,          134774,          130640             ],
    groupPersonNames:  ['Ryan Coogler', 'Michael B. Jordan', 'Delroy Lindo', 'Wunmi Mosaku', 'Hailee Steinfeld'],
    groupDisplayNames: ['Coogler',      'Jordan',            'Lindo',        'Mosaku',        'Steinfeld'       ],
  },

  // ── "GET SENTIMENTAL" — Sentimental Value (Trier, 2025) ──────────────────

  {
    id: 'get-sentimental',
    label: 'Get Sentimental',
    description: 'Films connected to Sentimental Value — featuring Joachim Trier, Renate Reinsve, Stellan Skarsgård, Elle Fanning, or Inga Ibsdotter Lilleaas',
    category: 'themed',
    targetCount: 4,
    groupPersonIds:    [71609,            1576786,            1640,                 18050,          1421850                    ],
    groupPersonNames:  ['Joachim Trier',  'Renate Reinsve',   'Stellan Skarsgård',  'Elle Fanning', 'Inga Ibsdotter Lilleaas'  ],
    groupDisplayNames: ['Trier',          'Reinsve',          'Skarsgård',          'Fanning',      'Lilleaas'                 ],
  },

  // ── SPECIAL CONDITIONS ────────────────────────────────────────────────────

  {
    id: 'thank-the-academy',
    label: 'Thank the Academy',
    description: 'Films that won an Academy Award',
    category: 'themed',
    targetCount: 6,
    keywords: ['academy award winner'],
  },
  {
    id: 'service-the-fans',
    label: 'Service the Fans',
    description: 'Films that are Part 1, 2, 3, 4, or 5 in a series',
    category: 'themed',
    targetCount: 6,
    keywords: ['sequel', 'series'],
  },
];

/** Map of win condition IDs → WinCondition objects for O(1) lookup */
export const WIN_CONDITIONS_MAP = new Map<string, WinCondition>(
  WIN_CONDITIONS.map((wc) => [wc.id, wc])
);

/** Category labels for UI filtering */
export const CATEGORY_LABELS: Record<string, string> = {
  themed:    '🎬 Themed Conditions',
  person:    '🎭 Person',
  decade:    '📅 Decade',
  // Kept for future seasons:
  genre:     '🎬 Genre',
  keyword:   '🏆 Special',
  franchise: '🎪 Franchise / Series',
  country:   '🌍 Country / Language',
};
