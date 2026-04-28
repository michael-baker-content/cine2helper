'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { TMDBMovie, TMDBMovieDetail, TMDBCastMember, TMDBCrewMember } from '@/types/tmdb';
import { getPosterUrl } from '@/lib/tmdb';
import Image from 'next/image';

interface MovieCardProps {
  movie: TMDBMovie;
  compact?: boolean;
  index?: number; // for LCP eager loading
}

// ── Qualifying crew jobs (Cine2Nerdle connection rules) ─────────────────────
const DIRECTOR_JOBS = new Set(['Director']);
const WRITER_JOBS = new Set(['Writer', 'Screenplay', 'Story', 'Original Story', 'Screen Story', 'Novel']);
const COMPOSER_JOBS = new Set(['Original Music Composer', 'Music', 'Composer']);
const CINEMATOGRAPHER_JOBS = new Set(['Director of Photography', 'Cinematography']);

function groupCrew(crew: TMDBCrewMember[]) {
  const directors: string[] = [];
  const writers: string[] = [];
  const composers: string[] = [];
  const dops: string[] = [];

  const seenDirectors = new Set<number>();
  const seenWriters = new Set<number>();
  const seenComposers = new Set<number>();
  const seenDops = new Set<number>();

  for (const c of crew) {
    if (DIRECTOR_JOBS.has(c.job) && !seenDirectors.has(c.id)) {
      directors.push(c.name); seenDirectors.add(c.id);
    } else if (WRITER_JOBS.has(c.job) && !seenWriters.has(c.id)) {
      writers.push(c.name); seenWriters.add(c.id);
    } else if (COMPOSER_JOBS.has(c.job) && !seenComposers.has(c.id)) {
      composers.push(c.name); seenComposers.add(c.id);
    } else if (CINEMATOGRAPHER_JOBS.has(c.job) && !seenDops.has(c.id)) {
      dops.push(c.name); seenDops.add(c.id);
    }
  }

  return { directors, writers, composers, dops };
}

