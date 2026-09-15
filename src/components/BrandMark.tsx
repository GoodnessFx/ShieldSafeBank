import { useState } from 'react';
import logoUrl from '../assets/logo-display.png?inline';

export default function BrandMark({ height = 32, white = false }: { height?: number; white?: boolean }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <svg viewBox="0 0 28 32" style={{ height, width: 'auto', display: 'block' }} fill="none" aria-label="Shield Safe Bank">
        <path d="M14 1L2 6V17C2 23.627 7.373 29.627 14 31C20.627 29.627 26 23.627 26 17V6L14 1Z" fill={white ? '#fff' : '#123C7C'} stroke={white ? '#fff' : '#4779C4'} strokeWidth="0.5" />
        <rect x="11" y="12" width="6" height="7" rx="0.5" fill="none" stroke={white ? '#0B2B5C' : '#fff'} strokeWidth="1.5" />
        <path d="M11.5 12V10.5C11.5 8.567 13.067 7 15 7V7" stroke={white ? '#0B2B5C' : '#fff'} strokeWidth="1.5" strokeLinecap="square" />
        <circle cx="14" cy="15.5" r="1" fill={white ? '#fff' : '#fff'} />
        <line x1="14" y1="16.5" x2="14" y2="18" stroke={white ? '#0B2B5C' : '#fff'} strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <img
      src={logoUrl}
      alt="Shield Safe Bank"
      onError={() => setFailed(true)}
      style={{ height, width: 'auto', display: 'block', filter: white ? 'brightness(0) invert(1)' : 'none' }}
    />
  );
}