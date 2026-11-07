import { useState } from 'react';
import { useNavigate } from 'react-router';
import { staticAdminLogin } from '../../lib/staticUsers';
import BrandMark from '../../components/BrandMark';

const ADMIN_SESSION_KEY = 'ssb_admin_static';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const nav = useNavigate();

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const admin = staticAdminLogin(email, password);
    if (!admin) {
      setLoading(false);
      setError('Invalid admin credentials.');
      return;
    }

    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(admin));
    localStorage.setItem('ssb_admin', '1');
    // Store a dummy token so hasAdminToken() returns true and existing
    // admin console polling code treats the session as authenticated.
    localStorage.setItem('ssb_admin_token', 'static-admin');
    setLoading(false);
    nav('/xk9-admin-console-7f3a/console');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A2044', padding: '40px 16px' }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>
        <div style={{ marginBottom: '28px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <BrandMark height={30} white />
          </div>
          <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#374151', margin: 0, letterSpacing: '0.06em' }}>ADMIN CONSOLE | RESTRICTED</p>
        </div>

        <div className="auth-card" style={{ background: '#0B2B5C', border: '1px solid #123C7C', padding: '36px' }}>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <AField label="Admin email" type="email" value={email} onChange={setEmail} autoComplete="username" />
            <AField label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
            {error && <p style={{ fontSize: '13px', color: '#F87171', margin: 0 }}>{error}</p>}
            <button type="submit" disabled={loading}
              style={{ background: '#4779C4', color: '#fff', border: 'none', padding: '12px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, fontSize: '13px', cursor: 'pointer', letterSpacing: '0.04em', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'SIGNING IN…' : 'LOG IN'}
            </button>
          </form>
          <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(71,121,196,0.1)', border: '1px solid rgba(71,121,196,0.3)' }}>
            <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: '#4779C4', margin: '0 0 4px', letterSpacing: '0.06em' }}>ADMIN CREDENTIALS</p>
            <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#A9C6E8', margin: 0, lineHeight: 1.7 }}>
              admin@shieldsafebank.com<br />
              Admin#Shield2026
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export { ADMIN_SESSION_KEY };

function AField({ label, type, value, onChange, autoComplete }: {
  label: string; type: string; value: string; onChange: (v: string) => void; autoComplete?: string;
}) {
  return (
    <div>
      <label style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4779C4', display: 'block', marginBottom: '6px' }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} autoComplete={autoComplete}
        style={{ width: '100%', border: '1px solid #123C7C', padding: '10px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '14px', color: '#fff', background: '#0A2044', outline: 'none', boxSizing: 'border-box' }} />
    </div>
  );
}
