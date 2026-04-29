import { NextRequest, NextResponse } from 'next/server';
import { discoverMoviesAllPages } from '@/lib/tmdb';
import { WIN_CONDITIONS_MAP } from '@/lib/win-conditions';
import { CURATED_LISTS } from '@/lib/decade-genre-lists';
import { OSCAR_WINNER_TMDB_IDS } from '@/lib/oscar-winners';
import { SERVICE_THE_FANS, SERVICE_THE_FANS_IDS } from '@/lib/service-the-fans';
import { FILMOGRAPHY_MAP } from '@/lib/person-filmographies';
import { MOVIE_CACHE } from '@/lib/movie-cache';
import { TMDBMovie } from '@/types/tmdb';

export const runtime = 'nodejs';

// Cache API responses at Vercel's CDN edge for 1 hour.
// The first request after a deploy pays the cost; all subsequent requests
// are served instantly from cache until the next revalidation.
export const revalidate = 3600;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Resolve a list of TMDB IDs to TMDBMovie objects using the pre-built cache.
 * Falls back to a live TMDB fetch only for IDs missing from the cache
 * (e.g. very recently added films not yet in a cache rebuild).
 */
async function resolveMoviesByIds(ids: number[]): Promise<TMDBMovie[]> {
  const uniqueIds = [...new Set(ids)];
  const results: TMDBMovie[] = [];
  const missing: number[] = [];

  for (const id of uniqueIds) {
    const cached = MOVIE_CACHE[id];
    if (cached) {
      results.push(cached);
    } else {
      missing.push(id);
    }
  }

  // Live fallback for any IDs not in the cache (should be rare)
  if (missing.length > 0) {
    console.warn(`[movies API] ${missing.length} IDs not in movie cache — fetching live from TMDB: ${missing.join(', ')}`);
    const BATCH_SIZE = 40;
    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
      const batch = missing.slice(i, i + BATCH_SIZE);
      const settled = await Promise.allSettled(
        batch.map((id) =>
          fetch(`https://api.themoviedb.org/3/movie/${id}?language=en-US`, {
            headers: { Authorization: `Bearer ${process.env.TMDB_READ_ACCESS_TOKEN}` },
            next: { revalidate: 3600 },
          }).then((r) => r.json() as Promise<TMDBMovie>)
        )
      );
      for (const result of settled) {
        if (result.status === 'fulfilled') results.push(result.value);
      }
    }
  }

  return results;
}