// ── Tooltip component ────────────────────────────────────────────────────────
function MovieTooltip({ movieId, anchorRect }: {
  movieId: number;
  anchorRect: DOMRect | null;
}) {
  const [detail, setDetail] = useState<TMDBMovieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/movie-detail?id=${movieId}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setDetail(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [movieId]);

  // Position tooltip: prefer right of card, flip left if near edge
  const style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
    width: '260px',
    background: 'var(--surface)',
    border: '1px solid var(--accent-dim)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    padding: '14px',
    pointerEvents: 'none',
    animation: 'tooltipIn 0.12s ease',
  };

  if (anchorRect) {
    const spaceRight = window.innerWidth - anchorRect.right;
    const spaceLeft = anchorRect.left;
    if (spaceRight >= 280) {
      style.left = anchorRect.right + 8;
    } else if (spaceLeft >= 280) {
      style.left = anchorRect.left - 268;
    } else {
      // Not enough space either side — center below
      style.left = Math.max(8, anchorRect.left - 60);
      style.top = anchorRect.bottom + 8;
    }
    if (!style.top) {
      const mid = anchorRect.top + anchorRect.height / 2;
      style.top = Math.max(8, Math.min(mid - 120, window.innerHeight - 340));
    }
  }

  if (loading) {
    return (
      <div ref={tooltipRef} style={style}>
        <div style={{ color: 'var(--text-dim)', fontSize: '12px', padding: '8px 0' }}>
          Loading…
        </div>
      </div>
    );
  }

  if (!detail?.credits) return null;

  const { directors, writers, composers, dops } = groupCrew(detail.credits.crew ?? []);
  const topCast = (detail.credits.cast ?? [])
    .sort((a, b) => a.order - b.order)
    .slice(0, 10);

  const Row = ({ label, names }: { label: string; names: string[] }) => {
    if (!names.length) return null;
    return (
      <div style={{ marginBottom: '8px' }}>
        <div style={{
          fontSize: '10px', color: 'var(--accent)', fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '3px',
        }}>{label}</div>
        <div style={{ fontSize: '12px', color: 'var(--text)', lineHeight: 1.4 }}>
          {names.join(', ')}
        </div>
      </div>
    );
  };

  return (
    <div ref={tooltipRef} style={style}>
      <div style={{
        fontWeight: 700, fontSize: '13px', marginBottom: '10px',
        lineHeight: 1.3, color: 'var(--text)',
        borderBottom: '1px solid var(--border)', paddingBottom: '8px',
      }}>
        {detail.title}
        <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: '6px' }}>
          {detail.release_date?.slice(0, 4)}
        </span>
      </div>

      <Row label="Director" names={directors} />
      <Row label={writers.length > 1 ? 'Writers' : 'Writer'} names={writers} />
      <Row label="Cinematography" names={dops} />
      <Row label="Composer" names={composers} />

      {topCast.length > 0 && (
        <div>
          <div style={{
            fontSize: '10px', color: 'var(--accent)', fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px',
          }}>Cast</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {topCast.map(c => (
              <span key={c.id} style={{
                fontSize: '11px', color: 'var(--text-muted)',
                background: 'var(--surface-2)',
                borderRadius: '10px', padding: '2px 8px',
              }}>
                {c.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main MovieCard ────────────────────────────────────────────────────────────
export default function MovieCard({ movie, compact = false, index = 99 }: MovieCardProps) {
  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : '?';
  const rating = movie.vote_average?.toFixed(1) ?? '?';
  const [showTooltip, setShowTooltip] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleShow = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setAnchorRect(cardRef.current?.getBoundingClientRect() ?? null);
    setShowTooltip(true);
  }, []);

  const handleHide = useCallback(() => {
    hideTimer.current = setTimeout(() => setShowTooltip(false), 100);
  }, []);

  // Mobile: toggle on tap
  const handleTap = useCallback(() => {
    if (showTooltip) {
      setShowTooltip(false);
    } else {
      setAnchorRect(cardRef.current?.getBoundingClientRect() ?? null);
      setShowTooltip(true);
    }
  }, [showTooltip]);

  // Close tooltip on outside tap (mobile)
  useEffect(() => {
    if (!showTooltip) return;
    const handler = (e: TouchEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setShowTooltip(false);
      }
    };
    document.addEventListener('touchstart', handler);
    return () => document.removeEventListener('touchstart', handler);
  }, [showTooltip]);

  const tooltip = showTooltip ? (
    <MovieTooltip movieId={movie.id} anchorRect={anchorRect} />
  ) : null;

  if (compact) {
    return (
      <>
        <div
          ref={cardRef}
          onMouseEnter={(e) => { handleShow(); e.currentTarget.style.borderColor = 'var(--accent-dim)'; }}
          onMouseLeave={(e) => { handleHide(); e.currentTarget.style.borderColor = 'var(--border)'; }}
          onTouchStart={handleTap}
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            padding: '8px 12px',
            background: 'var(--surface)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            transition: 'border-color 0.15s',
            cursor: 'default',
          }}
        >
          {movie.poster_path ? (
            <Image
              src={getPosterUrl(movie.poster_path, 'w185')}
              alt={movie.title}
              width={32}
              height={48}
              loading={index < 8 ? 'eager' : 'lazy'}
              style={{ borderRadius: '3px', objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <div style={{
              width: 32, height: 48, background: 'var(--surface-2)',
              borderRadius: '3px', flexShrink: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: '18px',
            }}>🎬</div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontWeight: 500, whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '13px',
            }}>{movie.title}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{year}</div>
            {movie._matchingPersons && movie._matchingPersons.length > 0 && (
              <div style={{
                fontSize: '11px', color: 'var(--accent-dim)',
                marginTop: '2px', fontStyle: 'italic',
              }}>
                {movie._matchingPersons.join(' · ')}
              </div>
            )}
          </div>
          <div style={{ marginLeft: 'auto', flexShrink: 0, color: 'var(--accent)', fontSize: '12px' }}>
            ★ {rating}
          </div>
        </div>
        {tooltip}
      </>
    );
  }

  return (
    <>
      <div
        ref={cardRef}
        onMouseEnter={handleShow}
        onMouseLeave={handleHide}
        onTouchStart={handleTap}
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          transition: 'transform 0.15s, border-color 0.15s, box-shadow 0.15s',
          cursor: 'default',
          display: 'flex',
          flexDirection: 'column',
        }}

      >
        <div style={{ position: 'relative', aspectRatio: '2/3', background: 'var(--surface-2)' }}>
          {movie.poster_path ? (
            <Image
              src={getPosterUrl(movie.poster_path, 'w342')}
              alt={movie.title}
              fill
              loading={index < 8 ? 'eager' : 'lazy'}
              style={{ objectFit: 'cover' }}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
            />
          ) : (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: '48px', color: 'var(--text-dim)',
            }}>🎬</div>
          )}
          <div style={{
            position: 'absolute', top: '8px', right: '8px',
            background: 'rgba(0,0,0,0.8)', borderRadius: '4px',
            padding: '2px 6px', fontSize: '12px',
            color: 'var(--accent)', fontWeight: 600,
            backdropFilter: 'blur(4px)',
          }}>
            ★ {rating}
          </div>
        </div>
        <div style={{ padding: '10px 12px 12px', flex: 1 }}>
          <div style={{
            fontWeight: 500, fontSize: '13px', lineHeight: 1.3,
            marginBottom: '4px', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {movie.title}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{year}</div>
          {movie._matchingPersons && movie._matchingPersons.length > 0 && (
            <div style={{
              fontSize: '11px', color: 'var(--accent-dim)',
              marginTop: '3px', fontStyle: 'italic', lineHeight: 1.3,
            }}>
              {movie._matchingPersons.join(' · ')}
            </div>
          )}
        </div>
      </div>
      {tooltip}
    </>
  );
}
