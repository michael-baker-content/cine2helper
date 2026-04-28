import {
  TMDBMovie,
  TMDBMovieDetail,
  TMDBPaginatedResponse,
  TMDBGenre,
  TMDBPerson,
  TMDBPersonMovieCredits,
} from '@/types/tmdb';

const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p';

function getHeaders(): HeadersInit {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  const apiKey = process.env.TMDB_API_KEY;

  if (token) {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }
  if (apiKey) {
    // fallback: append api_key as query param (handled in fetch)
    return { 'Content-Type': 'application/json' };
  }
  throw new Error('No TMDB credentials configured. Set TMDB_READ_ACCESS_TOKEN or TMDB_API_KEY in .env.local');
}

function buildUrl(path: string, params: Record<string, string | number | boolean> = {}): string {
  const apiKey = process.env.TMDB_API_KEY;
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  const url = new URL(`${BASE_URL}${path}`);
  if (!token && apiKey) {
    url.searchParams.set('api_key', apiKey);
  }
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  return url.toString();
}

async function tmdbFetch<T>(path: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
  const url = buildUrl(path, params);
  const res = await fetch(url, {
    headers: getHeaders(),
    next: { revalidate: 3600 }, // Cache for 1 hour
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`TMDB API error ${res.status}: ${JSON.stringify(err)}`);
  }
  return res.json();
}

// ── Genre helpers ─────────────────────────────────────────────────────────────

export async function getMovieGenres(): Promise<TMDBGenre[]> {
  const data = await tmdbFetch<{ genres: TMDBGenre[] }>('/genre/movie/list', { language: 'en' });
  return data.genres;
}

export const GENRE_IDS: Record<string, number> = {
  Action: 28,
  Adventure: 12,
  Animation: 16,
  Comedy: 35,
  Crime: 80,
  Documentary: 99,
  Drama: 18,
  Family: 10751,
  Fantasy: 14,
  History: 36,
  Horror: 27,
  Music: 10402,
  Mystery: 9648,
  Romance: 10749,
  'Science Fiction': 878,
  'TV Movie': 10770,
  Thriller: 53,
  War: 10752,
  Western: 37,
};

// ── Discover movies ───────────────────────────────────────────────────────────

export interface DiscoverMovieOptions {
  genreIds?: number[];
  withoutGenreIds?: number[];
  withKeywords?: string; // comma-separated keyword IDs
  withoutKeywords?: string;
  withCast?: string; // person id
  withCrew?: string; // person id
  withPeople?: string; // person id (cast OR crew)
  primaryReleaseDateGte?: string; // YYYY-MM-DD
  primaryReleaseDateLte?: string;
  primaryReleaseYear?: number;
  voteCountGte?: number;
  voteAverageGte?: number;
  sortBy?: string;
  page?: number;
  withOriginalLanguage?: string;
  withoutKeywordIds?: string;
}

export async function discoverMovies(
  options: DiscoverMovieOptions = {}
): Promise<TMDBPaginatedResponse<TMDBMovie>> {
  const params: Record<string, string | number | boolean> = {
    language: 'en-US',
    sort_by: options.sortBy ?? 'popularity.desc',
    page: options.page ?? 1,
    'vote_count.gte': options.voteCountGte ?? 50,
  };

  if (options.genreIds?.length) params.with_genres = options.genreIds.join(',');
  if (options.withoutGenreIds?.length) params.without_genres = options.withoutGenreIds.join(',');
  if (options.withKeywords) params.with_keywords = options.withKeywords;
  if (options.withoutKeywords) params.without_keywords = options.withoutKeywords;
  if (options.withCast) params.with_cast = options.withCast;
  if (options.withCrew) params.with_crew = options.withCrew;
  if (options.withPeople) params.with_people = options.withPeople;
  if (options.primaryReleaseDateGte) params['primary_release_date.gte'] = options.primaryReleaseDateGte;
  if (options.primaryReleaseDateLte) params['primary_release_date.lte'] = options.primaryReleaseDateLte;
  if (options.primaryReleaseYear) params.primary_release_year = options.primaryReleaseYear;
  if (options.voteAverageGte) params['vote_average.gte'] = options.voteAverageGte;
  if (options.withOriginalLanguage) params.with_original_language = options.withOriginalLanguage;

  return tmdbFetch<TMDBPaginatedResponse<TMDBMovie>>('/discover/movie', params);
}

/** Fetch multiple pages from discover and merge results */
export async function discoverMoviesAllPages(
  options: DiscoverMovieOptions,
  maxPages = 5
): Promise<TMDBMovie[]> {
  const first = await discoverMovies({ ...options, page: 1 });
  const allMovies = [...first.results];
  const totalPages = Math.min(first.total_pages, maxPages);

  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) =>
      discoverMovies({ ...options, page: i + 2 })
    )
  );
  rest.forEach((r) => allMovies.push(...r.results));
  return allMovies;
}

// ── Movie details ─────────────────────────────────────────────────────────────

export async function getMovieDetails(movieId: number): Promise<TMDBMovieDetail> {
  return tmdbFetch<TMDBMovieDetail>(`/movie/${movieId}`, {
    append_to_response: 'credits,keywords',
  });
}

/**
 * Lightweight movie fetch — returns only the fields needed for a poster card.
 * Much faster than getMovieDetails since it skips credits/keywords.
 * Use this for bulk fetches (Oscar list, filmographies, curated lists).
 */
export async function getMovieSummary(movieId: number): Promise<TMDBMovie> {
  return tmdbFetch<TMDBMovie>(`/movie/${movieId}`);
}

// ── Person search & credits ───────────────────────────────────────────────────

export async function searchPerson(query: string): Promise<TMDBPerson[]> {
  const data = await tmdbFetch<TMDBPaginatedResponse<TMDBPerson>>('/search/person', {
    query,
    language: 'en-US',
  });
  return data.results;
}

export async function getPersonDetails(personId: number): Promise<TMDBPerson> {
  return tmdbFetch<TMDBPerson>(`/person/${personId}`);
}

export async function getPersonMovieCredits(personId: number): Promise<TMDBPersonMovieCredits> {
  return tmdbFetch<TMDBPersonMovieCredits>(`/person/${personId}/movie_credits`, {
    language: 'en-US',
  });
}

// ── Keyword search ────────────────────────────────────────────────────────────

export async function searchKeyword(query: string): Promise<{ id: number; name: string }[]> {
  const data = await tmdbFetch<TMDBPaginatedResponse<{ id: number; name: string }>>('/search/keyword', {
    query,
  });
  return data.results;
}

// ── Image URLs ────────────────────────────────────────────────────────────────

export function getPosterUrl(posterPath: string | null, size: 'w185' | 'w342' | 'w500' | 'original' = 'w342'): string {
  if (!posterPath) return '/placeholder-poster.svg';
  return `${IMAGE_BASE}/${size}${posterPath}`;
}

export function getProfileUrl(profilePath: string | null, size: 'w45' | 'w185' | 'h632' = 'w185'): string {
  if (!profilePath) return '/placeholder-profile.svg';
  return `${IMAGE_BASE}/${size}${profilePath}`;
}

export function getBackdropUrl(backdropPath: string | null, size: 'w780' | 'w1280' | 'original' = 'w780'): string {
  if (!backdropPath) return '';
  return `${IMAGE_BASE}/${size}${backdropPath}`;
}
