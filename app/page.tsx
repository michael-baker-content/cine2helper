'use client';

import { useState, useRef, useEffect } from 'react';
import WinConditionPanel from '@/components/WinConditionPanel';
import OverlapAnalyzer from '@/components/OverlapAnalyzer';
import { WIN_CONDITIONS, CATEGORY_LABELS } from '@/lib/win-conditions';
import { WinCondition, WinConditionCategory } from '@/types/tmdb';
import Image from 'next/image';
import { getPosterUrl } from '@/lib/tmdb';
import FeedbackModal from '@/components/FeedbackModal';

type View = 'home' | 'condition' | 'overlap';

const OVERVIEW_CATEGORY_ORDER: WinConditionCategory[] = ['themed', 'decade', 'person'];

// ── Condition preview card ────────────────────────────────────────────────────
interface PreviewMovie { id: number; title: string; poster_path: string | null; }

function ConditionCard({ condition, onClick }: {
  condition: WinCondition;
  onClick: () => void;
}) {
  const [posters, setPosters] = useState<PreviewMovie[]>([]);

  useEffect(() => {
    fetch(`/api/condition-preview?condition=${encodeURIComponent(condition.id)}`)
      .then(r => r.json())
      .then(d => setPosters(d.movies ?? []))
      .catch(() => {});
  }, [condition.id]);

  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'transform 0.15s, border-color 0.15s, box-shadow 0.15s',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
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
      <div className="condition-card-poster" style={{
        display: 'flex', height: '100px',
        background: 'var(--surface-2)', overflow: 'hidden', position: 'relative',
      }}>
        {posters.length === 0 ? (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '32px', color: 'var(--text-dim)',
          }}>🎬</div>
        ) : posters.map((p, i) => (
          <div key={p.id} style={{
            flex: 1, position: 'relative',
            borderRight: i < posters.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            {p.poster_path && (
              <Image
                src={getPosterUrl(p.poster_path, 'w185')}
                alt={p.title}
                fill
                sizes="80px"
                style={{ objectFit: 'cover', objectPosition: 'center top' }}
              />
            )}
          </div>
        ))}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)',
        }} />
      </div>
      <div style={{ padding: '12px 14px 14px' }}>
        <div className="condition-card-label" style={{
          fontFamily: 'var(--font-display)', fontSize: '14px',
          letterSpacing: '0.04em', color: 'var(--accent)', marginBottom: '4px',
        }}>{condition.label}</div>
        <div className="condition-card-desc" style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          {condition.description}
        </div>
      </div>
    </button>
  );
}