// ── Route handler ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const conditionId = searchParams.get('condition');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const sortParam = searchParams.get('sort') ?? 'year_desc';
  const personParam   = searchParams.get('person') ?? null;
  const sequenceParam = searchParams.get('sequence') ? parseInt(searchParams.get('sequence')!) : null;

  if (!conditionId) {
    return NextResponse.json({ error: 'Missing condition parameter' }, { status: 400 });
  }

  const condition = WIN_CONDITIONS_MAP.get(conditionId);
  if (!condition) {
    return NextResponse.json({ error: `Unknown win condition: ${conditionId}` }, { status: 404 });
  }

  try {
    let movies: TMDBMovie[] = [];

    // ── Special conditions ────────────────────────────────────────────────────

    if (conditionId === 'thank-the-academy') {
      movies = await resolveMoviesByIds(OSCAR_WINNER_TMDB_IDS);

    } else if (conditionId === 'service-the-fans') {
      movies = await resolveMoviesByIds(SERVICE_THE_FANS_IDS);
      const seqMap = new Map(SERVICE_THE_FANS.map(f => [f.tmdbId, (f as any).sequence as number | undefined]));
      movies.forEach(m => { if (seqMap.has(m.id)) (m as any).sequence = seqMap.get(m.id); });

    // ── Person / themed conditions — use pre-built filmographies ──────────────

    } else if (condition.category === 'person' || condition.category === 'themed') {

      if (condition.groupPersonIds && condition.groupPersonIds.length > 0) {
        const seenIds = new Set<number>();
        const allIds: number[] = [];
        const filmPersonMap = new Map<number, string[]>();

        const indicesToInclude = condition.groupPersonIds
          .map((_, i) => i)
          .filter(i => !personParam || condition.groupDisplayNames?.[i] === personParam);

        for (const i of indicesToInclude) {
          const personId = condition.groupPersonIds[i];
          const surname = condition.groupDisplayNames?.[i]
            ?? condition.groupPersonNames?.[i]?.split(' ').pop()
            ?? '';

          const filmography = [...FILMOGRAPHY_MAP.values()].find(
            (f) => f.personId === personId
          );
          const ids = filmography?.films.map((f) => f.tmdbId) ?? [];

          for (const id of ids) {
            if (!seenIds.has(id)) {
              seenIds.add(id);
              allIds.push(id);
            }
            const existing = filmPersonMap.get(id) ?? [];
            if (!existing.includes(surname)) {
              filmPersonMap.set(id, [...existing, surname]);
            }
          }
        }

        movies = await resolveMoviesByIds(allIds);
        (movies as (TMDBMovie & { _matchingPersons?: string[] })[]).forEach((m) => {
          m._matchingPersons = filmPersonMap.get(m.id) ?? [];
        });

      } else {
        // Individual person condition
        const filmography = FILMOGRAPHY_MAP.get(conditionId);
        if (filmography) {
          const ids = filmography.films.map((f) => f.tmdbId);
          movies = await resolveMoviesByIds(ids);
        } else {
          console.warn(`[movies API] No filmography found for ${conditionId}`);
          return NextResponse.json(
            { error: `No filmography data for condition: ${conditionId}` },
            { status: 404 }
          );
        }
      }

    // ── Decade + genre conditions — use curated static lists ──────────────────

    } else if (condition.category === 'decade') {
      const curatedFilms = CURATED_LISTS[conditionId];

      if (curatedFilms && curatedFilms.length > 0) {
        const ids = curatedFilms.map((f) => f.tmdbId);
        movies = await resolveMoviesByIds(ids);
      } else {
        // Fallback: live TMDB discover (no curated list for this condition)
        console.warn(`[movies API] No curated list for ${conditionId}, falling back to discover`);
        const gte = `${condition.decadeStart}-01-01`;
        const lte = `${condition.decadeEnd}-12-31`;
        movies = await discoverMoviesAllPages(
          {
            genreIds: condition.genreIds,
            primaryReleaseDateGte: gte,
            primaryReleaseDateLte: lte,
            voteCountGte: 200,
            sortBy: 'popularity.desc',
          },
          5
        );
      }

    // ── Genre conditions ──────────────────────────────────────────────────────

    } else if (condition.category === 'genre') {
      movies = await discoverMoviesAllPages(
        {
          genreIds: condition.genreIds,
          voteCountGte: 100,
          sortBy: 'popularity.desc',
        },
        3
      );

    // ── Country / language conditions ─────────────────────────────────────────

    } else if (condition.category === 'country') {
      if (condition.originCountry === 'non-en') {
        movies = await discoverMoviesAllPages(
          { voteCountGte: 200, sortBy: 'popularity.desc' },
          2
        );
        movies = movies.filter((m) => m.original_language !== 'en');
      } else if (condition.originCountry) {
        movies = await discoverMoviesAllPages(
          {
            withOriginalLanguage: condition.originCountry,
            voteCountGte: 100,
            sortBy: 'popularity.desc',
          },
          3
        );
      }
    }

    // ── Filters ───────────────────────────────────────────────────────────────

    const today = new Date().toISOString().slice(0, 10);
    movies = movies.filter((m) => m.release_date && m.release_date <= today);
    movies = movies.filter((m) => m.runtime == null || m.runtime >= 60);

    if (sequenceParam !== null) {
      movies = movies.filter(m => (m as any).sequence === sequenceParam);
    }

    movies = movies.filter((m) => m.genre_ids == null || m.genre_ids.length > 0);

    const BLOCKED_IDS = new Set<number>([
      1491034, // Netflix Tudum 2025 — fan event miscatalogued as a film
      1128701, // Creed: Shinjidai — anime short, no runtime on TMDB so slips through
    ]);
    movies = movies.filter((m) => !BLOCKED_IDS.has(m.id));

    // ── Sort ──────────────────────────────────────────────────────────────────

    switch (sortParam) {
      case 'series':
      case 'decade':
      case 'year_desc':
        movies.sort((a, b) =>
          (b.release_date ?? '').localeCompare(a.release_date ?? ''));
        break;
      case 'year_asc':
        movies.sort((a, b) =>
          (a.release_date ?? '').localeCompare(b.release_date ?? ''));
        break;
      case 'popularity':
        movies.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
        break;
      case 'rating':
        movies.sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0));
        break;
      case 'title_asc':
        movies.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title_desc':
        movies.sort((a, b) => b.title.localeCompare(a.title));
        break;
      default:
        movies.sort((a, b) =>
          (b.release_date ?? '').localeCompare(a.release_date ?? ''));
    }

    // ── Paginate ──────────────────────────────────────────────────────────────

    const total = movies.length;
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageMovies = movies.slice(start, end);

    return NextResponse.json({
      conditionId,
      condition,
      movies: pageMovies,
      page,
      pageSize: PAGE_SIZE,
      total,
      hasMore: end < total,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[movies API] Error for condition ${conditionId}:`, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
