import { NextRequest, NextResponse } from 'next/server';
import { getMovieSummary } from '@/lib/tmdb';
import { WIN_CONDITIONS_MAP } from '@/lib/win-conditions';
import { CURATED_LISTS } from '@/lib/decade-genre-lists';
import { OSCAR_WINNER_TMDB_IDS } from '@/lib/oscar-winners';
import { SERVICE_THE_FANS_IDS } from '@/lib/service-the-fans';
import { FILMOGRAPHY_MAP } from '@/lib/person-filmographies';
import { TMDBMovie } from '@/types/tmdb';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const conditionId = searchParams.get('condition');
  if (!conditionId) return NextResponse.json({ error: 'Missing condition' }, { status: 400 });

  const condition = WIN_CONDITIONS_MAP.get(conditionId);
  if (!condition) return NextResponse.json({ error: 'Unknown condition' }, { status: 404 });

  try {
    let ids: number[] = [];

    if (conditionId === 'thank-the-academy') {
      ids = OSCAR_WINNER_TMDB_IDS.slice(0, 20);
    } else if (conditionId === 'service-the-fans') {
      ids = SERVICE_THE_FANS_IDS.slice(0, 20);
    } else if (condition.groupPersonIds?.length) {
      const all: number[] = [];
      for (const personId of condition.groupPersonIds) {
        const f = [...FILMOGRAPHY_MAP.values()].find(f => f.personId === personId);
        if (f) all.push(...f.films.slice(0, 5).map(m => m.tmdbId));
      }
      ids = [...new Set(all)].slice(0, 20);
    } else if (condition.category === 'person') {
      const f = FILMOGRAPHY_MAP.get(conditionId);
      ids = f?.films.slice(0, 20).map(m => m.tmdbId) ?? [];
    } else if (condition.category === 'decade') {
      const list = CURATED_LISTS[conditionId] ?? [];
      ids = list.slice(0, 20).map(f => f.tmdbId);
    }

    // Fetch up to 20, sort by popularity, return top 3 with posters
    const results = await Promise.allSettled(ids.map(id => getMovieSummary(id)));
    const movies = results
      .filter((r): r is PromiseFulfilledResult<TMDBMovie> => r.status === 'fulfilled')
      .map(r => r.value)
      .filter(m => m.poster_path && m.release_date && m.release_date <= new Date().toISOString().slice(0, 10))
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, 3)
      .map(m => ({ id: m.id, title: m.title, poster_path: m.poster_path }));

    return NextResponse.json({ movies }, {
      headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400' },
    });
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
