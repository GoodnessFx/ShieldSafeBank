import { useEffect, useState } from 'react';
import BrandMark from './BrandMark';

const SPLASH_DURATION_MS = 5000;
const FADE_MS = 400;

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), SPLASH_DURATION_MS - FADE_MS);
    const doneTimer = setTimeout(() => onDone(), SPLASH_DURATION_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      role="status"
      aria-label="Loading Shield Safe Bank"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#0B2B5C',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '28px',
        opacity: fading ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease`,
        pointerEvents: fading ? 'none' : 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
          animation: 'ssb-splash-rise 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <BrandMark height={84} white />
        <div style={{ textAlign: 'center' }}>
          <p
            style={{
              fontFamily: 'Sora, sans-serif',
              fontWeight: 800,
              fontSize: 'clamp(22px, 4vw, 30px)',
              color: '#fff',
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            Shield Safe Bank
          </p>
          <p
            style={{
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: '12px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#4779C4',
              margin: '8px 0 0',
            }}
          >
            Banking. Verified. Secure.
          </p>
        </div>
      </div>

      <div
        style={{
          width: '160px',
          height: '2px',
          background: 'rgba(71, 121, 196, 0.25)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            background: '#4779C4',
            animation: `ssb-splash-progress ${SPLASH_DURATION_MS}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
}
