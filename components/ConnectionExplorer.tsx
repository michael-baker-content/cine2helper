'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { PERSON_FILMOGRAPHIES } from '@/lib/person-filmographies';
import { OVERLAP_INDEX } from '@/lib/overlap-index';
import { WIN_CONDITIONS_MAP } from '@/lib/win-conditions';
import { MOVIE_CACHE } from '@/lib/movie-cache';
import { getPosterUrl, getMovieDetails } from '@/lib/tmdb';
import Image from 'next/image';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SearchResult {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  vote_average: number;
}

interface FlatResult {
  tmdbId: number;
  title: string;
  year: number;
  rating: number;
  posterPath: string | null;
  winConditions: string[]; // condition IDs this film qualifies for
}

// ── Constants ────────────────────────────────────────────────────────────────

type ResultSort = 'conditions' | 'year_desc' | 'year_asc' | 'rating' | 'title_asc';
const PAGE_SIZE = 50;



// ── Suggested films ──────────────────────────────────────────────────────────
// Pick films with the most win condition overlaps as starter suggestions.
// These are the most strategically interesting films for players to explore.

const SUGGESTED_FILMS = (() => {
  // Build set of all film IDs from tracked person filmographies
  const trackedFilmIds = new Set<number>();
  for (const filmography of PERSON_FILMOGRAPHIES) {
    for (const film of filmography.films) trackedFilmIds.add(film.tmdbId);
  }

  // Only suggest films that:
  // 1. Are in the movie cache
  // 2. Appear in at least one tracked person's filmography
  // 3. Qualify for multiple win conditions (most strategically interesting)
  const entries = Object.entries(OVERLAP_INDEX)
    .map(([id, conditions]) => ({ id: parseInt(id), conditions }))
    .filter(e => MOVIE_CACHE[e.id] && trackedFilmIds.has(e.id))
    .sort((a, b) => b.conditions.length - a.conditions.length)
    .slice(0, 14);

  return entries.map(e => ({
    tmdbId:     e.id,
    title:      MOVIE_CACHE[e.id].title,
    year:       parseInt(MOVIE_CACHE[e.id].release_date?.slice(0, 4) ?? '0'),
    posterPath: MOVIE_CACHE[e.id].poster_path,
    conditions: e.conditions,
  }));
})();

// ── Helpers ───────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}


// ── Sub-components ────────────────────────────────────────────────────────────

function sortResults(results: FlatResult[], sort: ResultSort): FlatResult[] {
  return [...results].sort((a, b) => {
    switch (sort) {
      case 'conditions':
        if (b.winConditions.length !== a.winConditions.length)
          return b.winConditions.length - a.winConditions.length;
        return b.year - a.year;
      case 'year_desc': return b.year - a.year;
      case 'year_asc':  return a.year - b.year;
      case 'rating':    return b.rating - a.rating;
      case 'title_asc': return a.title.localeCompare(b.title);
      default:          return 0;
    }
  });
}

function ConditionChip({ conditionId }: { conditionId: string }) {
  const condition = WIN_CONDITIONS_MAP.get(conditionId);
  if (!condition) return null;
  return (
    <span style={{
      fontSize: '10px',
      fontWeight: 600,
      letterSpacing: '0.03em',
      padding: '2px 7px',
      borderRadius: '10px',
      border: '1px solid var(--accent-dim)',
      background: 'var(--accent-glow)',
      color: 'var(--accent)',
      whiteSpace: 'nowrap',
    }}>
      {condition.label}
    </span>
  );
}

