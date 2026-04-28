'use client';

import { useEffect, useState, useCallback } from 'react';
import { TMDBMovie } from '@/types/tmdb';
import { WinCondition } from '@/types/tmdb';
import MovieCard from './MovieCard';

interface WinConditionPanelProps {
  conditionId: string;
}

type ViewMode = 'grid' | 'list';
type SortMode = 'popularity' | 'rating' | 'year_asc' | 'year_desc' | 'title_asc' | 'title_desc';

interface ApiResponse {
  conditionId: string;
  condition: WinCondition;
  movies: TMDBMovie[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

function sortMovies(movies: TMDBMovie[], sort: SortMode): TMDBMovie[] {
  return [...movies].sort((a, b) => {
    switch (sort) {
      case 'popularity': return b.popularity - a.popularity;
      case 'rating': return b.vote_average - a.vote_average;
      case 'year_asc': return (a.release_date ?? '').localeCompare(b.release_date ?? '');
      case 'year_desc': return (b.release_date ?? '').localeCompare(a.release_date ?? '');
      case 'title_asc': return a.title.localeCompare(b.title);
      case 'title_desc': return b.title.localeCompare(a.title);
      default: return 0;
    }
  });
}

export default function WinConditionPanel({ conditionId }: WinConditionPanelProps) {
  const [movies, setMovies] = useState<TMDBMovie[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [condition, setCondition] = useState<WinCondition | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('grid');
  const [sort, setSort] = useState<SortMode>('year_desc');
  const [search, setSearch] = useState('');

  const fetchPage = useCallback(async (pageNum: number, append: boolean, sortMode: string) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/movies?condition=${encodeURIComponent(conditionId)}&page=${pageNum}&sort=${sortMode}`
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const json: ApiResponse = await res.json();
      setCondition(json.condition);
      setTotal(json.total);
      setHasMore(json.hasMore);
      setPage(json.page);
      setMovies((prev) => append ? [...prev, ...json.movies] : json.movies);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load movies');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [conditionId]);

  useEffect(() => {
    setSearch('');
    setMovies([]);
    setPage(1);
    setHasMore(false);
    fetchPage(1, false, sort);
  }, [fetchPage]);  // sort intentionally excluded — handled by handleSortChange

  const handleLoadMore = () => {
    fetchPage(page + 1, true, sort);
  };

  const handleSortChange = (newSort: SortMode) => {
    setSort(newSort);
    setMovies([]);
    setPage(1);
    setHasMore(false);
    fetchPage(1, false, newSort);
  };
  // Server handles sort order; client-side sort only applies to search results
  // (since search filters the already-loaded page, not the full dataset)
  const filtered = search.trim()
    ? sortMovies(
        movies.filter((m) => m.title.toLowerCase().includes(search.toLowerCase())),
        sort
      )
    : movies;

  if (loading) {
    return (
      <div style={centerStyle}>
        <div style={spinnerStyle} />
        <p style={{ color: 'var(--text-muted)', marginTop: '20px', fontSize: '14px' }}>
          Loading movies from TMDB…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...centerStyle, flexDirection: 'column', gap: '12px' }}>
        <div style={{ fontSize: '40px' }}>⚠️</div>
        <p style={{ color: 'var(--red)', fontWeight: 500 }}>Failed to load</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', maxWidth: '400px' }}>
          {error}
        </p>
        {error.includes('credentials') && (
          <div style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '16px 20px', maxWidth: '480px',
            fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7,
          }}>
            <strong style={{ color: 'var(--text)' }}>Setup required:</strong><br />
            Copy <code style={codeStyle}>.env.local.example</code> to{' '}
            <code style={codeStyle}>.env.local</code> and add your TMDB API key from{' '}
            <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer">
              themoviedb.org/settings/api
            </a>
          </div>
        )}
        <button onClick={() => fetchPage(1, false, sort)} style={btnStyle}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0', height: '100%' }}>
      {/* Panel header */}
      <div style={{
        padding: '20px 24px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '28px',
              letterSpacing: '0.04em',
              color: 'var(--accent)',
              lineHeight: 1,
              marginBottom: '6px',
            }}>
              {condition.label}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              {condition.description}
            </p>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search */}
            <input
              type="text"
              placeholder="Filter titles…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '6px 12px',
                color: 'var(--text)',
                fontSize: '13px',
                outline: 'none',
                width: '160px',
              }}
            />

            {/* Sort */}
            <select
              value={sort}
              onChange={(e) => handleSortChange(e.target.value as SortMode)}
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '6px 10px',
                color: 'var(--text)',
                fontSize: '13px',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="year_desc">Newest First</option>
              <option value="year_asc">Oldest First</option>
              <option value="popularity">Most Popular</option>
              <option value="rating">Highest Rated</option>
              <option value="title_asc">A–Z</option>
              <option value="title_desc">Z–A</option>
            </select>

            {/* View toggle */}
            <div style={{
              display: 'flex',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              overflow: 'hidden',
            }}>
              {(['grid', 'list'] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  title={v === 'grid' ? 'Grid view' : 'List view'}
                  style={{
                    padding: '6px 10px',
                    background: view === v ? 'var(--accent-glow)' : 'var(--surface-2)',
                    border: 'none',
                    color: view === v ? 'var(--accent)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '15px',
                    transition: 'all 0.12s',
                  }}
                >
                  {v === 'grid' ? '⊞' : '☰'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{
          marginTop: '12px', display: 'flex', gap: '16px',
          fontSize: '12px', color: 'var(--text-dim)',
        }}>
          <span style={{ color: 'var(--text-muted)' }}>{filtered.length} films</span>
          {search && <span>· filtered from {movies.length}</span>}
          {!search && total > 0 && (
            <span style={{ color: 'var(--text-dim)' }}>
              · showing {movies.length} of {total}
            </span>
          )}
          <span style={{ marginLeft: 'auto', color: 'var(--text-dim)', fontSize: '11px' }}>
            via TMDB · refreshes hourly
          </span>
        </div>
      </div>

      {/* Movie display */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
        {filtered.length === 0 ? (
          <div style={{ ...centerStyle, color: 'var(--text-muted)', fontSize: '14px' }}>
            No movies found{search ? ` matching "${search}"` : ''}.
          </div>
        ) : view === 'grid' ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: '14px',
          }}>
            {filtered.map((movie, idx) => (
              <MovieCard key={movie.id} movie={movie} index={idx} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {filtered.map((movie, idx) => (
              <MovieCard key={movie.id} movie={movie} compact index={idx} />
            ))}
          </div>
        )}

        {/* Load More button — only shown when not filtering by search */}
        {!search && hasMore && (
          <div style={{ textAlign: 'center', padding: '24px 0 8px' }}>
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              style={{
                background: 'transparent',
                border: '1px solid var(--accent)',
                color: 'var(--accent)',
                borderRadius: '6px',
                padding: '9px 28px',
                fontSize: '13px',
                fontWeight: 600,
                letterSpacing: '0.05em',
                cursor: loadingMore ? 'not-allowed' : 'pointer',
                opacity: loadingMore ? 0.6 : 1,
                transition: 'all 0.15s',
              }}
            >
              {loadingMore ? 'Loading…' : `Load more · ${total - movies.length} remaining`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const centerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  minHeight: '300px',
};

const spinnerStyle: React.CSSProperties = {
  width: '36px',
  height: '36px',
  border: '3px solid var(--border)',
  borderTopColor: 'var(--accent)',
  borderRadius: '50%',
  animation: 'spin 0.7s linear infinite',
};

const btnStyle: React.CSSProperties = {
  padding: '8px 18px',
  background: 'var(--accent-glow)',
  border: '1px solid var(--accent-dim)',
  borderRadius: 'var(--radius)',
  color: 'var(--accent)',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 500,
};

const codeStyle: React.CSSProperties = {
  background: 'var(--bg)',
  borderRadius: '3px',
  padding: '1px 5px',
  fontFamily: 'monospace',
  fontSize: '12px',
  color: 'var(--accent)',
};
