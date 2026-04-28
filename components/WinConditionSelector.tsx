'use client';

import { WIN_CONDITIONS, CATEGORY_LABELS } from '@/lib/win-conditions';
import { WinCondition, WinConditionCategory } from '@/types/tmdb';
import { useState } from 'react';

interface WinConditionSelectorProps {
  selected: string | null;
  onSelect: (id: string) => void;
}

const CATEGORY_ORDER: WinConditionCategory[] = ['themed', 'person', 'decade', 'genre', 'country', 'keyword', 'franchise'];

export default function WinConditionSelector({ selected, onSelect }: WinConditionSelectorProps) {
  const [filter, setFilter] = useState<WinConditionCategory | 'all'>('all');

  const grouped = CATEGORY_ORDER.reduce<Record<string, WinCondition[]>>((acc, cat) => {
    const items = WIN_CONDITIONS.filter((wc) => wc.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  const categories = Object.keys(grouped) as WinConditionCategory[];

  return (
    <aside style={{
      width: '280px',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: '0',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 18px 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface-2)',
      }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: '18px',
          letterSpacing: '0.05em',
          color: 'var(--accent)',
          marginBottom: '10px',
        }}>WIN CONDITIONS</div>

        {/* Category filter pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
          <button
            onClick={() => setFilter('all')}
            style={pillStyle(filter === 'all')}
          >All</button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              style={pillStyle(filter === cat)}
            >
              {CATEGORY_LABELS[cat]?.split(' ').slice(1).join(' ') || cat}
            </button>
          ))}
        </div>
      </div>

      {/* Condition list */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {categories
          .filter((cat) => filter === 'all' || filter === cat)
          .map((cat) => (
            <div key={cat}>
              <div style={{
                padding: '10px 18px 6px',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
                position: 'sticky',
                top: 0,
                background: 'var(--surface)',
                zIndex: 1,
              }}>
                {CATEGORY_LABELS[cat] || cat}
              </div>
              {grouped[cat].map((wc) => (
                <button
                  key={wc.id}
                  onClick={() => onSelect(wc.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '9px 18px',
                    background: selected === wc.id ? 'var(--accent-glow)' : 'transparent',
                    border: 'none',
                    borderLeft: `3px solid ${selected === wc.id ? 'var(--accent)' : 'transparent'}`,
                    color: selected === wc.id ? 'var(--accent)' : 'var(--text)',
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) => {
                    if (selected !== wc.id) {
                      e.currentTarget.style.background = 'var(--surface-2)';
                      e.currentTarget.style.color = 'var(--text)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selected !== wc.id) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <span style={{ fontSize: '14px', fontWeight: selected === wc.id ? 500 : 400 }}>
                    {wc.label}
                  </span>

                </button>
              ))}
            </div>
          ))}
      </div>
    </aside>
  );
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: '3px 10px',
    borderRadius: '20px',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    background: active ? 'var(--accent-glow)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-muted)',
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.12s',
  };
}
