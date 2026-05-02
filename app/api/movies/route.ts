import { NextRequest, NextResponse } from 'next/server';
import { discoverMoviesAllPages } from '@/lib/tmdb';
import { WIN_CONDITIONS_MAP } from '@/lib/win-conditions';
import { CURATED_LISTS } from '@/lib/decade-genre-lists';
import { OSCAR_WINNER_TMDB_IDS } from '@/lib/oscar-winners';
import { SERVICE_THE_FANS, SERVICE_THE_FANS_IDS } from '@/lib/service-the-fans';
import { FILMOGRAPHY_MAP, PERSON_FILMOGRAPHIES } from '@/lib/person-filmographies';
import { MOVIE_CACHE } from '@/lib/movie-cache';
import { OVERLAP_INDEX } from '@/lib/overlap-index';
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

// ── Condition film set helper ─────────────────────────────────────────────────
// Returns the set of TMDB IDs for a given condition ID.
// Used for server-side overlap filtering — mirrors the logic in
// build-overlap-index.mjs so the two stay in sync.

function getFilmIdsForCondition(cId: string): Set<number> {
  if (cId === 'thank-the-academy') return new Set(OSCAR_WINNER_TMDB_IDS);
  if (cId === 'service-the-fans')  return new Set(SERVICE_THE_FANS_IDS);

  const cond = WIN_CONDITIONS_MAP.get(cId);
  if (!cond) return new Set();

  if (cond.category === 'person' || cond.category === 'themed') {
    if (cond.groupPersonIds && cond.groupPersonIds.length > 0) {
      const ids = new Set<number>();
      for (const personId of cond.groupPersonIds) {
        const filmography = [...FILMOGRAPHY_MAP.values()].find(f => f.personId === personId);
        if (filmography) filmography.films.forEach(f => ids.add(f.tmdbId));
      }
      return ids;
    }
    const filmography = FILMOGRAPHY_MAP.get(cId);
    if (filmography) return new Set(filmography.films.map(f => f.tmdbId));
    return new Set();
  }

  if (cond.category === 'decade') {
    const curated = CURATED_LISTS[cId];
    if (curated?.length) return new Set(curated.map(f => f.tmdbId));
    return new Set();
  }

  return new Set(); // live-query conditions (genre/country) not supported
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
  const overlapParam = searchParams.get('overlap')
    ? searchParams.get('overlap')!.split(',').map(s => s.trim()).filter(Boolean)
    : [];
  const eraParam = searchParams.get('era') ?? null;

  // Era year ranges — only applied to thank-the-academy
  const ERA_RANGES: Record<string, { from: number; to: number }> = {
    'classic':       { from: 1927, to: 1959 },
    'new-hollywood': { from: 1960, to: 1979 },
    'blockbuster':   { from: 1980, to: 1999 },
    'modern':        { from: 2000, to: 9999 },
  };

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
      const seqMap = new Map(SERVICE_THE_FANS.map(f => [f.tmdbId, f.sequence]));
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

    // ── Overlap filter (server-side) ──────────────────────────────────────────
    // Narrow the full movie set to films that also qualify for every requested
    // overlap condition. Applied before pagination so results are correct
    // regardless of page number.
    if (overlapParam.length > 0) {
      const overlapSets = overlapParam.map(id => getFilmIdsForCondition(id));
      movies = movies.filter(m => overlapSets.every(s => s.has(m.id)));
    }

    // ── Era filter (thank-the-academy only) ──────────────────────────────────
    if (conditionId === 'thank-the-academy' && eraParam && ERA_RANGES[eraParam]) {
      const { from, to } = ERA_RANGES[eraParam];
      movies = movies.filter(m => {
        const yr = parseInt(m.release_date?.slice(0, 4) ?? '0');
        return yr >= from && yr <= to;
      });
    }

    // ── Derive available overlaps from full (pre-pagination) dataset ──────────
    // Collect every condition that appears on at least one film in the current
    // (post-filter) results, excluding the current condition.
    // Returned to the client so the chip bar always reflects the full dataset.
    const availableOverlapsMap = new Map<string, string>();
    for (const m of movies) {
      const overlaps = OVERLAP_INDEX[m.id];
      if (!overlaps) continue;
      for (const id of overlaps) {
        if (id !== conditionId && !availableOverlapsMap.has(id)) {
          availableOverlapsMap.set(id, WIN_CONDITIONS_MAP.get(id)?.label ?? id);
        }
      }
    }
    const availableOverlaps = [...availableOverlapsMap.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, label]) => ({ id, label }));

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

    // ── Annotate with overlap conditions ─────────────────────────────────────
    // Attach the other conditions each film qualifies for (excluding the
    // current one). Drives the overlap filter chips in the UI.
    const annotatedMovies = pageMovies.map((m) => {
      const allConditions = OVERLAP_INDEX[m.id];
      if (!allConditions) return m;
      const others = allConditions.filter((c) => c !== conditionId);
      if (others.length === 0) return m;
      return { ...m, _overlapConditions: others };
    });

    return NextResponse.json({
      conditionId,
      condition,
      movies: annotatedMovies,
      page,
      pageSize: PAGE_SIZE,
      total,
      hasMore: end < total,
      availableOverlaps,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[movies API] Error for condition ${conditionId}:`, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
