export interface TMDBMovie {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  runtime: number | null;
  sequence?: number; // franchise position (1-5), set for service-the-fans
  popularity: number;
  original_language: string;
  /** Set by API for group conditions — surnames of matching people */
  _matchingPersons?: string[];
  /** Set by API — other win condition IDs this film also qualifies for */
  _overlapConditions?: string[];
}

export interface TMDBMovieDetail extends TMDBMovie {
  genres: { id: number; name: string }[];
  tagline: string;
  status: string;
  credits?: {
    cast: TMDBCastMember[];
    crew: TMDBCrewMember[];
  };
  keywords?: {
    keywords: { id: number; name: string }[];
  };
}

export interface TMDBCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface TMDBCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface TMDBPerson {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department: string;
  popularity: number;
  biography?: string;
}

export interface TMDBPersonMovieCredits {
  cast: TMDBMovie[];
  crew: (TMDBMovie & { job: string; department: string })[];
}

export interface TMDBPaginatedResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface TMDBGenre {
  id: number;
  name: string;
}

// Cine2Nerdle specific types
export type WinConditionCategory = 'genre' | 'person' | 'decade' | 'franchise' | 'country' | 'keyword' | 'themed';

export interface WinCondition {
  id: string;
  label: string;
  description: string;
  category: WinConditionCategory;
  targetCount: number; // number of films needed to win
  // For genre-based conditions
  genreIds?: number[];
  excludeKeywords?: string[];
  excludeFranchises?: string[];
  // For person-based conditions
  personId?: number;
  personName?: string;
  personRole?: 'cast' | 'crew' | 'both';
  /**
   * For group person conditions (Join The Revolution, Sing The Blues etc.)
   * A group condition merges filmographies of multiple people into one list.
   * The sidebar shows one entry; film cards show which people appear in each film.
   */
  groupPersonIds?: number[];    // person IDs in the group
  groupPersonNames?: string[];  // full names
  groupDisplayNames?: string[]; // short display names for film card tags — edit these manually
  // For decade-based conditions
  decadeStart?: number;
  decadeEnd?: number;
  // For keyword-based conditions
  keywords?: string[];
  // For country-based conditions
  originCountry?: string;
}

export interface CheatSheetMovie {
  movie: TMDBMovie;
  relevantWinConditions: string[]; // win condition IDs this movie satisfies
  connectability: number; // how many major cast/crew members (versatility score)
}