function FilmInfoModal({ tmdbId, title, onClose }: {
  tmdbId: number;
  title: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/movie-detail?id=${tmdbId}`)
      .then(r => r.json())
      .then(d => { setDetail(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [tmdbId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const crew = detail?.credits?.crew ?? [];
  const directors = crew.filter((c: any) => c.job === 'Director').map((c: any) => c.name);
  const writers = crew.filter((c: any) => ['Writer','Screenplay','Story','Novel'].includes(c.job)).map((c: any) => c.name);
  const composers = crew.filter((c: any) => ['Original Music Composer','Music','Composer'].includes(c.job)).map((c: any) => c.name);
  const dops = crew.filter((c: any) => ['Director of Photography','Cinematography'].includes(c.job)).map((c: any) => c.name);
  const topCast = (detail?.credits?.cast ?? []).slice(0, 10).map((c: any) => c.name);

  const Row = ({ label, names }: { label: string; names: string[] }) => {
    if (!names.length) return null;
    return (
      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '3px' }}>{label}</div>
        <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.5 }}>{names.join(', ')}</div>
      </div>
    );
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', border: '1px solid var(--accent-dim)',
        borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '400px',
        maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 16px 64px rgba(0,0,0,0.7)',
      }}>
        <div style={{ display: 'flex', gap: '12px', padding: '16px 16px 0', alignItems: 'flex-start' }}>
          {MOVIE_CACHE[tmdbId]?.poster_path && (
            <Image src={getPosterUrl(MOVIE_CACHE[tmdbId].poster_path, 'w185')} alt={title}
              width={56} height={84} unoptimized
              style={{ borderRadius: '5px', objectFit: 'cover', flexShrink: 0 }} />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)', lineHeight: 1.3, marginBottom: '4px' }}>{title}</div>
            {detail && (
              <>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {detail.release_date?.slice(0, 4)}
                  {detail.vote_average > 0 && <span style={{ color: 'var(--accent)', marginLeft: '8px' }}>★ {Number(detail.vote_average).toFixed(1)}</span>}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                  <a href={`https://www.themoviedb.org/movie/${tmdbId}`} target="_blank" rel="noreferrer"
                    style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-muted)', textDecoration: 'none' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-dim)'; e.currentTarget.style.color = 'var(--accent)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >TMDB ↗</a>
                  {detail.imdb_id && (
                    <a href={`https://www.imdb.com/title/${detail.imdb_id}`} target="_blank" rel="noreferrer"
                      style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-muted)', textDecoration: 'none' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-dim)'; e.currentTarget.style.color = 'var(--accent)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                    >IMDb ↗</a>
                  )}
                </div>
              </>
            )}
          </div>
          <button onClick={onClose} style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: '50%', width: '26px', height: '26px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-muted)', fontSize: '15px', flexShrink: 0,
          }}>×</button>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', margin: '12px 16px 0' }} />
        <div style={{ padding: '12px 16px 18px' }}>
          {loading ? (
            <div style={{ color: 'var(--text-dim)', fontSize: '13px' }}>Loading credits…</div>
          ) : (
            <>
              <Row label="Director" names={[...new Set<string>(directors)]} />
              <Row label={writers.length > 1 ? 'Writers' : 'Writer'} names={[...new Set<string>(writers)]} />
              <Row label="Cinematography" names={[...new Set<string>(dops)]} />
              <Row label="Composer" names={[...new Set<string>(composers)]} />
              {topCast.length > 0 && (
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>Cast</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {topCast.map((name: string) => (
                      <span key={name} style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--surface-2)', borderRadius: '12px', padding: '3px 10px', border: '1px solid var(--border)' }}>{name}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FlatFilmRow({ film, onSelect }: {
  film: FlatResult;
  onSelect: (film: FlatResult) => void;
}) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '8px 0', borderBottom: '1px solid var(--border)',
      }}>
        <button
          onClick={() => onSelect(film)}
          title={`Explore connections for ${film.title}`}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            flex: 1, minWidth: 0, background: 'none', border: 'none',
            cursor: 'pointer', textAlign: 'left', padding: 0,
          }}
        >
          {film.posterPath ? (
            <Image src={getPosterUrl(film.posterPath, 'w185')} alt={film.title}
              width={28} height={42} unoptimized
              style={{ borderRadius: '3px', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 28, height: 42, background: 'var(--surface-2)', borderRadius: '3px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>🎬</div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text)')}
            >{film.title}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: film.winConditions.length > 0 ? '4px' : '0' }}>
              {film.year}
              {film.rating > 0 && <span style={{ color: 'var(--accent)', marginLeft: '8px' }}>★ {film.rating.toFixed(1)}</span>}
            </div>
            {film.winConditions.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {film.winConditions.map(id => <ConditionChip key={id} conditionId={id} />)}
              </div>
            )}
          </div>
        </button>
        <button
          onClick={e => { e.stopPropagation(); setShowModal(true); }}
          aria-label={`${film.title} film info`}
          style={{
            width: '22px', height: '22px', borderRadius: '50%',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            color: 'var(--text-muted)', fontSize: '12px', fontWeight: 700,
            fontStyle: 'italic', fontFamily: 'Georgia, serif',
            cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-dim)'; e.currentTarget.style.color = 'var(--accent)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
        >i</button>
      </div>
      {showModal && <FilmInfoModal tmdbId={film.tmdbId} title={film.title} onClose={() => setShowModal(false)} />}
    </>
  );
}

