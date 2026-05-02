import { NextRequest, NextResponse } from 'next/server';
import { MOVIE_CACHE } from '@/lib/movie-cache';
import { OVERLAP_INDEX } from '@/lib/overlap-index';
import { WIN_CONDITIONS_MAP } from '@/lib/win-conditions';
import { FILMOGRAPHY_MAP } from '@/lib/person-filmographies';
import { TMDBMovie } from '@/types/tmdb';

export const runtime = 'nodejs';

// ── Role filters — mirrors MovieCard.tsx ──────────────────────────────────────

const DIRECTOR_JOBS       = new Set(['Director']);
const WRITER_JOBS         = new Set(['Writer', 'Screenplay', 'Story', 'Original Story', 'Screen Story', 'Novel']);
const COMPOSER_JOBS       = new Set(['Original Music Composer', 'Music', 'Composer']);
const CINEMATOGRAPHER_JOBS = new Set(['Director of Photography', 'Cinematography']);

const DELAY_MS = 150;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function tmdbGet(path: string, params: Record<string, string> = {}) {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  return res.json();
}

function isDocumentary(genreIds: number[]): boolean {
  return genreIds.includes(99);
}

function isFeature(film: any): boolean {
  if (film.runtime != null && film.runtime < 60) return false;
  return true;
}

function getWinConditions(filmId: number): string[] {
  const conditions: string[] = [];
  for (const [condId] of WIN_CONDITIONS_MAP) {
    if (OVERLAP_INDEX[filmId]?.includes(condId)) {
      if (!conditions.includes(condId)) conditions.push(condId);
      continue;
    }
    const filmography = FILMOGRAPHY_MAP.get(condId);
    if (filmography && filmography.films.some(f => f.tmdbId === filmId)) {
      if (!conditions.includes(condId)) conditions.push(condId);
    }
  }
  return conditions;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get('id');

  if (!idParam) {
    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
  }

  const movieId = parseInt(idParam, 10);
  if (isNaN(movieId)) {
    return NextResponse.json({ error: 'Invalid id parameter' }, { status: 400 });
  }

  try {
    // Step 1: Fetch the searched film's credits
    const detail = await tmdbGet(`/movie/${movieId}`, {
      append_to_response: 'credits',
    });

    if (!detail) {
      return NextResponse.json({ error: 'Film not found' }, { status: 404 });
    }

    const crew: any[] = detail.credits?.crew ?? [];
    const cast: any[] = detail.credits?.cast ?? [];

    // Step 2: Extract tracked-role people
    const personMap = new Map<number, { name: string; role: string }>();
    const seen = { d: new Set<number>(), w: new Set<number>(), c: new Set<number>(), dp: new Set<number>() };

    for (const c of crew) {
      if (DIRECTOR_JOBS.has(c.job) && !seen.d.has(c.id)) {
        personMap.set(c.id, { name: c.name, role: 'Director' });
        seen.d.add(c.id);
      } else if (WRITER_JOBS.has(c.job) && !seen.w.has(c.id)) {
        personMap.set(c.id, { name: c.name, role: 'Writer' });
        seen.w.add(c.id);
      } else if (CINEMATOGRAPHER_JOBS.has(c.job) && !seen.dp.has(c.id)) {
        personMap.set(c.id, { name: c.name, role: 'Cinematographer' });
        seen.dp.add(c.id);
      } else if (COMPOSER_JOBS.has(c.job) && !seen.c.has(c.id)) {
        personMap.set(c.id, { name: c.name, role: 'Composer' });
        seen.c.add(c.id);
      }
    }

    // Top 10 cast
    const topCast = cast.sort((a: any, b: any) => a.order - b.order).slice(0, 10);
    for (const c of topCast) {
      if (!personMap.has(c.id)) {
        personMap.set(c.id, { name: c.name, role: 'Cast' });
      }
    }

    // Step 3: For each person, fetch their movie credits and cross-reference cache
    const filmMap = new Map<number, {
      tmdbId: number;
      title: string;
      year: number;
      rating: number;
      posterPath: string | null;
      winConditions: string[];
    }>();

    for (const [personId, person] of personMap) {
      await sleep(DELAY_MS);

      const credits = await tmdbGet(`/person/${personId}/movie_credits`, {
        language: 'en-US',
      });

      if (!credits) continue;

      const allFilms = [
        ...(credits.cast ?? []),
        ...(credits.crew ?? []),
      ];

      for (const film of allFilms) {
        if (film.id === movieId) continue;        // exclude searched film
        if (filmMap.has(film.id)) continue;       // already added
        if (!MOVIE_CACHE[film.id]) continue;      // not in our cache

        const cached: TMDBMovie = MOVIE_CACHE[film.id];

        // Feature film checks using cached data
        if (!isFeature(cached)) continue;
        if (isDocumentary(cached.genre_ids ?? [])) continue;
        if (!cached.release_date) continue;

        filmMap.set(film.id, {
          tmdbId:       film.id,
          title:        cached.title,
          year:         parseInt(cached.release_date.slice(0, 4)),
          rating:       cached.vote_average ?? 0,
          posterPath:   cached.poster_path,
          winConditions: getWinConditions(film.id),
        });
      }
    }

    return NextResponse.json({
      movie: {
        id:           detail.id,
        title:        detail.title,
        release_date: detail.release_date,
        poster_path:  detail.poster_path,
        vote_average: detail.vote_average,
      },
      results: [...filmMap.values()],
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[connections API] Error for film ${movieId}:`, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
