'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { TMDBMovie, TMDBMovieDetail, TMDBCastMember, TMDBCrewMember } from '@/types/tmdb';
import { WIN_CONDITIONS_MAP } from '@/lib/win-conditions';
import { getPosterUrl } from '@/lib/tmdb';
import Image from 'next/image';

interface MovieCardProps {
  movie: TMDBMovie;
  compact?: boolean;
  index?: number;
  onOverlapClick?: (conditionId: string) => void;
}

const DIRECTOR_JOBS      = new Set(['Director']);
const WRITER_JOBS        = new Set(['Writer', 'Screenplay', 'Story', 'Original Story', 'Screen Story', 'Novel']);
const COMPOSER_JOBS      = new Set(['Original Music Composer', 'Music', 'Composer']);
const CINEMATOGRAPHER_JOBS = new Set(['Director of Photography', 'Cinematography']);

function groupCrew(crew: TMDBCrewMember[]) {
  const directors: string[] = [], writers: string[] = [],
        composers: string[] = [], dops: string[] = [];
  const seen = { d: new Set<number>(), w: new Set<number>(),
                 c: new Set<number>(), dp: new Set<number>() };
  for (const c of crew) {
    if      (DIRECTOR_JOBS.has(c.job)        && !seen.d.has(c.id))  { directors.push(c.name); seen.d.add(c.id); }
    else if (WRITER_JOBS.has(c.job)          && !seen.w.has(c.id))  { writers.push(c.name);   seen.w.add(c.id); }
    else if (COMPOSER_JOBS.has(c.job)        && !seen.c.has(c.id))  { composers.push(c.name); seen.c.add(c.id); }
    else if (CINEMATOGRAPHER_JOBS.has(c.job) && !seen.dp.has(c.id)) { dops.push(c.name);      seen.dp.add(c.id); }
  }
  return { directors, writers, composers, dops };
}

// ── Overlap chips ─────────────────────────────────────────────────────────────