// ── Suggested films ──────────────────────────────────────────────────────────

function SuggestedFilms({ onSelect }: { onSelect: (film: SearchResult) => void }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{
        fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '12px',
      }}>
        Suggested starting points
      </div>
      <div style={{
        display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px',
        scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent',
        WebkitOverflowScrolling: 'touch',
      }}>
        {SUGGESTED_FILMS.map(film => (
          <button
            key={film.tmdbId}
            onClick={() => onSelect({
              id:           film.tmdbId,
              title:        film.title,
              release_date: `${film.year}-01-01`,
              poster_path:  film.posterPath ?? null,
              vote_average: MOVIE_CACHE[film.tmdbId]?.vote_average ?? 0,
            })}
            title={`${film.title} (${film.year}) — qualifies for ${film.conditions.length} conditions`}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', cursor: 'pointer', padding: 0,
              overflow: 'hidden', flexShrink: 0, width: '90px',
              transition: 'transform 0.12s, border-color 0.12s, box-shadow 0.12s',
              display: 'flex', flexDirection: 'column',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.borderColor = 'var(--accent-dim)';
              e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = '';
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.boxShadow = '';
            }}
          >
            <div style={{ position: 'relative', aspectRatio: '2/3', background: 'var(--surface-2)' }}>
              {film.posterPath ? (
                <Image src={getPosterUrl(film.posterPath, 'w185')} alt={film.title}
                  fill unoptimized style={{ objectFit: 'cover' }} sizes="90px" />
              ) : (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>🎬</div>
              )}
              <div style={{
                position: 'absolute', bottom: '4px', right: '4px',
                background: 'rgba(0,0,0,0.75)', borderRadius: '8px',
                padding: '1px 5px', fontSize: '10px', fontWeight: 700,
                color: 'var(--accent)', backdropFilter: 'blur(4px)',
              }}>
                {film.conditions.length}
              </div>
            </div>
            <div style={{ padding: '6px 7px 7px' }}>
              <div style={{
                fontSize: '11px', fontWeight: 500, color: 'var(--text)',
                lineHeight: 1.3, display: '-webkit-box',
                WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                overflow: 'hidden', textAlign: 'left',
              }}>{film.title}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{film.year}</div>
            </div>
          </button>
        ))}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '8px' }}>
        Badge shows number of win conditions each film qualifies for.
      </div>
    </div>
  );
}

// ── Selected film header with info button ────────────────────────────────────
// ── Selected film header with info button ────────────────────────────────────

