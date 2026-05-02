'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { TMDBMovie } from '@/types/tmdb';
import { WinCondition } from '@/types/tmdb';
import MovieCard from './MovieCard';

interface WinConditionPanelProps {
  conditionId: string;
}

type ViewMode = 'grid' | 'list';
type SortMode = 'popularity' | 'rating' | 'year_asc' | 'year_desc' | 'title_asc' | 'title_desc';

type EraFilter = 'all' | 'classic' | 'new-hollywood' | 'blockbuster' | 'modern';

const ERA_FILTERS: { value: EraFilter; label: string; from: number; to: number }[] = [
  { value: 'classic',       label: 'Classic Era (1927–1959)',    from: 1927, to: 1959 },
  { value: 'new-hollywood', label: 'New Hollywood (1960–1979)',  from: 1960, to: 1979 },
  { value: 'blockbuster',   label: 'Blockbuster Era (1980–1999)', from: 1980, to: 1999 },
  { value: 'modern',        label: 'Modern Era (2000–present)',  from: 2000, to: 9999 },
];

interface ApiResponse {
  conditionId: string;
  condition: WinCondition;
  movies: TMDBMovie[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  availableOverlaps: { id: string; label: string }[];
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
  const [personFilter, setPersonFilter] = useState<string | null>(null);
  const personFilterRef = React.useRef<string | null>(null);
  const [sequenceFilter, setSequenceFilter] = useState<number | null>(null);
  const sequenceFilterRef = React.useRef<number | null>(null);

  // Era filter — only shown for thank-the-academy
  const [eraFilter, setEraFilter] = useState<EraFilter>(conditionId === 'thank-the-academy' ? 'modern' : 'all');
  const eraFilterRef = React.useRef<EraFilter>(conditionId === 'thank-the-academy' ? 'modern' : 'all');

  // Overlap filter — set of condition IDs the user has toggled on
  const [overlapFilter, setOverlapFilter] = useState<Set<string>>(new Set());
  const overlapFilterRef = React.useRef<Set<string>>(new Set());
  // Available overlap conditions — returned by the API from the full dataset
  const [availableOverlaps, setAvailableOverlaps] = useState<{ id: string; label: string }[]>([]);

  const fetchPage = useCallback(async (pageNum: number, append: boolean, sortMode: string) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/movies?condition=${encodeURIComponent(conditionId)}&page=${pageNum}&sort=${sortMode}${personFilterRef.current ? `&person=${encodeURIComponent(personFilterRef.current)}` : ''}${sequenceFilterRef.current !== null ? `&sequence=${sequenceFilterRef.current}` : ''}${overlapFilterRef.current.size > 0 ? `&overlap=${[...overlapFilterRef.current].join(',')}` : ''}${eraFilterRef.current !== 'all' ? `&era=${eraFilterRef.current}` : ''}`
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
      // Only update available overlaps on fresh loads (not append), so chips
      // don't change as the user pages through results
      if (!append) setAvailableOverlaps(json.availableOverlaps ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load movies');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [conditionId]);

  useEffect(() => {
    setSearch('');
    setPersonFilter(null);
    personFilterRef.current = null;
    setSequenceFilter(null);
    sequenceFilterRef.current = null;
    const defaultEra: EraFilter = conditionId === 'thank-the-academy' ? 'modern' : 'all';
    setEraFilter(defaultEra);
    eraFilterRef.current = defaultEra;
    setOverlapFilter(new Set());
    overlapFilterRef.current = new Set();
    setMovies([]);
    setPage(1);
    setHasMore(false);
    fetchPage(1, false, sort);
  }, [fetchPage]); // sort intentionally excluded — handled by handleSortChange

  const handleLoadMore = () => {
    fetchPage(page + 1, true, sort);
  };

  const handleSequenceFilterChange = (seq: number | null) => {
    sequenceFilterRef.current = seq;
    setSequenceFilter(seq);
    setOverlapFilter(new Set());
    setMovies([]);
    setPage(1);
    setHasMore(false);
    fetchPage(1, false, sort);
  };

  const handlePersonFilterChange = (name: string | null) => {
    personFilterRef.current = name;
    setPersonFilter(name);
    setOverlapFilter(new Set());
    setMovies([]);
    setPage(1);
    setHasMore(false);
    fetchPage(1, false, sort);
  };

  const handleSortChange = (newSort: SortMode) => {
    setSort(newSort);
    setMovies([]);
    setPage(1);
    setHasMore(false);
    fetchPage(1, false, newSort);
  };

  // Change era filter — triggers a server fetch
  const handleEraFilterChange = useCallback((newEra: EraFilter) => {
    eraFilterRef.current = newEra;
    setEraFilter(newEra);
    setMovies([]);
    setPage(1);
    setHasMore(false);
    fetchPage(1, false, sort);
  }, [fetchPage, sort]);

  // Toggle a single overlap condition on/off — triggers a server fetch
  const handleOverlapChipClick = useCallback((overlapConditionId: string) => {
    const next = new Set(overlapFilterRef.current);
    if (next.has(overlapConditionId)) {
      next.delete(overlapConditionId);
    } else {
      next.add(overlapConditionId);
    }
    overlapFilterRef.current = next;
    setOverlapFilter(new Set(next));
    setMovies([]);
    setPage(1);
    setHasMore(false);
    fetchPage(1, false, sort);
  }, [fetchPage, sort]);



  // Apply client-side title search filter (era and overlap filtering are server-side)
  const filtered = useMemo(() => {
    let result = movies;
    if (search.trim()) {
      result = result.filter(m => m.title.toLowerCase().includes(search.toLowerCase()));
    }
    return search.trim() ? sortMovies(result, sort) : result;
  }, [movies, search, sort]);

  if (loading) {
    return (
      <div style={centerStyle}>
        <style>{`
          @keyframes wcpSpin {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
          }
        `}</style>
        <div style={{
          width: '40px', height: '40px',
          border: '3px solid var(--border)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'wcpSpin 0.8s linear infinite',
        }} />
        <p style={{ color: 'var(--text-muted)', marginTop: '28px', fontSize: '14px' }}>
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
    <div className="condition-panel-outer" style={{ display: 'flex', flexDirection: 'column', gap: '0', height: '100%', minHeight: 0 }}>
      {/* Panel header */}
      <div style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        flexShrink: 0,
        width: '100%',
      }}>
      <div style={{ padding: '20px 24px 16px', maxWidth: '1400px', margin: '0 auto' }}>
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
              {condition?.label}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              {condition?.description}
            </p>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Person filter dropdown (group conditions only) */}
            {condition?.groupDisplayNames && condition.groupDisplayNames.length > 0 && (
              <select
                aria-label="Filter by person"
                value={personFilter ?? ''}
                onChange={e => handlePersonFilterChange(e.target.value || null)}
                style={{
                  background: 'var(--surface-2)',
                  backgroundImage: 'url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%228%22%20viewBox%3D%220%200%2012%208%22%3E%3Cpath%20d%3D%22M1%201l5%205%205-5%22%20stroke%3D%22%23a0a0b0%22%20stroke-width%3D%221.5%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E")',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 10px center',
                  border: `1px solid ${personFilter ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)',
                  padding: '6px 28px 6px 10px',
                  color: personFilter ? 'var(--accent)' : 'var(--text)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  outline: 'none',
                  alignSelf: 'flex-start',
                }}
              >
                <option value="">All</option>
                {condition.groupDisplayNames.map((name, i) => (
                  <option key={name} value={name}>
                    {condition.groupPersonNames?.[i] ?? name}
                  </option>
                ))}
              </select>
            )}

            {/* Sequence filter — service-the-fans only */}
            {conditionId === 'service-the-fans' && (
              <select
                aria-label="Filter by series position"
                value={sequenceFilter ?? ''}
                onChange={e => handleSequenceFilterChange(e.target.value ? parseInt(e.target.value) : null)}
                style={{
                  background: 'var(--surface-2)',
                  backgroundImage: 'url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%228%22%20viewBox%3D%220%200%2012%208%22%3E%3Cpath%20d%3D%22M1%201l5%205%205-5%22%20stroke%3D%22%23a0a0b0%22%20stroke-width%3D%221.5%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E")',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 10px center',
                  border: `1px solid ${sequenceFilter !== null ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)',
                  padding: '6px 28px 6px 10px',
                  color: sequenceFilter !== null ? 'var(--accent)' : 'var(--text)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  outline: 'none',
                  alignSelf: 'flex-start',
                }}
              >
                <option value="">All Films</option>
                <option value="1">First Film</option>
                <option value="2">Second Film</option>
                <option value="3">Third Film</option>
                <option value="4">Fourth Film</option>
                <option value="5">Fifth Film</option>
              </select>
            )}

            {/* Row: search + sort + view toggle */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <label htmlFor="title-filter" style={{ position: 'absolute', width: '1px', height: '1px', margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}>
                Filter titles
              </label>
              <input
                id="title-filter"
                type="text"
                placeholder="Filter titles…"
                aria-label="Filter titles"
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

              <select
                aria-label="Sort films by"
                value={sort}
                onChange={(e) => handleSortChange(e.target.value as SortMode)}
                style={{
                  background: 'var(--surface-2)',
                  backgroundImage: 'url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%228%22%20viewBox%3D%220%200%2012%208%22%3E%3Cpath%20d%3D%22M1%201l5%205%205-5%22%20stroke%3D%22%23a0a0b0%22%20stroke-width%3D%221.5%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E")',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 10px center',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '6px 28px 6px 10px',
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

              {conditionId === 'thank-the-academy' && (
                <select
                  aria-label="Filter by era"
                  value={eraFilter}
                  onChange={e => handleEraFilterChange(e.target.value as EraFilter)}
                  style={{
                    background: 'var(--surface-2)',
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%228%22%20viewBox%3D%220%200%2012%208%22%3E%3Cpath%20d%3D%22M1%201l5%205%205-5%22%20stroke%3D%22%23a0a0b0%22%20stroke-width%3D%221.5%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E")',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 10px center',
                    border: `1px solid ${eraFilter !== 'all' ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)',
                    padding: '6px 28px 6px 10px',
                    color: eraFilter !== 'all' ? 'var(--accent)' : 'var(--text)',
                    fontSize: '13px',
                    cursor: 'pointer',
                    outline: 'none',
                    appearance: 'none' as const,
                  }}
                >
                  {ERA_FILTERS.map(era => (
                    <option key={era.value} value={era.value}>{era.label}</option>
                  ))}
                </select>
              )}

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
                      padding: '6px 28px 6px 10px',
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
        </div>{/* /header inner */}

        {/* Overlap filter chips — only shown when there are relevant conditions */}
        {availableOverlaps.length > 0 && (
          <div style={{
            marginTop: '12px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            alignItems: 'center',
          }}>
            <span style={{
              fontSize: '11px',
              color: 'var(--text-dim)',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginRight: '2px',
              flexShrink: 0,
            }}>
              Also qualifies for:
            </span>
            {availableOverlaps.map(({ id, label }) => {
              const active = overlapFilter.has(id);
              return (
                <button
                  key={id}
                  onClick={() => handleOverlapChipClick(id)}
                  aria-pressed={active}
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.03em',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    background: active ? 'var(--accent)' : 'var(--surface-2)',
                    color: active ? 'var(--bg)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => {
                    if (active) return;
                    e.currentTarget.style.borderColor = 'var(--accent-dim)';
                    e.currentTarget.style.color = 'var(--accent)';
                  }}
                  onMouseLeave={e => {
                    if (active) return;
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }}
                >
                  {label}
                  {active && (
                    <span style={{ marginLeft: '5px', opacity: 0.7, fontSize: '10px' }}>×</span>
                  )}
                </button>
              );
            })}
            {overlapFilter.size > 0 && (
              <button
                onClick={() => {
                  overlapFilterRef.current = new Set();
                  setOverlapFilter(new Set());
                  setMovies([]);
                  setPage(1);
                  setHasMore(false);
                  fetchPage(1, false, sort);
                }}
                style={{
                  fontSize: '11px',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = 'var(--text-muted)';
                  e.currentTarget.style.borderColor = 'var(--accent-dim)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = 'var(--text-dim)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Stats bar */}
        <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
          {total > 0 && (
            <span>
              {total} films{movies.length < total ? `, showing ${movies.length} of ${total}` : ''}
            </span>
          )}
        </div>
      </div>{/* /inner max-width */}
      </div>{/* /header full-width */}

      {/* Movie display */}
      <div className="condition-scroll-area" style={{ overflowY: 'auto', flex: 1, minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px 24px', position: 'relative' }}>
        <div aria-live="polite" aria-atomic="true" style={{
          position: 'absolute', width: '1px', height: '1px',
          margin: '-1px', overflow: 'hidden',
          clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
        }}>
          {loading ? `Loading ${condition?.label ?? 'films'}…` : ''}
          {!loading && movies.length > 0 ? `Showing ${movies.length} of ${total} films` : ''}
          {!loading && movies.length === 0 && !error ? 'No films found' : ''}
        </div>
        {filtered.length === 0 ? (
          <div style={{ ...centerStyle, color: 'var(--text-muted)', fontSize: '14px' }}>
            No movies found{search ? ` matching "${search}"` : overlapFilter.size > 0 ? ' matching the selected filters' : ' in this era'}.
          </div>
        ) : view === 'grid' ? (
          <div>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: '14px',
              }}>
                {filtered.map((movie, idx) => (
                  <MovieCard
                    key={movie.id}
                    movie={movie}
                    index={idx}
                    onOverlapClick={handleOverlapChipClick}
                  />
                ))}
              </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {filtered.map((movie, idx) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                compact
                index={idx}
                onOverlapClick={handleOverlapChipClick}
              />
            ))}
          </div>
        )}

        {/* Load More — only when not filtering */}
        {!search && !overlapFilter.size && hasMore && (
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
        </div>{/* /max-width */}
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