// ── Home page (hero + conditions grid) ───────────────────────────────────────
function HomePage({
  onSelectCondition,
  onOverlap,
  conditionsRef,
}: {
  onSelectCondition: (id: string) => void;
  onOverlap: () => void;
  conditionsRef: React.RefObject<HTMLDivElement | null>;
}) {
  const grouped = OVERVIEW_CATEGORY_ORDER.reduce<Record<string, WinCondition[]>>((acc, cat) => {
    const items = WIN_CONDITIONS.filter(wc => wc.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  return (
    <div style={{ overflowY: 'auto', height: '100%' }}>

      {/* Hero */}
      <div className="mobile-hero-wrap" style={{ maxWidth: '1400px', margin: '0 auto', padding: '64px 32px 0', textAlign: 'center' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', paddingBottom: '64px' }}>
        <div style={{
          fontSize: '13px',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--accent-dim)',
          marginBottom: '18px',
          fontWeight: 600,
        }}>
          A companion tool for
        </div>
        <h1 className="hero-heading" style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(32px, 6vw, 52px)',
          letterSpacing: '0.06em',
          color: 'var(--accent)',
          marginBottom: '24px',
          lineHeight: 1.1,
        }}>
          CINE2NERDLE BATTLE 2.0
        </h1>
        <p style={{
          fontSize: '16px',
          color: 'var(--text-muted)',
          lineHeight: 1.7,
          marginBottom: '32px',
          maxWidth: '520px',
          margin: '0 auto 32px',
        }}
        className="hero-body">
          Cine2Nerdle challenges players to find connections between films through their shared cast and crew. 
          In Battle 2.0 mode, players can win faster by completing a win condition.
          That may mean playing films from a particular film, actor, or genre, for example.
          Explore Season 6's conditions below to learn which films qualify for each option.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => conditionsRef.current?.scrollIntoView({ behavior: 'smooth' })}
            aria-label="Scroll to win conditions"
            className="hero-cta"
            style={{
              padding: '12px 28px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius)',
              color: 'var(--bg)',
              fontFamily: 'var(--font-display)',
              fontSize: '14px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              cursor: 'pointer',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            WIN CONDITIONS ↓
          </button>
          <button
            onClick={onOverlap}
            aria-label="Open overlap analyzer"
            className="hero-cta"
            style={{
              padding: '12px 28px',
              background: 'transparent',
              border: '1px solid var(--accent-dim)',
              borderRadius: 'var(--radius)',
              color: 'var(--accent)',
              fontFamily: 'var(--font-display)',
              fontSize: '14px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--accent-glow)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            OVERLAP ANALYZER →
          </button>
          <a
            href="https://www.cinenerdle2.app/battle"
            target="_blank"
            rel="noreferrer"
            style={{
              padding: '12px 28px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-display)',
              fontSize: '14px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              cursor: 'pointer',
              textDecoration: 'none',
              transition: 'border-color 0.15s',
              display: 'inline-block',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-dim)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            PLAY THE GAME ↗
          </a>
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border)', margin: '0 auto', maxWidth: '1400px', padding: '0 20px' }} />

      {/* Win conditions grid */}
      <div className="mobile-grid-wrap" style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px 24px 48px' }}>
      <div ref={conditionsRef}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '22px',
          letterSpacing: '0.06em',
          color: 'var(--accent)',
          marginBottom: '6px',
        }}>WIN CONDITIONS</h2>
        <p style={{
          fontSize: '14px', color: 'var(--text-muted)',
          marginBottom: '32px', lineHeight: 1.5,
        }}>
          Click any condition to browse qualifying films. Use the ⓘ button on any film for cast and crew details.
        </p>

        {OVERVIEW_CATEGORY_ORDER.filter(cat => grouped[cat]).map(cat => (
          <div key={cat} style={{ marginBottom: '36px' }}>
            <h3 className="category-heading" style={{
              fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'var(--text-dim)',
              marginBottom: '14px', paddingBottom: '8px',
              borderBottom: '1px solid var(--border)',
            }}>
              {CATEGORY_LABELS[cat] ?? cat}
            </h3>
            <div className="condition-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '14px',
              justifyContent: 'center',
            }}>
              {grouped[cat].map(wc => (
                <ConditionCard
                  key={wc.id}
                  condition={wc}
                  onClick={() => onSelectCondition(wc.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      </div>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function RootPage() {
  const [view, setView] = useState<View>('home');
  const [activeCondition, setActiveCondition] = useState<string | null>(null);
  const conditionsRef = useRef<HTMLDivElement>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const selectCondition = (id: string) => {
    setActiveCondition(id);
    setView('condition');
  };

  const goHome = () => {
    setView('home');
    setActiveCondition(null);
  };

  const goHomeScrolled = () => {
    if (view === 'home') {
      conditionsRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      setView('home');
      setActiveCondition(null);
      // After state update, scroll on next tick
      setTimeout(() => conditionsRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };

  const conditionLabel = WIN_CONDITIONS.find(w => w.id === activeCondition)?.label ?? '';

  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes tooltipIn {
          from { opacity: 0; transform: scale(0.96) translateY(4px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        * { box-sizing: border-box; }
        @media (max-width: 640px) {
          .desktop-only { display: none !important; }

          /* Tighter side padding so cards fill the screen edge-to-edge */
          .mobile-grid-wrap { padding-left: 10px !important; padding-right: 10px !important; }
          .mobile-hero-wrap { padding-left: 16px !important; padding-right: 16px !important; }

          /* Condition grid — single column, card fills full width */
          .condition-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }

          /* Card typography */
          .condition-card-poster { height: 160px !important; }
          .condition-card-label  { font-size: 20px !important; letter-spacing: 0.05em !important; }
          .condition-card-desc   { font-size: 15px !important; line-height: 1.5 !important; }

          /* Hero typography */
          .hero-heading   { font-size: 36px !important; }
          .hero-body      { font-size: 15px !important; }
          .hero-cta       { font-size: 15px !important; padding: 13px 20px !important; }

          /* Category section headings */
          .category-heading { font-size: 13px !important; }

          /* Disable slide animations — transforms trap position:fixed modals */
          .slide-in-right, .slide-in-left { animation: none !important; }

          /* Switch root layout from fixed-height viewport to natural page scroll */
          .root-layout {
            height: auto !important;
            overflow: visible !important;
          }
          .main-area {
            overflow: visible !important;
            flex: none !important;
          }
          .condition-view {
            height: auto !important;
            min-height: 0 !important;
            flex: none !important;
          }
          .condition-panel-outer {
            height: auto !important;
            min-height: 0 !important;
          }
          .condition-scroll-area {
            overflow: visible !important;
            flex: none !important;
          }
        }
        @media (min-width: 641px) {
          .mobile-only { display: none !important; }
        }
        .slide-in-right { animation: slideInRight 0.28s ease forwards; }
        .slide-in-left  { animation: slideInLeft  0.28s ease forwards; }
      `}</style>

      <div className="root-layout" style={{
        display: 'flex', flexDirection: 'column',
        height: '100vh', overflow: 'hidden',
        background: 'var(--bg)',
      }}>

        {/* ── Header ──────────────────────────────────────────────── */}
        <header style={{
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          flexShrink: 0, zIndex: 10, position: 'relative',
        }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px', width: '100%', display: 'flex', alignItems: 'center', height: '56px', gap: '12px' }}>


            {/* Back button */}
            {(view === 'condition' || view === 'overlap') && (
              <button
                onClick={goHome}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '5px 10px',
                  fontSize: '13px',
                  display: 'flex', alignItems: 'center', gap: '5px',
                  flexShrink: 0, transition: 'all 0.12s',
                }}
                aria-label="Back to home"
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--accent-dim)';
                  e.currentTarget.style.color = 'var(--accent)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                ← <span className="desktop-only">Home</span>
              </button>
            )}

            {/* Logo — always goes home to top */}
            <button
              onClick={goHome}
              aria-label="Cine2Helper home"
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                flexShrink: 0, background: 'transparent', border: 'none',
                cursor: 'pointer', padding: 0,
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 367.396 367.396"
                style={{ width: '28px', height: '28px', flexShrink: 0 }}
                aria-hidden="true"
              >
                <rect width="367.396" height="367.396" rx="48" fill="#0d0d0f"/>
                <g fill="#e8c97a">
                  <rect x="309.729" y="241.648" width="14.403" height="46.387"/>
                  <polygon points="330.957,241.55 330.957,288.803 367.396,310.778 367.396,219.58"/>
                  <path d="M242.509,191.897v-49.705c0-11.197-9.16-20.362-20.362-20.362h-85.427c-11.197,0-20.362,9.16-20.362,20.362v49.705c0,11.197-9.165,20.362-20.362,20.362h-19.2c-11.197,0-20.362,9.165-20.362,20.362v99.973c0,11.197,9.16,20.362,20.362,20.362h225.633V212.039h-41.707C250.537,210.943,242.509,202.362,242.509,191.897z M281.59,332.507H79.519v-95.119H281.59V332.507z"/>
                  <path d="M263.47,108.671c4.255,5.647,12.278,6.774,17.925,2.524c5.647-4.255,6.774-12.278,2.519-17.925c-4.255-5.647-12.278-6.774-17.925-2.524C260.347,95.001,259.22,103.024,263.47,108.671z"/>
                  <circle cx="86.433" cy="100.891" r="12.798"/>
                  <path d="M203.612,109.756c-0.522-3.85-0.763-7.747-0.635-11.674l29.768,4.188c0.102,3.333,0.661,6.656,1.582,9.907c10.26,4.178,17.833,13.461,19.707,24.678c1.797,0.988,3.64,1.879,5.55,2.581l-4.05,28.8c-0.328-0.087-0.63-0.23-0.957-0.323v16.072c2.186,0.481,4.378,0.963,6.636,1.28c46.94,6.605,90.342-26.097,96.947-73.032c6.605-46.94-26.097-90.342-73.032-96.947c-46.94-6.605-90.342,26.097-96.947,73.032c-1.024,7.281-0.998,14.454-0.225,21.437H203.612z"/>
                  <rect x="34.253" y="235.34" width="11.095" height="47.232"/>
                  <path d="M104.289,184.053v-16.041c-3.543,0.963-7.168,1.679-10.859,2.074v-28.831c3.907-0.671,7.721-1.935,11.336-3.738c1.756-12.001,10.025-21.806,21.161-25.769c0.317-1.152,0.609-2.309,0.819-3.477h28.831c-0.056,0.502-0.154,0.988-0.22,1.49H171.1c0.343-3.118,0.553-6.277,0.553-9.482c0-47.401-38.426-85.827-85.827-85.827S0,52.878,0,100.279c0,47.401,38.426,85.827,85.827,85.827C92.165,186.101,98.335,185.363,104.289,184.053z"/>
                </g>
                <circle cx="85.929" cy="100.279" r="16" fill="#1a1a2e"/>
                <circle cx="269.389" cy="97.145" r="14" fill="#1a1a2e"/>
              </svg>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '20px',
                letterSpacing: '0.06em',
                background: 'linear-gradient(90deg, #f0d878 0%, #e8c97a 40%, #c8993a 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>CINE2HELPER</span>
            </button>

            {/* Breadcrumb */}
            {view === 'condition' && (
              <span className="desktop-only" style={{
                color: 'var(--text-dim)', fontSize: '13px', marginLeft: '4px',
              }}>
                / {conditionLabel}
              </span>
            )}
            {view === 'overlap' && (
              <span className="desktop-only" style={{
                color: 'var(--text-dim)', fontSize: '13px', marginLeft: '4px',
              }}>
                / Overlap Analyzer
              </span>
            )}

            {/* Nav — desktop */}
            <nav className="desktop-only" aria-label="Main navigation" style={{
              display: 'flex', gap: '2px', marginLeft: 'auto',
            }}>
              {([
                { label: 'Win Conditions', action: goHomeScrolled },
                { label: 'Overlap Analyzer', action: () => setView('overlap') },
                { label: 'Feedback', action: () => setShowFeedback(true) },
              ]).map(({ label, action }) => (
                <button
                  key={label}
                  onClick={action}
                  style={{
                    padding: '6px 14px',
                    background: 'transparent',
                    border: '1px solid transparent',
                    borderRadius: 'var(--radius)',
                    color: 'var(--text-muted)',
                    cursor: 'pointer', fontSize: '13px',
                    transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.color = 'var(--text)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>

          {/* Mobile tab bar */}
          <nav className="mobile-only" aria-label="Main navigation" style={{ borderTop: '1px solid var(--border)' }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex' }}>
            {([
              { label: 'Win Conditions', action: goHomeScrolled },
              { label: 'Overlap', action: () => setView('overlap') },
              { label: 'Feedback', action: () => setShowFeedback(true) },
            ]).map(({ label, action }) => (
              <button
                key={label}
                onClick={action}
                style={{
                  flex: 1, padding: '10px',
                  background: 'transparent', border: 'none',
                  borderBottom: '2px solid transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer', fontSize: '13px',
                  transition: 'all 0.12s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          </nav>
        </header>

        {/* ── Main ────────────────────────────────────────────────── */}
        <main className="main-area" style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <div aria-live="polite" aria-atomic="true" style={{
            position: 'absolute', width: '1px', height: '1px',
            padding: 0, margin: '-1px', overflow: 'hidden',
            clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
          }}>
            {view === 'condition' && activeCondition
              ? `Viewing ${WIN_CONDITIONS.find(w => w.id === activeCondition)?.label ?? ''} films`
              : view === 'overlap' ? 'Overlap analyzer'
              : 'Win conditions overview'}
          </div>

          {view === 'home' && (
            <div className="slide-in-left" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <HomePage
                onSelectCondition={selectCondition}
                onOverlap={() => setView('overlap')}
                conditionsRef={conditionsRef}
              />
            </div>
          )}

          {view === 'condition' && activeCondition && (
            <div className="slide-in-right condition-view" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <WinConditionPanel key={activeCondition} conditionId={activeCondition} />
            </div>
          )}

          {view === 'overlap' && (
            <div className="slide-in-right" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 20px' }}>
                <OverlapAnalyzer />
              </div>
            </div>
          )}
        </main>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <footer style={{
          height: '36px', borderTop: '1px solid var(--border)',
          background: 'var(--surface)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: '0 16px', flexShrink: 0,
        }}>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
            Not affiliated with or endorsed by Cine2Nerdle, TMDB, or the TMDB API.
          </span>
        </footer>
      </div>

      {/* Feedback modal — rendered outside the main layout so it overlays everything */}
      {showFeedback && (
        <FeedbackModal onClose={() => setShowFeedback(false)} />
      )}
    </>
  );
}