function OverlapChips({
  conditionIds,
  onChipClick,
}: {
  conditionIds: string[];
  onChipClick?: (conditionId: string) => void;
}) {
  if (!conditionIds.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '5px' }}>
      {conditionIds.map((id) => {
        const label = WIN_CONDITIONS_MAP.get(id)?.label ?? id;
        return (
          <button
            key={id}
            onClick={(e) => {
              e.stopPropagation();
              onChipClick?.(id);
            }}
            title={`Filter by: ${label}`}
            style={{
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.03em',
              padding: '2px 7px',
              borderRadius: '10px',
              border: '1px solid var(--accent-dim)',
              background: 'var(--accent-glow)',
              color: 'var(--accent)',
              cursor: onChipClick ? 'pointer' : 'default',
              lineHeight: 1.4,
              transition: 'all 0.12s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
              if (!onChipClick) return;
              e.currentTarget.style.background = 'var(--accent)';
              e.currentTarget.style.color = 'var(--bg)';
              e.currentTarget.style.borderColor = 'var(--accent)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--accent-glow)';
              e.currentTarget.style.color = 'var(--accent)';
              e.currentTarget.style.borderColor = 'var(--accent-dim)';
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Info modal ────────────────────────────────────────────────────────────────
function InfoModal({ movie, onClose, triggerRef }: {
  movie: TMDBMovie;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const [detail, setDetail]   = useState<TMDBMovieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const year = movie.release_date?.slice(0, 4) ?? '?';
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/movie-detail?id=${movie.id}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setDetail(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [movie.id]);

  // Focus the modal panel on open, return focus on close
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    modalRef.current?.focus();
    return () => {
      (triggerRef.current ?? previousFocus)?.focus();
    };
  }, [triggerRef]);

  // Focus trap — keep Tab/Shift+Tab inside the modal
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;
    const focusable = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    const trap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const Row = ({ label, names }: { label: string; names: string[] }) => {
    if (!names.length) return null;
    return (
      <div style={{ marginBottom: '12px' }}>
        <div style={{
          fontSize: '10px', color: 'var(--accent)', fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px',
        }}>{label}</div>
        <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.5 }}>
          {names.join(', ')}
        </div>
      </div>
    );
  };

  const { directors, writers, composers, dops } =
    detail?.credits ? groupCrew(detail.credits.crew ?? []) : { directors: [], writers: [], composers: [], dops: [] };
  const topCast = (detail?.credits?.cast ?? [])
    .sort((a, b) => a.order - b.order)
    .slice(0, 10);

  return (
    <>
      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 1000,
          background: 'rgba(0,0,0,0.72)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}
      >
        {/* Modal panel — stop propagation so clicks inside don't close */}
        <div
          ref={modalRef}
          onClick={e => e.stopPropagation()}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={`${movie.title} film details`}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--accent-dim)',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '420px',
            maxHeight: '85vh',
            overflowY: 'auto',
            boxShadow: '0 16px 64px rgba(0,0,0,0.7)',
            animation: 'modalIn 0.2s ease forwards',
            position: 'relative',
            outline: 'none',
          }}
        >
          {/* Header with poster + title */}
          <div style={{
            display: 'flex', gap: '14px', padding: '16px 16px 0',
            alignItems: 'flex-start',
          }}>
            {movie.poster_path && (
              <Image
                src={getPosterUrl(movie.poster_path, 'w185')}
                alt={movie.title}
                width={60}
                height={90}
                style={{ borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0, paddingTop: '4px' }}>
              <div style={{
                fontWeight: 700, fontSize: '16px', lineHeight: 1.3,
                color: 'var(--text)', marginBottom: '4px',
              }}>
                {movie.title}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '6px' }}>
                {year}
                {movie.vote_average != null && (
                  <span style={{ color: 'var(--accent)', marginLeft: '10px' }}>
                    ★ {movie.vote_average.toFixed(1)}
                  </span>
                )}
              </div>
              {movie._matchingPersons && movie._matchingPersons.length > 0 && (
                <div style={{
                  fontSize: '11px', color: 'var(--accent-dim)',
                  fontStyle: 'italic', lineHeight: 1.4,
                }}>
                  {movie._matchingPersons.join(' · ')}
                </div>
              )}
            </div>
            {/* Close button */}
            <button
              onClick={onClose}
              style={{
                flexShrink: 0,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: '50%',
                width: '28px', height: '28px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--text-muted)',
                fontSize: '16px', lineHeight: 1,
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
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--border)', margin: '14px 16px 0' }} />

          {/* Credits body */}
          <div style={{ padding: '14px 16px 20px' }}>
            {loading ? (
              <div style={{ color: 'var(--text-dim)', fontSize: '13px', padding: '8px 0' }}>
                Loading credits…
              </div>
            ) : !detail?.credits ? (
              <div style={{ color: 'var(--text-dim)', fontSize: '13px' }}>
                No credits available.
              </div>
            ) : (
              <>
                <Row label="Director"      names={directors} />
                <Row label={writers.length > 1 ? 'Writers' : 'Writer'} names={writers} />
                <Row label="Cinematography" names={dops} />
                <Row label="Composer"      names={composers} />
                {topCast.length > 0 && (
                  <div>
                    <div style={{
                      fontSize: '10px', color: 'var(--accent)', fontWeight: 700,
                      letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px',
                    }}>Cast</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      {topCast.map(c => (
                        <span key={c.id} style={{
                          fontSize: '12px', color: 'var(--text-muted)',
                          background: 'var(--surface-2)',
                          borderRadius: '12px', padding: '3px 10px',
                          border: '1px solid var(--border)',
                        }}>
                          {c.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main MovieCard ────────────────────────────────────────────────────────────
export default function MovieCard({
  movie,
  compact = false,
  index = 99,
  onOverlapClick,
}: MovieCardProps) {
  const year   = movie.release_date ? new Date(movie.release_date).getFullYear() : '?';
  const rating = movie.vote_average?.toFixed(1) ?? '?';
  const [showModal, setShowModal] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const openModal  = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowModal(true);
  }, []);
  const closeModal = useCallback(() => setShowModal(false), []);

  const modal = showModal
    ? <InfoModal movie={movie} onClose={closeModal} triggerRef={triggerRef} />
    : null;

  const overlapConditions = movie._overlapConditions ?? [];

  if (compact) {
    return (
      <>
        <div style={{
          display: 'flex', gap: '10px', alignItems: 'center',
          padding: '8px 12px',
          background: 'var(--surface)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          transition: 'border-color 0.15s',
          position: 'relative',
        }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-dim)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        >
          {movie.poster_path ? (
            <Image
              src={getPosterUrl(movie.poster_path, 'w185')}
              alt={movie.title}
              width={32} height={48}
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
          <div style={{ minWidth: 0, flex: 1 }}>
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
            {overlapConditions.length > 0 && (
              <OverlapChips conditionIds={overlapConditions} onChipClick={onOverlapClick} />
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span style={{ color: 'var(--accent)', fontSize: '12px' }}>★ {rating}</span>
            <button
              ref={triggerRef}
              onClick={openModal}
              aria-label={`${movie.title} film info`}
              style={{
                width: '20px', height: '20px',
                borderRadius: '50%',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                fontSize: '11px', fontWeight: 700,
                fontStyle: 'italic', fontFamily: 'Georgia, serif',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.12s', lineHeight: 1,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--accent-dim)';
                e.currentTarget.style.color = 'var(--accent)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              i
            </button>
          </div>
        </div>
        {modal}
      </>
    );
  }

  // Grid card
  return (
    <>
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          transition: 'transform 0.15s, border-color 0.15s, box-shadow 0.15s',
          cursor: 'default',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-3px)';
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
          {/* Rating badge */}
          <div style={{
            position: 'absolute', top: '8px', right: '8px',
            background: 'rgba(0,0,0,0.8)', borderRadius: '4px',
            padding: '2px 6px', fontSize: '12px',
            color: 'var(--accent)', fontWeight: 600,
            backdropFilter: 'blur(4px)',
          }}>
            ★ {rating}
          </div>
          {/* Info button — bottom right of poster */}
          <button
            ref={triggerRef}
            onClick={openModal}
            aria-label={`${movie.title} film info`}
            style={{
              position: 'absolute',
              bottom: '8px', right: '8px',
              width: '22px', height: '22px',
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.65)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.8)',
              fontSize: '12px',
              fontWeight: 700,
              fontStyle: 'italic',
              fontFamily: 'Georgia, serif',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(4px)',
              transition: 'all 0.12s',
              lineHeight: 1,
              zIndex: 2,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--accent)';
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.color = 'var(--bg)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(0,0,0,0.65)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
            }}
          >
            i
          </button>
        </div>

        <div style={{ padding: '10px 12px 12px', flex: 1 }}>
          <div style={{
            fontWeight: 500, fontSize: '13px', lineHeight: 1.3,
            marginBottom: '4px', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
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
          {overlapConditions.length > 0 && (
            <OverlapChips conditionIds={overlapConditions} onChipClick={onOverlapClick} />
          )}
        </div>
      </div>
      {modal}
    </>
  );
}
