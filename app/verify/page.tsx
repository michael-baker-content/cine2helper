/**
 * app/verify/page.tsx
 *
 * Admin verification page for curated film lists.
 * Loads every film from every static list, fetches poster + title from TMDB,
 * and displays them in a grid so mismatches are immediately visible.
 *
 * Visit: http://localhost:3000/verify
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import {
  SCIFI_80S,
  ROMANCE_90S,
  HORROR_2000S,
  CuratedFilm,
} from '@/lib/decade-genre-lists';
import { OSCAR_WINNERS, OscarWinner } from '@/lib/oscar-winners';

// ── Types ─────────────────────────────────────────────────────────────────────

interface VerifiedFilm {
  tmdbId: number;
  inputTitle: string;
  inputYear: number;
  tmdbTitle?: string;
  fetchedTitle: string | null;
  fetchedYear: string | null;
  posterPath: string | null;
  status: 'ok' | 'mismatch' | 'missing' | 'loading' | 'error';
}

interface ListResult {
  name: string;
  films: VerifiedFilm[];
  done: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const OSCAR_FILMS: CuratedFilm[] = OSCAR_WINNERS.map((f: OscarWinner) => ({
  tmdbId: f.tmdbId,
  title: f.title,
  year: f.year,
  tmdbTitle: f.tmdbTitle,
}));

const LISTS: { name: string; films: CuratedFilm[] }[] = [
  {
    name: 'All',
    films: [
      ...SCIFI_80S,
      ...ROMANCE_90S,
      ...HORROR_2000S,
      ...OSCAR_FILMS,
    ],
  },
  { name: "'80s Sci-Fi",    films: SCIFI_80S },
  { name: "'90s Romance",   films: ROMANCE_90S },
  { name: '2000s Horror',   films: HORROR_2000S },
  { name: 'Oscar Winners',  films: OSCAR_FILMS },
];

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w185';
const BATCH_SIZE = 10; // concurrent fetches per batch

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(status: VerifiedFilm['status']): string {
  switch (status) {
    case 'ok':       return '#22c55e';
    case 'mismatch': return '#f59e0b';
    case 'missing':  return '#ef4444';
    case 'error':    return '#ef4444';
    case 'loading':  return '#6b7280';
    default:         return '#6b7280';
  }
}

function statusLabel(status: VerifiedFilm['status']): string {
  switch (status) {
    case 'ok':       return '✓';
    case 'mismatch': return '⚠ MISMATCH';
    case 'missing':  return '✗ MISSING';
    case 'error':    return '✗ ERROR';
    case 'loading':  return '…';
    default:         return '?';
  }
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function VerifyPage() {
  const [results, setResults] = useState<ListResult[]>(
    LISTS.map((l) => ({
      name: l.name,
      films: l.films.map((f) => ({
        tmdbId: f.tmdbId,
        inputTitle: f.title,
        inputYear: f.year,
        tmdbTitle: f.tmdbTitle,
        fetchedTitle: null,
        fetchedYear: null,
        posterPath: null,
        status: 'loading' as const,
      })),
      done: false,
    }))
  );

  const [activeList, setActiveList] = useState(0);
  const [filter, setFilter] = useState<'all' | 'issues'>('all');
  const [started, setStarted] = useState(false);

  const fetchFilm = useCallback(
    async (tmdbId: number): Promise<Partial<VerifiedFilm>> => {
      try {
        const res = await fetch(`/api/verify-film?id=${tmdbId}`);
        if (!res.ok) return { status: 'error' };
        const data = await res.json();
        if (!data.id) return { status: 'missing' };
        return {
          fetchedTitle: data.title,
          fetchedYear: data.release_date?.slice(0, 4) ?? null,
          posterPath: data.poster_path,
          status: 'ok',
        };
      } catch {
        return { status: 'error' };
      }
    },
    []
  );

  const runVerification = useCallback(async () => {
    setStarted(true);

    for (let listIdx = 0; listIdx < LISTS.length; listIdx++) {
      const list = LISTS[listIdx];

      for (let i = 0; i < list.films.length; i += BATCH_SIZE) {
        const batch = list.films.slice(i, i + BATCH_SIZE);
        const fetched = await Promise.all(batch.map((f) => fetchFilm(f.tmdbId)));

        setResults((prev) => {
          const next = [...prev];
          const listResult = { ...next[listIdx] };
          const films = [...listResult.films];

          batch.forEach((film, batchIdx) => {
            const filmIdx = i + batchIdx;
            const result = fetched[batchIdx];
            const current = films[filmIdx];

            let status: VerifiedFilm['status'] = result.status ?? 'error';
            if (status === 'ok' && result.fetchedTitle) {
              // Normalize for comparison: lowercase + middle-dot variants (e.g. WALL·E vs WALL-E)
              const normalize = (s: string) => s.toLowerCase().trim().replace(/[·•]/g, '-');
              const fetched = normalize(result.fetchedTitle);
              const expected = normalize(current.inputTitle);
              const knownTmdb = normalize(current.tmdbTitle ?? '');
              const titleMatch = fetched === expected || (knownTmdb && fetched === knownTmdb);
              const yearMatch = result.fetchedYear === String(current.inputYear);
              if (!titleMatch || !yearMatch) status = 'mismatch';
            }

            films[filmIdx] = { ...current, ...result, status };
          });

          listResult.films = films;
          next[listIdx] = listResult;
          return next;
        });
      }

      setResults((prev) => {
        const next = [...prev];
        next[listIdx] = { ...next[listIdx], done: true };
        return next;
      });
    }
  }, [fetchFilm]);

  // Summary counts
  const currentList = results[activeList];
  const visible = filter === 'issues'
    ? currentList.films.filter((f) => f.status !== 'ok' && f.status !== 'loading')
    : currentList.films;

  const totalIssues = currentList.films.filter(
    (f) => f.status === 'mismatch' || f.status === 'missing' || f.status === 'error'
  ).length;
  const totalDone = currentList.films.filter((f) => f.status !== 'loading').length;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#e5e5e5',
      fontFamily: '"DM Sans", sans-serif',
    }}>

      {/* Header */}
      <div style={{
        borderBottom: '1px solid #1f1f1f',
        padding: '24px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        background: '#0a0a0a',
        zIndex: 10,
      }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 3, color: '#666', textTransform: 'uppercase', marginBottom: 4 }}>
            Cine2Nerdle
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#fff' }}>
            ID Verification
          </h1>
        </div>

        {!started ? (
          <button
            onClick={runVerification}
            style={{
              background: '#f59e0b',
              color: '#000',
              border: 'none',
              padding: '10px 24px',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            Run Verification
          </button>
        ) : (
          <div style={{ fontSize: 13, color: '#666' }}>
            {totalDone} / {currentList.films.length} checked
            {totalIssues > 0 && (
              <span style={{ color: '#ef4444', marginLeft: 12 }}>
                {totalIssues} issue{totalIssues !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </div>

      {/* List tabs */}
      <div style={{
        display: 'flex',
        gap: 2,
        padding: '0 32px',
        borderBottom: '1px solid #1f1f1f',
        background: '#0a0a0a',
        position: 'sticky',
        top: 73,
        zIndex: 9,
      }}>
        {results.map((list, idx) => {
          const issues = list.films.filter(
            (f) => f.status === 'mismatch' || f.status === 'missing' || f.status === 'error'
          ).length;
          return (
            <button
              key={list.name}
              onClick={() => setActiveList(idx)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeList === idx ? '2px solid #f59e0b' : '2px solid transparent',
                color: activeList === idx ? '#fff' : '#666',
                padding: '12px 16px',
                fontSize: 13,
                cursor: 'pointer',
                fontWeight: activeList === idx ? 600 : 400,
                whiteSpace: 'nowrap',
              }}
            >
              {list.name}
              {issues > 0 && (
                <span style={{
                  background: '#ef4444',
                  color: '#fff',
                  borderRadius: 10,
                  fontSize: 10,
                  padding: '1px 6px',
                  marginLeft: 6,
                  fontWeight: 700,
                }}>
                  {issues}
                </span>
              )}
              {list.done && issues === 0 && started && (
                <span style={{ color: '#22c55e', marginLeft: 6, fontSize: 11 }}>✓</span>
              )}
            </button>
          );
        })}

        {/* Filter toggle */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
          <button
            onClick={() => setFilter('all')}
            style={{
              background: filter === 'all' ? '#1f1f1f' : 'none',
              border: '1px solid #2a2a2a',
              color: filter === 'all' ? '#fff' : '#666',
              padding: '4px 12px',
              borderRadius: 4,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            All
          </button>
          <button
            onClick={() => setFilter('issues')}
            style={{
              background: filter === 'issues' ? '#1f1f1f' : 'none',
              border: '1px solid #2a2a2a',
              color: filter === 'issues' ? '#fff' : '#666',
              padding: '4px 12px',
              borderRadius: 4,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Issues only
          </button>
        </div>
      </div>

      {/* Film grid */}
      <div style={{
        padding: '24px 32px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 16,
      }}>
        {visible.map((film, idx) => (
          <div
            key={`${activeList}-${idx}-${film.tmdbId}`}
            style={{
              background: '#111',
              borderRadius: 8,
              overflow: 'hidden',
              border: `1px solid ${
                film.status === 'ok' ? '#1f1f1f' :
                film.status === 'loading' ? '#1f1f1f' :
                film.status === 'mismatch' ? '#78350f' : '#450a0a'
              }`,
              position: 'relative',
            }}
          >
            {/* Poster */}
            <div style={{ position: 'relative', aspectRatio: '2/3', background: '#1a1a1a' }}>
              {film.posterPath ? (
                <Image
                  src={`${TMDB_IMAGE_BASE}${film.posterPath}`}
                  alt={film.fetchedTitle ?? film.inputTitle}
                  fill
                  style={{ objectFit: 'cover' }}
                  sizes="140px"
                  loading={idx < 8 ? 'eager' : 'lazy'}
                />
              ) : (
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#333',
                  fontSize: 28,
                }}>
                  {film.status === 'loading' ? '⋯' : '✗'}
                </div>
              )}

              {/* Status badge */}
              <div style={{
                position: 'absolute',
                top: 6,
                right: 6,
                background: statusColor(film.status),
                color: film.status === 'ok' ? '#000' : '#fff',
                borderRadius: 4,
                fontSize: 9,
                fontWeight: 700,
                padding: '2px 5px',
                letterSpacing: 0.5,
              }}>
                {statusLabel(film.status)}
              </div>
            </div>

            {/* Info */}
            <div style={{ padding: '8px 10px' }}>
              {/* Input (what we have) */}
              <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>
                Expected:
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#e5e5e5', lineHeight: 1.3, marginBottom: 1 }}>
                {film.inputTitle}
              </div>
              <div style={{ fontSize: 11, color: '#666', marginBottom: film.tmdbTitle ? 2 : 6 }}>
                {film.inputYear} · ID {film.tmdbId}
              </div>
              {film.tmdbTitle && (
                <div style={{ fontSize: 10, color: '#555', marginBottom: 6, fontStyle: 'italic' }}>
                  TMDB: "{film.tmdbTitle}"
                </div>
              )}

              {/* Fetched (what TMDB returned) */}
              {film.fetchedTitle && film.fetchedTitle !== film.inputTitle && (
                <>
                  <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 2 }}>
                    Got:
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b', lineHeight: 1.3, marginBottom: 1 }}>
                    {film.fetchedTitle}
                  </div>
                  <div style={{ fontSize: 11, color: '#f59e0b' }}>
                    {film.fetchedYear}
                  </div>
                </>
              )}

              {film.status === 'missing' && (
                <div style={{ fontSize: 11, color: '#ef4444' }}>
                  ID not found on TMDB
                </div>
              )}
            </div>
          </div>
        ))}

        {visible.length === 0 && filter === 'issues' && currentList.done && (
          <div style={{
            gridColumn: '1 / -1',
            textAlign: 'center',
            padding: '60px 0',
            color: '#22c55e',
            fontSize: 16,
          }}>
            ✓ No issues found in this list
          </div>
        )}

        {!started && (
          <div style={{
            gridColumn: '1 / -1',
            textAlign: 'center',
            padding: '60px 0',
            color: '#444',
            fontSize: 14,
          }}>
            Press "Run Verification" to begin checking TMDB IDs
          </div>
        )}
      </div>
    </div>
  );
}
