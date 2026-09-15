import { Link } from 'react-router';

export default function NotFound() {
  return (
    <>
      <title>404 | Shield Safe Bank</title>
      <div style={{ minHeight: 'calc(100vh - 120px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6F8', padding: '40px 16px' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '72px', fontWeight: 600, color: '#DCE3EA', margin: '0 0 8px', lineHeight: 1 }}>404</p>
          <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '24px', color: '#0A2044', margin: '0 0 12px' }}>Page not found</h1>
          <p style={{ fontSize: '15px', color: '#6B7280', margin: '0 0 32px', lineHeight: 1.65 }}>
            The page you are looking for does not exist or has moved.
          </p>
          <Link to="/" style={{ display: 'inline-block', background: '#123C7C', color: '#fff', padding: '11px 28px', textDecoration: 'none', fontWeight: 600, fontSize: '14px' }}>Back to home</Link>
        </div>
      </div>
    </>
  );
}
