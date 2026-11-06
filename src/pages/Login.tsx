import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import BrandMark from '../components/BrandMark';
import { staticLogin, STATIC_SESSION_KEY } from '../lib/staticUsers';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const nav = useNavigate();

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError('Both fields are required.'); return; }
    setError('');
    setLoading(true);

    const user = staticLogin(email, password);
    if (!user) {
      setLoading(false);
      setError('Invalid email or password.');
      return;
    }

    // Store session in localStorage so the dashboard can read it.
    localStorage.setItem(STATIC_SESSION_KEY, JSON.stringify(user));
    localStorage.setItem('ssb_auth', '1');
    localStorage.setItem('ssb_local_user', JSON.stringify({ id: 'static', email: user.email, name: user.name, type: user.type }));
    setLoading(false);
    nav('/dashboard');
  }

  return (
    <>
      <title>Log In | Shield Safe Bank</title>
      <div style={{ minHeight: 'calc(100vh - 120px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6F8', padding: '40px 16px' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <div className="auth-card" style={{ background: '#fff', border: '1px solid #DCE3EA', padding: '40px' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <BrandMark height={46} />
            </div>
            <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '24px', color: '#0A2044', margin: '0 0 6px', letterSpacing: '-0.01em' }}>Log in</h1>
            <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 28px' }}>Enter your email and password to access your account.</p>

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <AuthField label="Email address" type="email" value={email} onChange={setEmail} />
              <AuthField label="Password" type="password" value={password} onChange={setPassword} />
              {error && <p style={{ fontSize: '13px', color: '#DC2626', margin: 0 }}>{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary" style={{ padding: '12px', fontSize: '15px', opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Checking…' : 'Log in'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

function AuthField({ label, type, value, onChange }: {
  label: string; type: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4779C4', display: 'block', marginBottom: '6px' }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', border: '1px solid #DCE3EA', padding: '11px 12px', fontSize: '15px', color: '#0A2044', background: '#fff', outline: 'none' }} />
    </div>
  );
}
