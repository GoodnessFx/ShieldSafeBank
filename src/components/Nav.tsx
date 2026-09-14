import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import BrandMark from './BrandMark';

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
          <BrandMark height={40} />
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
