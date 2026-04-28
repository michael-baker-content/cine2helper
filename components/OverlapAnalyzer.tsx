'use client';

import { useState, useCallback, useRef } from 'react';
import { WIN_CONDITIONS, CATEGORY_LABELS } from '@/lib/win-conditions';
import { WinCondition, WinConditionCategory, TMDBMovie } from '@/types/tmdb';
import MovieCard from './MovieCard';

interface OverlapMovie extends TMDBMovie {
  matchingConditions: string[];
}

const CATEGORY_ORDER: WinConditionCategory[] = ['themed', 'person', 'decade'];

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

// ── Filmstrip loading animation ───────────────────────────────────────────────
function FilmstripLoader({ status }: { status: string }) {
  return (
    <>
      <style>{`
        @keyframes filmScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes projectorPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div style={{
        padding: '40px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px',
        overflow: 'hidden',
      }}>
        {/* Filmstrip track */}
        <div style={{
          width: '100%',
          overflow: 'hidden',
          position: 'relative',
          height: '64px',
          borderTop: '3px solid var(--border)',
          borderBottom: '3px solid var(--border)',
          background: 'var(--surface-2)',
        }}>
          {/* Sprocket holes + frames, duplicated for seamless loop */}
          <div style={{
            display: 'flex',
            width: 'max-content',
            height: '100%',
            animation: 'filmScroll 2.4s linear infinite',
          }}>
            {[...Array(2)].map((_, pass) => (
              <div key={pass} style={{ display: 'flex' }}>
                {[...Array(16)].map((_, i) => (
                  <div key={i} style={{
                    width: '56px',
                    height: '100%',
                    flexShrink: 0,
                    borderRight: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    position: 'relative',
                  }}>
                    {/* Top sprocket */}
                    <div style={{
                      width: '10px', height: '10px',
                      borderRadius: '2px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      alignSelf: 'center',
                    }} />
                    {/* Frame content — dim accent rect */}
                    <div style={{
                      flex: 1, margin: '4px 0',
                      background: 'var(--accent-glow)',
                      borderRadius: '2px',
                      opacity: 0.5 + (i % 4) * 0.1,
                    }} />
                    {/* Bottom sprocket */}
                    <div style={{
                      width: '10px', height: '10px',
                      borderRadius: '2px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      alignSelf: 'center',
                    }} />
                  </div>
                ))}
              </div>
            ))}
          </div>
          {/* Left/right fade edges */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'linear-gradient(to right, var(--surface-2) 0%, transparent 12%, transparent 88%, var(--surface-2) 100%)',
          }} />
        </div>

        {/* Projector light pulse + status text */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '10px', height: '10px',
            borderRadius: '50%',
            background: 'var(--accent)',
            animation: 'projectorPulse 1.1s ease-in-out infinite',
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: '13px',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-display)',
            letterSpacing: '0.05em',
          }}>
            {status || 'LOADING…'}
          </span>
        </div>
      </div>
    </>
  );
}

// ── Jump-to-results toast ─────────────────────────────────────────────────────
function ResultsToast({ count, onJump, onDismiss }: {
  count: number;
  onJump: () => void;
  onDismiss: () => void;
}) {
  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 100,
      animation: 'toastSlideIn 0.25s ease forwards',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      background: 'var(--surface)',
      border: '1px solid var(--accent-dim)',
      borderRadius: '999px',
      padding: '10px 16px 10px 20px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        fontSize: '13px',
        color: 'var(--text-muted)',
      }}>
        <strong style={{ color: 'var(--accent)' }}>{count} film{count !== 1 ? 's' : ''}</strong>
        {' '}found
      </span>
      <button
        onClick={onJump}
        style={{
          padding: '6px 16px',
          background: 'var(--accent)',
          border: 'none',
          borderRadius: '999px',
          color: 'var(--bg)',
          fontSize: '12px',
          fontWeight: 700,
          fontFamily: 'var(--font-display)',
          letterSpacing: '0.05em',
          cursor: 'pointer',
          transition: 'opacity 0.12s',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        JUMP TO RESULTS ↓
      </button>
      <button
        onClick={onDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-dim)',
          fontSize: '16px',
          cursor: 'pointer',
          padding: '0 4px',
          lineHeight: 1,
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function OverlapAnalyzer() {
  const [selected, setSelected]           = useState<string[]>([]);
  const [results, setResults]             = useState<OverlapMovie[] | null>(null);
  const [loading, setLoading]             = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [error, setError]                 = useState<string | null>(null);
  const [sort, setSort]                   = useState<'popularity' | 'year_desc' | 'title_asc'>('popularity');
  const [showToast, setShowToast]         = useState(false);

  const resultsRef = useRef<HTMLDivElement>(null);

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    setResults(null);
    setShowToast(false);
  };

  const analyze = useCallback(async () => {
    if (selected.length < 2) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setShowToast(false);

    try {
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

      sortResults(overlap, sort);
      setResults(overlap);
      setShowToast(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to analyze');
    } finally {
      setLoading(false);
      setLoadingStatus('');
    }
  }, [selected, sort]);

  function sortResults(movies: OverlapMovie[], sortMode: string) {
    switch (sortMode) {
      case 'popularity': movies.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0)); break;
      case 'year_desc':  movies.sort((a, b) => (b.release_date ?? '').localeCompare(a.release_date ?? '')); break;
      case 'title_asc':  movies.sort((a, b) => a.title.localeCompare(b.title)); break;
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

  const jumpToResults = () => {
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setShowToast(false);
  };

  const grouped = CATEGORY_ORDER.reduce<Record<string, WinCondition[]>>((acc, cat) => {
    const items = WIN_CONDITIONS.filter(wc => wc.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  return (
    <>
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
              {loading ? '…' : 'FIND OVERLAP'}
            </button>
          </div>
        </div>

        {/* Condition selector */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{
            fontSize: '11px', color: 'var(--text-dim)',
            marginBottom: '12px', letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
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
                  fontSize: '10px', color: 'var(--text-dim)',
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  marginBottom: '6px', fontWeight: 600,
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

        {/* Results area */}
        <div style={{ padding: '16px 20px' }}>

          {/* Loading animation */}
          {loading && <FilmstripLoader status={loadingStatus} />}

          {/* Error */}
          {error && !loading && (
            <p style={{ color: 'var(--red)', fontSize: '13px' }}>{error}</p>
          )}

          {/* Results */}
          {results !== null && !loading && !error && (
            <>
              <div ref={resultsRef} style={{
                marginBottom: '14px',
                fontSize: '13px',
                color: 'var(--text-muted)',
                scrollMarginTop: '16px',
              }}>
                {results.length === 0
                  ? 'No films satisfy all selected conditions.'
                  : <>
                      <strong style={{ color: 'var(--accent)' }}>
                        {results.length} film{results.length !== 1 ? 's' : ''}
                      </strong>
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

          {/* Idle prompt */}
          {results === null && !loading && selected.length < 2 && (
            <p style={{ color: 'var(--text-dim)', fontSize: '13px' }}>
              Select at least 2 win conditions above, then click Find Overlap.
            </p>
          )}
        </div>
      </div>

      {/* Jump-to-results toast */}
      {showToast && results !== null && (
        <ResultsToast
          count={results.length}
          onJump={jumpToResults}
          onDismiss={() => setShowToast(false)}
        />
      )}
    </>
  );
}
