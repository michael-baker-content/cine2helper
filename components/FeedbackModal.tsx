'use client';

import { useState, useEffect, useRef } from 'react';
import { WIN_CONDITIONS } from '@/lib/win-conditions';

const FORMSPREE_ENDPOINT = 'https://formspree.io/f/meenqpje';

const FEEDBACK_TYPES = [
  'Missing film',
  'Film should not qualify',
  'Wrong sequence number',
  'General feedback',
  'Other',
];

interface FeedbackModalProps {
  onClose: () => void;
}

export default function FeedbackModal({ onClose }: FeedbackModalProps) {
  const [type, setType]           = useState('');
  const [condition, setCondition] = useState('');
  const [details, setDetails]     = useState('');
  const [email, setEmail]         = useState('');
  const [status, setStatus]       = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLSelectElement>(null);

  // Focus first input on open
  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Focus trap
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;
    const trap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const focusable = modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [onClose]);

  // Auto-close after success
  useEffect(() => {
    if (status !== 'success') return;
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [status, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          _subject: 'Cine2Helper Feedback',
          type,
          condition: condition || 'N/A',
          details,
          ...(email.trim() ? { email: email.trim() } : {}),
        }),
      });
      if (res.ok) {
        setStatus('success');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '8px 12px',
    color: 'var(--text)',
    fontSize: '13px',
    outline: 'none',
    transition: 'border-color 0.12s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--accent)',
    marginBottom: '6px',
  };

  const fieldStyle: React.CSSProperties = {
    marginBottom: '16px',
  };

  return (
    <>
      <style>{`
        @keyframes feedbackModalIn {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
        .fs-input-focus:focus { border-color: var(--accent-dim) !important; }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.72)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: '16px',
        }}
      >
        {/* Modal panel */}
        <div
          ref={modalRef}
          onClick={e => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Send feedback"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--accent-dim)',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '460px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 16px 64px rgba(0,0,0,0.7)',
            animation: 'feedbackModalIn 0.2s ease forwards',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 20px 14px',
            borderBottom: '1px solid var(--border)',
          }}>
            <div>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '18px',
                letterSpacing: '0.04em',
                color: 'var(--accent)',
                marginBottom: '2px',
              }}>
                SEND FEEDBACK
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Suggest a missing film or report a data issue
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close feedback"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: '50%',
                width: '28px', height: '28px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--text-muted)',
                fontSize: '16px', lineHeight: 1, flexShrink: 0,
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
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '20px' }}>
            {status === 'success' ? (
              <div style={{
                textAlign: 'center', padding: '32px 16px',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: '12px',
              }}>
                <div style={{ fontSize: '40px' }}>✓</div>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '16px', letterSpacing: '0.04em',
                  color: 'var(--accent)',
                }}>
                  FEEDBACK RECEIVED
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Thanks for helping improve Cine2Helper. This window will close shortly.
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {/* Honeypot — hidden from humans, catches bots */}
                <input
                  type="text"
                  name="_gotcha"
                  style={{ display: 'none' }}
                  tabIndex={-1}
                  aria-hidden="true"
                />

                {/* Type */}
                <div style={fieldStyle}>
                  <label htmlFor="fb-type" style={labelStyle}>Type of feedback *</label>
                  <select
                    id="fb-type"
                    ref={firstInputRef}
                    value={type}
                    onChange={e => setType(e.target.value)}
                    required
                    className="fs-input-focus"
                    style={{
                      ...inputStyle,
                      backgroundImage: 'url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%228%22%20viewBox%3D%220%200%2012%208%22%3E%3Cpath%20d%3D%22M1%201l5%205%205-5%22%20stroke%3D%22%23a0a0b0%22%20stroke-width%3D%221.5%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E")',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 10px center',
                      paddingRight: '28px',
                      appearance: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="" disabled>Select a type…</option>
                    {FEEDBACK_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Win Condition */}
                <div style={fieldStyle}>
                  <label htmlFor="fb-condition" style={labelStyle}>
                    Related win condition
                    <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: '6px', color: 'var(--text-dim)' }}>
                      (optional)
                    </span>
                  </label>
                  <select
                    id="fb-condition"
                    value={condition}
                    onChange={e => setCondition(e.target.value)}
                    className="fs-input-focus"
                    style={{
                      ...inputStyle,
                      backgroundImage: 'url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%228%22%20viewBox%3D%220%200%2012%208%22%3E%3Cpath%20d%3D%22M1%201l5%205%205-5%22%20stroke%3D%22%23a0a0b0%22%20stroke-width%3D%221.5%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E")',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 10px center',
                      paddingRight: '28px',
                      appearance: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">Not condition-specific</option>
                    {WIN_CONDITIONS.map(wc => (
                      <option key={wc.id} value={wc.label}>{wc.label}</option>
                    ))}
                  </select>
                </div>

                {/* Details */}
                <div style={fieldStyle}>
                  <label htmlFor="fb-details" style={labelStyle}>Details *</label>
                  <textarea
                    id="fb-details"
                    value={details}
                    onChange={e => setDetails(e.target.value)}
                    required
                    rows={4}
                    placeholder={
                      type === 'Missing film'
                        ? "e.g. Titanic is missing from the '90s Romance list — TMDB ID 597"
                        : type === 'Film should not qualify'
                        ? 'e.g. Titanic should not be in Service the Fans — it has no official sequel'
                        : 'Describe the issue or suggestion…'
                    }
                    className="fs-input-focus"
                    style={{
                      ...inputStyle,
                      resize: 'vertical',
                      minHeight: '96px',
                      lineHeight: 1.5,
                      fontFamily: 'inherit',
                    }}
                  />
                </div>

                {/* Email */}
                <div style={fieldStyle}>
                  <label htmlFor="fb-email" style={labelStyle}>
                    Your email
                    <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: '6px', color: 'var(--text-dim)' }}>
                      (optional — only if you'd like a reply)
                    </span>
                  </label>
                  <input
                    id="fb-email"
                    type="email"
                    name="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="fs-input-focus"
                    style={inputStyle}
                  />
                </div>

                {/* Error */}
                {status === 'error' && (
                  <div style={{
                    background: 'rgba(220,50,50,0.1)',
                    border: '1px solid rgba(220,50,50,0.3)',
                    borderRadius: 'var(--radius)',
                    padding: '10px 14px',
                    fontSize: '13px',
                    color: 'var(--red, #e05050)',
                    marginBottom: '16px',
                  }}>
                    Something went wrong — please try again or email directly.
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={status === 'submitting'}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: status === 'submitting' ? 'var(--accent-glow)' : 'var(--accent)',
                    border: 'none',
                    borderRadius: 'var(--radius)',
                    color: status === 'submitting' ? 'var(--accent)' : 'var(--bg)',
                    fontFamily: 'var(--font-display)',
                    fontSize: '14px',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    cursor: status === 'submitting' ? 'not-allowed' : 'pointer',
                    opacity: status === 'submitting' ? 0.7 : 1,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (status === 'submitting') return;
                    e.currentTarget.style.opacity = '0.85';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  {status === 'submitting' ? 'SENDING…' : 'SEND FEEDBACK'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
