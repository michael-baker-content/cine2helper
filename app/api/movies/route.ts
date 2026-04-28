import { NextRequest, NextResponse } from 'next/server';
import { getMovieSummary, discoverMoviesAllPages } from '@/lib/tmdb';
import { WIN_CONDITIONS_MAP } from '@/lib/win-conditions';
import { CURATED_LISTS } from '@/lib/decade-genre-lists';
import { OSCAR_WINNER_TMDB_IDS } from '@/lib/oscar-winners';
import { SERVICE_THE_FANS_IDS } from '@/lib/service-the-fans';
import { FILMOGRAPHY_MAP, getFilmographyIds } from '@/lib/person-filmographies';
import { TMDBMovie } from '@/types/tmdb';

export const runtime = 'nodejs';


// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Fetch full movie details for a list of TMDB IDs in parallel batches.
 * Returns results in the same order, skipping any IDs that fail.
 */
async function fetchMoviesByIds(ids: number[], batchSize = 40): Promise<TMDBMovie[]> {
  const results: TMDBMovie[] = [];

  // Deduplicate IDs before fetching
  const uniqueIds = [...new Set(ids)];

  for (let i = 0; i < uniqueIds.length; i += batchSize) {
    const batch = uniqueIds.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map((id) => getMovieSummary(id)));
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      }
    }
    // No delay needed — Next.js fetch cache handles deduplication
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

  if (!conditionId) {
    return NextResponse.json({ error: 'Missing condition parameter' }, { status: 400 });
  }

  const condition = WIN_CONDITIONS_MAP.get(conditionId);
  if (!condition) {
    return NextResponse.json({ error: `Unknown win condition: ${conditionId}` }, { status: 404 });
  }

  try {
    let movies: TMDBMovie[] = [];

    // ── Person conditions — use pre-built filmographies ───────────────────
    // ── Specific condition ID checks first (before category checks) ─────────
    if (conditionId === 'thank-the-academy') {
      movies = await fetchMoviesByIds(OSCAR_WINNER_TMDB_IDS);

    } else if (conditionId === 'service-the-fans') {
      movies = await fetchMoviesByIds(SERVICE_THE_FANS_IDS);

    } else if (condition.category === 'person' || condition.category === 'themed') {

      if (condition.groupPersonIds && condition.groupPersonIds.length > 0) {
        // Group condition: merge filmographies of all people, tag each film
        // with which group members appear in it
        const seenIds = new Set<number>();
        const allIds: number[] = [];
        const filmPersonMap = new Map<number, string[]>();

        for (let i = 0; i < condition.groupPersonIds.length; i++) {
          const personId = condition.groupPersonIds[i];
          const fullName = condition.groupPersonNames?.[i] ?? '';
          // Use groupDisplayNames if set, otherwise fall back to last word of full name
          const surname = condition.groupDisplayNames?.[i]
            ?? fullName.split(' ').pop()
            ?? fullName;

          // Find matching filmography by personId
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

        movies = await fetchMoviesByIds(allIds);
        // Attach matching person surnames for display in the UI
        (movies as (TMDBMovie & { _matchingPersons?: string[] })[]).forEach((m) => {
          m._matchingPersons = filmPersonMap.get(m.id) ?? [];
        });

      } else {
        // Individual person condition
        const filmography = FILMOGRAPHY_MAP.get(conditionId);
        if (filmography) {
          const ids = filmography.films.map((f) => f.tmdbId);
          movies = await fetchMoviesByIds(ids);
        } else {
          console.warn(`[movies API] No filmography found for ${conditionId}`);
          return NextResponse.json(
            { error: `No filmography data for condition: ${conditionId}` },
            { status: 404 }
          );
        }
      }

    // ── Decade + genre conditions — use curated static lists ──────────────
    } else if (condition.category === 'decade') {
      const curatedFilms = CURATED_LISTS[conditionId];

      if (curatedFilms && curatedFilms.length > 0) {
        // Static curated list — fetch full movie details by ID
        const ids = curatedFilms.map((f) => f.tmdbId);
        movies = await fetchMoviesByIds(ids);
      } else {
        // Fallback: live TMDB discover (for any decade condition without a curated list)
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

    // ── Genre conditions (not currently used this season) ─────────────────
    } else if (condition.category === 'genre') {
      movies = await discoverMoviesAllPages(
        {
          genreIds: condition.genreIds,
          voteCountGte: 100,
          sortBy: 'popularity.desc',
        },
        3
      );

    // ── Country / language conditions ──────────────────────────────────────
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

    // Remove unreleased films (release_date in the future or missing)
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    movies = movies.filter((m) => m.release_date && m.release_date <= today);

    // Remove non-features: runtime must be >= 60 minutes if known
    // Catches TV specials, fan events, awards shows that TMDB catalogs as movies
    movies = movies.filter((m) => m.runtime == null || m.runtime >= 60);

    // Manual blocklist — explicit TMDB IDs to exclude regardless of other filters
    // Add any one-off entries here that slip through (e.g. fan events, promos)
    const BLOCKED_IDS = new Set<number>([
      1491034, // Netflix Tudum 2025 — fan event miscatalogued as a film
    ]);
    movies = movies.filter((m) => !BLOCKED_IDS.has(m.id));

    // Server-side sort so pagination is consistent regardless of sort order
    switch (sortParam) {
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
