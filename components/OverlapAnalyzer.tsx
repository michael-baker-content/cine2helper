'use client';

import { useState, useCallback } from 'react';
import { WIN_CONDITIONS, CATEGORY_LABELS } from '@/lib/win-conditions';
import { WinCondition, WinConditionCategory, TMDBMovie } from '@/types/tmdb';
import MovieCard from './MovieCard';

interface OverlapMovie extends TMDBMovie {
  matchingConditions: string[]; // condition labels that this film satisfies
}

const CATEGORY_ORDER: WinConditionCategory[] = ['themed', 'person', 'decade'];

/** Fetch ALL pages for a condition */
async function fetchAllMovies(conditionId: string): Promise<TMDBMovie[]> {
  const all: TMDBMovie[] = [];
  let page = 1;

  while (true) {
    const res = await fetch(
      `/api/movies?condition=${encodeURIComponent(conditionId)}&page=${page}&sort=year_desc`
    );
    if (!res.ok) break;
    const data = await res.json();
    all.push(...(data.movies ?? []));
    if (!data.hasMore) break;
    page++;
  }

  return all;
}

export default function OverlapAnalyzer() {
  const [selected, setSelected] = useState<string[]>([]);
  const [results, setResults] = useState<OverlapMovie[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<'popularity' | 'year_desc' | 'title_asc'>('popularity');

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setResults(null);
  };

  const analyze = useCallback(async () => {
    if (selected.length < 2) return;
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      // Fetch all movies for each selected condition
      const conditionMovies: Map<number, TMDBMovie>[] = [];

      for (const condId of selected) {
        const cond = WIN_CONDITIONS.find(c => c.id === condId);
        setLoadingStatus(`Loading ${cond?.label ?? condId}…`);
        const movies = await fetchAllMovies(condId);
        const map = new Map<number, TMDBMovie>();
        movies.forEach(m => map.set(m.id, m));
        conditionMovies.push(map);
      }

      setLoadingStatus('Finding overlaps…');

      // Find movies present in ALL selected conditions
      const firstMap = conditionMovies[0];
      const overlap: OverlapMovie[] = [];

      for (const [id, movie] of firstMap) {
        if (conditionMovies.every(m => m.has(id))) {
          const matchingConditions = selected.map(
            condId => WIN_CONDITIONS.find(c => c.id === condId)?.label ?? condId
          );
          overlap.push({ ...movie, matchingConditions });
        }
      }

      // Sort results
      sortResults(overlap, sort);
      setResults(overlap);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to analyze');
    } finally {
      setLoading(false);
      setLoadingStatus('');
    }
  }, [selected, sort]);

  function sortResults(movies: OverlapMovie[], sortMode: string) {
    switch (sortMode) {
      case 'popularity':
        movies.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
        break;
      case 'year_desc':
        movies.sort((a, b) => (b.release_date ?? '').localeCompare(a.release_date ?? ''));
        break;
      case 'title_asc':
        movies.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }
  }

  const handleSortChange = (newSort: 'popularity' | 'year_desc' | 'title_asc') => {
    setSort(newSort);
    if (results) {
      const sorted = [...results];
      sortResults(sorted, newSort);
      setResults(sorted);
    }
  };

  // Group conditions by category
  const grouped = CATEGORY_ORDER.reduce<Record<string, WinCondition[]>>((acc, cat) => {
    const items = WIN_CONDITIONS.filter(wc => wc.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface-2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap',
      }}>
        <div>
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '20px',
            letterSpacing: '0.04em',
            color: 'var(--accent)',
            marginBottom: '2px',
          }}>OVERLAP ANALYZER</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            Find films that satisfy multiple win conditions simultaneously
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {results !== null && (
            <select
              value={sort}
              onChange={e => handleSortChange(e.target.value as any)}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: 'var(--text)',
                fontSize: '12px',
                padding: '6px 10px',
                cursor: 'pointer',
              }}
            >
              <option value="popularity">Most Popular</option>
              <option value="year_desc">Newest First</option>
              <option value="title_asc">A–Z</option>
            </select>
          )}
          <button
            onClick={analyze}
            disabled={selected.length < 2 || loading}
            style={{
              padding: '8px 18px',
              background: selected.length >= 2 && !loading ? 'var(--accent)' : 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: selected.length >= 2 && !loading ? 'var(--bg)' : 'var(--text-dim)',
              cursor: selected.length >= 2 && !loading ? 'pointer' : 'not-allowed',
              fontSize: '13px',
              fontWeight: 700,
              fontFamily: 'var(--font-display)',
              letterSpacing: '0.05em',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? loadingStatus || 'Loading…' : 'FIND OVERLAP'}
          </button>
        </div>
      </div>

      {/* Condition selector — grouped by category */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '12px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Select 2 or more conditions to compare
          {selected.length >= 2 && (
            <span style={{ color: 'var(--accent)', marginLeft: '8px' }}>
              · {selected.length} selected
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {CATEGORY_ORDER.filter(cat => grouped[cat]).map(cat => (
            <div key={cat}>
              <div style={{
                fontSize: '10px',
                color: 'var(--text-dim)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: '6px',
                fontWeight: 600,
              }}>
                {CATEGORY_LABELS[cat] ?? cat}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {grouped[cat].map(wc => {
                  const active = selected.includes(wc.id);
                  return (
                    <button
                      key={wc.id}
                      onClick={() => toggle(wc.id)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                        background: active ? 'var(--accent-glow)' : 'transparent',
                        color: active ? 'var(--accent)' : 'var(--text-muted)',
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: active ? 600 : 400,
                        transition: 'all 0.12s',
                      }}
                    >
                      {wc.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Results */}
      <div style={{ padding: '16px 20px' }}>
        {error && (
          <p style={{ color: 'var(--red)', fontSize: '13px' }}>{error}</p>
        )}
        {results !== null && !error && (
          <>
            <div style={{ marginBottom: '14px', fontSize: '13px', color: 'var(--text-muted)' }}>
              {results.length === 0
                ? 'No films satisfy all selected conditions.'
                : <>
                    <strong style={{ color: 'var(--accent)' }}>{results.length} film{results.length !== 1 ? 's' : ''}</strong>
                    {' '}satisfy all {selected.length} selected conditions.
                  </>
              }
            </div>
            {results.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                gap: '12px',
              }}>
                {results.map(movie => (
                  <MovieCard key={movie.id} movie={movie} />
                ))}
              </div>
            )}
          </>
        )}
        {results === null && !loading && selected.length < 2 && (
          <p style={{ color: 'var(--text-dim)', fontSize: '13px' }}>
            Select at least 2 win conditions above, then click Find Overlap.
          </p>
        )}
      </div>
    </div>
  );
}
