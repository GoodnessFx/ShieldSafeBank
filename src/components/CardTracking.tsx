import { useEffect, useRef, useState } from 'react';
import type { CardTrackingData } from '../lib/api';

// ---------------------------------------------------------------------------
// 5-step card delivery tracking — user-facing read-only view
// ---------------------------------------------------------------------------

export const TRACKING_STEPS = [
  {
    label: 'Order Placed',
    sublabel: 'Your card order has been received',
    icon: TrackIconOrder,
  },
  {
    label: 'Card Being Prepared',
    sublabel: 'We are personalising your card',
    icon: TrackIconPrepare,
  },
  {
    label: 'Quality Check',
    sublabel: 'Final inspection before dispatch',
    icon: TrackIconCheck,
  },
  {
    label: 'In Transit',
    sublabel: 'Your card is on its way',
    icon: TrackIconTransit,
  },
  {
    label: 'Ready for Pick-up',
    sublabel: 'Your card is available to collect',
    icon: TrackIconReady,
  },
] as const;

/** Props accepted by the standalone tracker widget. */
interface CardTrackingProps {
  tracking: CardTrackingData;
}

export default function CardTracking({ tracking }: CardTrackingProps) {
  const { step, note, estimatedDelivery, orderedAt, updatedAt } = tracking;
  const safeStep = Math.max(0, Math.min(4, Math.round(step)));
  const isComplete = safeStep === 4;

  // Animate the connector fill from 0 → current on mount.
  const [animatedStep, setAnimatedStep] = useState(-1);
  useEffect(() => {
    const t = setTimeout(() => setAnimatedStep(safeStep), 80);
    return () => clearTimeout(t);
  }, [safeStep]);

  // Pulse the active node once per render of a new step.
  const [pulse, setPulse] = useState(false);
  const prevStepRef = useRef(safeStep);
  useEffect(() => {
    if (prevStepRef.current !== safeStep) {
      prevStepRef.current = safeStep;
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 800);
      return () => clearTimeout(t);
    }
  }, [safeStep]);

  // Progress fraction 0→1 used for the animated line fill.
  const fraction = animatedStep < 0 ? 0 : animatedStep / 4;

  return (
    <div>
      <style>{`
        @keyframes ctPulse {
          0%   { box-shadow: 0 0 0 0 rgba(71,121,196,0.55); }
          60%  { box-shadow: 0 0 0 12px rgba(71,121,196,0); }
          100% { box-shadow: 0 0 0 0 rgba(71,121,196,0); }
        }
        @keyframes ctPulseDone {
          0%   { box-shadow: 0 0 0 0 rgba(30,122,76,0.55); }
          60%  { box-shadow: 0 0 0 12px rgba(30,122,76,0); }
          100% { box-shadow: 0 0 0 0 rgba(30,122,76,0); }
        }
        @keyframes ctFadeUp {
          from { opacity:0; transform:translateY(6px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes ctSlideIn {
          from { opacity:0; transform:translateX(-8px); }
          to   { opacity:1; transform:translateX(0); }
        }
        @keyframes ctShimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .ct-node-active-pulse { animation: ctPulse 0.75s ease-out; }
        .ct-node-done-pulse   { animation: ctPulseDone 0.75s ease-out; }
        .ct-step-label        { animation: ctFadeUp 0.4s ease both; }
        .ct-note-bar          { animation: ctSlideIn 0.35s ease both; }
      `}</style>

      {/* Meta row: order date + estimated delivery */}
      {(orderedAt || estimatedDelivery) && (
        <div style={{
          display: 'flex', gap: '24px', flexWrap: 'wrap',
          marginBottom: '28px',
        }}>
          {orderedAt && (
            <MetaChip icon="📅" label="Order date" value={fmtTrackDate(orderedAt)} />
          )}
          {estimatedDelivery && (
            <MetaChip
              icon={isComplete ? '✅' : '🚚'}
              label={isComplete ? 'Delivered' : 'Estimated delivery'}
              value={fmtTrackDate(estimatedDelivery)}
              highlight={isComplete}
            />
          )}
        </div>
      )}

      {/* Stepper */}
      <div style={{ position: 'relative' }}>
        {/* Background track */}
        <div style={{
          position: 'absolute',
          top: '22px',
          left: 'calc(10% + 22px)',
          right: 'calc(10% + 22px)',
          height: '4px',
          background: '#E5EAF2',
          borderRadius: '2px',
          zIndex: 0,
        }} />
        {/* Animated fill */}
        <div style={{
          position: 'absolute',
          top: '22px',
          left: 'calc(10% + 22px)',
          width: `calc((80% - 44px) * ${fraction})`,
          height: '4px',
          background: isComplete
            ? 'linear-gradient(90deg,#1E7A4C,#22C55E)'
            : 'linear-gradient(90deg,#123C7C,#4779C4)',
          borderRadius: '2px',
          zIndex: 1,
          transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)',
        }} />

        {/* Step nodes */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          position: 'relative',
          zIndex: 2,
        }}>
          {TRACKING_STEPS.map(({ label, sublabel, icon: Icon }, i) => {
            const done = i < safeStep;
            const active = i === safeStep;
            const future = i > safeStep;
            const isLast = i === 4;

            const nodeColor = done || (active && isComplete)
              ? '#1E7A4C'
              : active
              ? '#123C7C'
              : '#CBD5E0';
            const iconColor = future ? '#9CA3AF' : '#fff';

            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: '20%',
                  gap: '10px',
                }}
              >
                {/* Circle node */}
                <div
                  className={
                    active && pulse
                      ? isComplete
                        ? 'ct-node-done-pulse'
                        : 'ct-node-active-pulse'
                      : ''
                  }
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: nodeColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: active && !isComplete
                      ? '3px solid #4779C4'
                      : done || (active && isComplete)
                      ? '3px solid #22C55E'
                      : '3px solid #E5EAF2',
                    transition: 'background 0.5s, border-color 0.5s',
                    flexShrink: 0,
                    position: 'relative',
                  }}
                  aria-label={`Step ${i + 1}: ${label} — ${done ? 'completed' : active ? 'current' : 'pending'}`}
                >
                  {done ? (
                    <CheckmarkIcon color={iconColor} />
                  ) : (
                    <Icon color={iconColor} />
                  )}

                  {/* "CURRENT" blip on the active, non-complete step */}
                  {active && !isComplete && (
                    <span style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-6px',
                      width: '12px',
                      height: '12px',
                      background: '#F59E0B',
                      borderRadius: '50%',
                      border: '2px solid #fff',
                      animation: 'ctPulse 1.6s infinite',
                    }} />
                  )}
                </div>

                {/* Label */}
                <div
                  className="ct-step-label"
                  style={{
                    textAlign: 'center',
                    animationDelay: `${i * 0.07}s`,
                  }}
                >
                  <p style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: '10px',
                    fontWeight: active || done ? 700 : 400,
                    color: future
                      ? '#9CA3AF'
                      : isLast && isComplete
                      ? '#1E7A4C'
                      : active
                      ? '#0A2044'
                      : '#374151',
                    margin: '0 0 2px',
                    lineHeight: 1.3,
                    letterSpacing: '0.02em',
                  }}>
                    {label}
                  </p>
                  <p style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: '9px',
                    color: future ? '#CBD5E0' : '#9CA3AF',
                    margin: 0,
                    lineHeight: 1.4,
                  }}>
                    {sublabel}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Admin note / status message */}
      {note && (
        <div
          className="ct-note-bar"
          style={{
            marginTop: '24px',
            background: isComplete ? '#F0FDF4' : '#EEF2FA',
            border: `1px solid ${isComplete ? '#BBF7D0' : '#C7D5EE'}`,
            borderLeft: `4px solid ${isComplete ? '#22C55E' : '#4779C4'}`,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '15px', flexShrink: 0 }}>
            {isComplete ? '🎉' : 'ℹ️'}
          </span>
          <p style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: '12px',
            color: isComplete ? '#166534' : '#1e3a6e',
            margin: 0,
            lineHeight: 1.6,
          }}>
            {note}
          </p>
        </div>
      )}

      {/* Last updated */}
      {updatedAt && (
        <p style={{
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '10px',
          color: '#9CA3AF',
          margin: '14px 0 0',
          textAlign: 'right',
        }}>
          Last updated {fmtTrackDateTime(updatedAt)}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetaChip({ icon, label, value, highlight }: { icon: string; label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      background: highlight ? '#F0FDF4' : '#F4F6F9',
      border: `1px solid ${highlight ? '#BBF7D0' : '#DCE3EC'}`,
      padding: '8px 14px',
      borderRadius: '8px',
    }}>
      <span style={{ fontSize: '16px' }}>{icon}</span>
      <div>
        <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 1px' }}>{label}</p>
        <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', fontWeight: 600, color: highlight ? '#166534' : '#0A2044', margin: 0 }}>{value}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step icons (SVG, 18×18 view-box)
// ---------------------------------------------------------------------------

function TrackIconOrder({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="14" height="11" rx="1" stroke={color} strokeWidth="1.5" />
      <path d="M6 4V3a3 3 0 0 1 6 0v1" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6 9h6M6 12h4" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function TrackIconPrepare({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="3" y="2" width="10" height="14" rx="1" stroke={color} strokeWidth="1.5" />
      <path d="M13 5h1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-1" stroke={color} strokeWidth="1.3" />
      <path d="M6 6h5M6 9h5M6 12h3" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function TrackIconCheck({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="6.5" stroke={color} strokeWidth="1.5" />
      <path d="M6 9l2.2 2.2L12 7" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrackIconTransit({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="1" y="7" width="10" height="7" rx="1" stroke={color} strokeWidth="1.5" />
      <path d="M11 9l4 2v3h-4" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="4.5" cy="14.5" r="1.5" stroke={color} strokeWidth="1.3" />
      <circle cx="13.5" cy="14.5" r="1.5" stroke={color} strokeWidth="1.3" />
      <path d="M3 7V5l3-2h3" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function TrackIconReady({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M9 2L14 5v6l-5 3-5-3V5z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 8l3-2M9 8v5M9 8L6 6" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function CheckmarkIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M4 9.2l3.2 3.2 6.8-6.8" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Date helpers (no external deps)
// ---------------------------------------------------------------------------

function fmtTrackDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtTrackDateTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
