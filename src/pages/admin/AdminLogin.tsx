import { useState } from 'react';
import { useNavigate } from 'react-router';
import { adminLogin } from '../../lib/api';
import BrandMark from '../../components/BrandMark';

export default function AdminLogin() {
  const [email, setEmail] = useState('admin@shieldsafebank.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const nav = useNavigate();

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    adminLogin(email, password).then(r => {
      if (!r.ok) { setLoading(false); setError(r.data && r.data.error ? r.data.error : 'Invalid admin credentials.'); return; }
      setLoading(false);
      nav('/xk9-admin-console-7f3a/console');
    }).catch(() => {
      setLoading(false);
      setError('Unable to connect. Please check your internet and try again.');
    });
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
        </div>
      </div>
    </div>
  );
}

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