function SelectedFilmHeader({ film }: { film: SearchResult }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '14px 16px',
        background: 'var(--surface)',
        border: '1px solid var(--accent-dim)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: '20px',
      }}>
        {film.poster_path && (
          <Image
            src={getPosterUrl(film.poster_path, 'w185')}
            alt={film.title}
            width={40}
            height={60}
            unoptimized
            style={{ borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }}
          />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text)' }}>
            {film.title}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {film.release_date?.slice(0, 4)}
            {film.vote_average > 0 && (
              <span style={{ color: 'var(--accent)', marginLeft: '8px' }}>
                ★ {film.vote_average.toFixed(1)}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          aria-label={`${film.title} film info`}
          style={{
            width: '26px', height: '26px',
            borderRadius: '50%',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
            fontSize: '13px', fontWeight: 700,
            fontStyle: 'italic', fontFamily: 'Georgia, serif',
            cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--accent-dim)';
            e.currentTarget.style.color = 'var(--accent)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
        >i</button>
      </div>
      {showModal && (
        <FilmInfoModal
          tmdbId={film.id}
          title={film.title}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ConnectionExplorer() {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedFilm, setSelectedFilm] = useState<SearchResult | null>(null);
  const [allResults, setAllResults] = useState<FlatResult[]>([]);
  const [sort, setSort] = useState<ResultSort>('conditions');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [connectionLoading, setConnectionLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(query, 300);

  // Search TMDB when query changes
  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    setSearchLoading(true);
    fetch(`/api/search-films?q=${encodeURIComponent(debouncedQuery)}`)
      .then(r => r.json())
      .then(d => {
        setSearchResults(d.results ?? []);
        setShowDropdown(true);
      })
      .catch(() => setSearchResults([]))
      .finally(() => setSearchLoading(false));
  }, [debouncedQuery]);

  // Click outside to close dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectFilm = useCallback(async (film: SearchResult) => {
    setSelectedFilm(film);
    setQuery('');
    setShowDropdown(false);
    setSearchResults([]);
    setAllResults([]);
    setVisibleCount(PAGE_SIZE);
    setConnectionError(null);
    setConnectionLoading(true);

    try {
      const res = await fetch(`/api/connections?id=${film.id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const results = data.results ?? [];
      setAllResults(results);
      setVisibleCount(PAGE_SIZE);
    } catch (e) {
      setConnectionError(e instanceof Error ? e.message : 'Failed to load connections');
    } finally {
      setConnectionLoading(false);
    }
  }, []);

  const handleFilmSelect = useCallback((film: FlatResult) => {
    setSort('conditions');
    setVisibleCount(PAGE_SIZE);
    const searchResult: SearchResult = {
      id:           film.tmdbId,
      title:        film.title,
      release_date: `${film.year}-01-01`,
      poster_path:  film.posterPath ?? null,
      vote_average: film.rating ?? 0,
    };
    selectFilm(searchResult);
  }, [selectFilm]);

  const clearSelection = useCallback(() => {
    setSelectedFilm(null);
    setQuery('');
    setAllResults([]);
    setVisibleCount(PAGE_SIZE);
    setConnectionError(null);
    setSort('conditions');
  }, []);

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '24px',
          letterSpacing: '0.04em',
          color: 'var(--accent)',
          marginBottom: '6px',
        }}>
          CONNECTION EXPLORER
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Search for any film to see which tracked people connect it to current win conditions.
        </p>
      </div>

      {/* Suggestions — shown only before a film is selected */}
      {!selectedFilm && !connectionLoading && (
        <SuggestedFilms onSelect={selectFilm} />
      )}

      {/* Search box */}
      <div ref={searchRef} style={{ position: 'relative', marginBottom: '24px' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              if (selectedFilm) setSelectedFilm(null);
            }}
            placeholder="Search for a film…"
            style={{
              width: '100%',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '10px 40px 10px 14px',
              color: 'var(--text)',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.12s',
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = 'var(--accent-dim)';
              if (searchResults.length) setShowDropdown(true);
            }}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
          />
          {/* Clear / loading indicator */}
          {(query || searchLoading) && (
            <button
              onClick={clearSelection}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '16px',
                lineHeight: 1,
                padding: '2px',
              }}
            >
              {searchLoading ? '…' : '×'}
            </button>
          )}
        </div>

        {/* Dropdown results */}
        {showDropdown && searchResults.length > 0 && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'var(--surface)',
            border: '1px solid var(--accent-dim)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            zIndex: 100,
            overflow: 'hidden',
          }}>
            {searchResults.map((film, i) => (
              <button
                key={film.id}
                onClick={() => selectFilm(film)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  background: 'none',
                  border: 'none',
                  borderBottom: i < searchResults.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                {film.poster_path ? (
                  <Image
                    src={getPosterUrl(film.poster_path, 'w185')}
                    alt={film.title}
                    width={28}
                    height={42}
                    unoptimized
                    style={{ borderRadius: '3px', objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{
                    width: 28, height: 42,
                    background: 'var(--surface-2)',
                    borderRadius: '3px',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                  }}>🎬</div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--text)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {film.title}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {film.release_date?.slice(0, 4)}
                    {film.vote_average > 0 && (
                      <span style={{ color: 'var(--accent)', marginLeft: '8px' }}>
                        ★ {film.vote_average.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected film header */}
      {selectedFilm && (
        <div>
          <SelectedFilmHeader film={selectedFilm} />
          <button
            onClick={clearSelection}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              fontSize: '12px',
              cursor: 'pointer',
              padding: '0 0 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'color 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-muted)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
          >
            ← Start over
          </button>
        </div>
      )}

      {/* Loading state */}
      {connectionLoading && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          padding: '48px 0',
          color: 'var(--text-muted)',
          fontSize: '14px',
        }}>
          <style>{`
            @keyframes ceSpin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
          <div style={{
            width: '32px', height: '32px',
            border: '3px solid var(--border)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
            animation: 'ceSpin 0.8s linear infinite',
          }} />
          Finding connections…
        </div>
      )}

      {/* Error state */}
      {connectionError && (
        <div style={{
          padding: '16px',
          background: 'rgba(220,50,50,0.1)',
          border: '1px solid rgba(220,50,50,0.3)',
          borderRadius: 'var(--radius)',
          fontSize: '13px',
          color: 'var(--red, #e05050)',
        }}>
          {connectionError}
        </div>
      )}

      {/* No connections found */}
      {selectedFilm && !connectionLoading && !connectionError && allResults.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '48px 0',
          color: 'var(--text-muted)',
          fontSize: '14px',
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎬</div>
          No connections found through tracked people.
          <div style={{ fontSize: '12px', marginTop: '6px', color: 'var(--text-dim)' }}>
            This film doesn't share any directors, writers, composers,
            cinematographers, or top cast with the currently tracked people.
          </div>
        </div>
      )}

      {/* Flat results */}
      {allResults.length > 0 && (() => {
        const sorted = sortResults(allResults, sort);
        const visible = sorted.slice(0, visibleCount);
        return (
          <div>
            {/* Sort controls + count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {allResults.length} film{allResults.length !== 1 ? 's' : ''}
              </span>
              <select
                value={sort}
                onChange={e => { setSort(e.target.value as ResultSort); setVisibleCount(PAGE_SIZE); }}
                aria-label="Sort results"
                style={{
                  background: 'var(--surface-2)',
                  backgroundImage: 'url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%228%22%20viewBox%3D%220%200%2012%208%22%3E%3Cpath%20d%3D%22M1%201l5%205%205-5%22%20stroke%3D%22%23a0a0b0%22%20stroke-width%3D%221.5%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E")',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 10px center',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '5px 28px 5px 10px',
                  color: 'var(--text)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  outline: 'none',
                  appearance: 'none' as const,
                  marginLeft: 'auto',
                }}
              >
                <option value="conditions">Most Conditions</option>
                <option value="year_desc">Newest First</option>
                <option value="year_asc">Oldest First</option>
                <option value="rating">Highest Rated</option>
                <option value="title_asc">A–Z</option>
              </select>
            </div>

            {/* Film list */}
            <div>
              {visible.map(film => (
                <FlatFilmRow key={film.tmdbId} film={film} onSelect={handleFilmSelect} />
              ))}
            </div>

            {/* Load more */}
            {visibleCount < allResults.length && (
              <div style={{ textAlign: 'center', padding: '20px 0 8px' }}>
                <button
                  onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--accent)',
                    color: 'var(--accent)',
                    borderRadius: '6px',
                    padding: '8px 24px',
                    fontSize: '13px',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  Load more · {allResults.length - visibleCount} remaining
                </button>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
