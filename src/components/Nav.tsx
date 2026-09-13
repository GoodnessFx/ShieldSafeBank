import { useState } from 'react';
import { Link, useLocation } from 'react-router';

const links = [
  { to: '/how-it-works', label: 'How It Works' },
  { to: '/personal', label: 'Personal' },
  { to: '/business', label: 'Business' },
  { to: '/fees', label: 'Fees' },
  { to: '/security', label: 'Security' },
  { to: '/about', label: 'About' },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const isAuth = localStorage.getItem('ssb_auth') === '1';

  return (
    <header style={{ borderBottom: '1px solid #DCE3EA', background: '#fff' }} className="sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0" aria-label="Shield Safe Bank home">
          <ShieldLogo />
          <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '15px', letterSpacing: '-0.01em', color: '#1B3A5C', lineHeight: 1 }}>
            SHIELD<br />SAFE BANK
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6" aria-label="Main navigation">
          {links.map(l => (
            <Link
              key={l.to}
              to={l.to}
              style={{
                fontSize: '14px',
                fontWeight: 500,
                color: loc.pathname === l.to ? '#1B3A5C' : '#4A5568',
                textDecoration: 'none',
                transition: 'color 0.15s',
                borderBottom: loc.pathname === l.to ? '2px solid #1B3A5C' : '2px solid transparent',
                paddingBottom: '2px',
              }}
              onMouseEnter={e => { if (loc.pathname !== l.to) (e.target as HTMLElement).style.color = '#1B3A5C'; }}
              onMouseLeave={e => { if (loc.pathname !== l.to) (e.target as HTMLElement).style.color = '#4A5568'; }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          {isAuth ? (
            <Link to="/dashboard" className="btn-primary" style={{ fontSize: '13px', padding: '6px 16px' }}>Dashboard</Link>
          ) : (
            <>
              <Link to="/login" style={{ fontSize: '13px', fontWeight: 500, color: '#1B3A5C', textDecoration: 'none' }}>Log in</Link>
              <Link to="/signup" className="btn-primary" style={{ fontSize: '13px', padding: '6px 16px' }}>Open Account</Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-2"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen(!open)}
        >
          <span style={{ width: 20, height: 1.5, background: '#1B3A5C', display: 'block', transition: 'transform 0.2s', transform: open ? 'rotate(45deg) translate(2px, 4px)' : '' }} />
          <span style={{ width: 20, height: 1.5, background: '#1B3A5C', display: 'block', opacity: open ? 0 : 1, transition: 'opacity 0.15s' }} />
          <span style={{ width: 20, height: 1.5, background: '#1B3A5C', display: 'block', transition: 'transform 0.2s', transform: open ? 'rotate(-45deg) translate(2px, -4px)' : '' }} />
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div style={{ borderTop: '1px solid #DCE3EA', background: '#fff', padding: '16px 24px 24px' }}>
          <nav className="flex flex-col gap-4" aria-label="Mobile navigation">
            {links.map(l => (
              <Link key={l.to} to={l.to} style={{ fontSize: '15px', fontWeight: 500, color: '#1B3A5C', textDecoration: 'none' }} onClick={() => setOpen(false)}>{l.label}</Link>
            ))}
            <div style={{ borderTop: '1px solid #DCE3EA', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Link to="/login" style={{ fontSize: '15px', fontWeight: 500, color: '#1B3A5C', textDecoration: 'none' }} onClick={() => setOpen(false)}>Log in</Link>
              <Link to="/signup" className="btn-primary" style={{ display: 'inline-block', textAlign: 'center', padding: '10px 20px' }} onClick={() => setOpen(false)}>Open Account</Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

function ShieldLogo() {
  return (
    <svg width="28" height="32" viewBox="0 0 28 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M14 1L2 6V17C2 23.627 7.373 29.627 14 31C20.627 29.627 26 23.627 26 17V6L14 1Z" fill="#1B3A5C" />
      <path d="M14 1L2 6V17C2 23.627 7.373 29.627 14 31C20.627 29.627 26 23.627 26 17V6L14 1Z" fill="none" stroke="#4A7DA8" strokeWidth="0.5" />
      <rect x="11" y="12" width="6" height="7" rx="0.5" fill="none" stroke="#fff" strokeWidth="1.5" />
      <path d="M11.5 12V10.5C11.5 8.567 13.067 7 15 7V7" stroke="#fff" strokeWidth="1.5" strokeLinecap="square" />
      <path d="M16.5 12V10.5C16.5 8.567 14.933 7 13 7" stroke="none" />
      <circle cx="14" cy="15.5" r="1" fill="#fff" />
      <line x1="14" y1="16.5" x2="14" y2="18" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
