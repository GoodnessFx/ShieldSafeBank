import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { googleSignIn, googleSvg } from '../lib/google';
import { login as apiLogin, googleAuth } from '../lib/api';
import BrandMark from '../components/BrandMark';

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
    apiLogin(email, password).then(r => {
      if (!r.ok && r.offline) { setLoading(false); setError('Check your email and password and try again.'); return; }
      if (!r.ok) { setLoading(false); setError(r.data && r.data.error ? r.data.error : 'Invalid credentials.'); return; }
      setLoading(false);
      localStorage.setItem('ssb_auth', '1');
      nav('/dashboard');
    });
  }

  function handleGoogle() {
    setError(''); setLoading(true);
    googleSignIn().then(res => {
      if (!res.ok) { setLoading(false); setError('Google sign-in could not be completed.'); return; }
      googleAuth(res.email || '', res.name || '', res.idToken || '').then(r => {
        if (!r.ok && !r.offline) { setLoading(false); setError('Google sign-in could not be completed.'); return; }
        localStorage.setItem('ssb_auth', '1');
        nav('/dashboard');
      });
    });
  }

  return (
    <>
      <title>Log In — Shield Safe Bank</title>
      <div style={{ minHeight: 'calc(100vh - 120px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6F8', padding: '40px 16px' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <div className="auth-card" style={{ background: '#fff', border: '1px solid #DCE3EA', padding: '40px' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <BrandMark height={46} />
            </div>
            <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '24px', color: '#0F2338', margin: '0 0 6px', letterSpacing: '-0.01em' }}>Log in</h1>
            <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 28px' }}>
              No account? <Link to="/signup" style={{ color: '#1B3A5C', fontWeight: 500 }}>Open one</Link>
            </p>

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <button type="button" onClick={handleGoogle} disabled={loading}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', border: '1px solid #DCE3EA', background: '#fff', padding: '11px', fontSize: '14px', fontWeight: 500, color: '#0F2338', cursor: 'pointer', transition: 'background 0.15s', opacity: loading ? 0.6 : 1 }}
                onMouseEnter={e => { (e.target as HTMLElement).style.background = '#F4F6F8'; }}
                onMouseLeave={e => { (e.target as HTMLElement).style.background = '#fff'; }}>
                {googleSvg()} Continue with Google
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0' }}>
                <div style={{ flex: 1, height: '1px', background: '#DCE3EA' }} />
                <span style={{ fontSize: '11px', color: '#9CA3AF', fontFamily: 'IBM Plex Mono, monospace' }}>OR</span>
                <div style={{ flex: 1, height: '1px', background: '#DCE3EA' }} />
              </div>
              <AuthField label="Email address" type="email" value={email} onChange={setEmail} />
              <AuthField label="Password" type="password" value={password} onChange={setPassword} />
              {error && <p style={{ fontSize: '13px', color: '#DC2626', margin: 0 }}>{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary" style={{ padding: '12px', fontSize: '15px', opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Checking…' : 'Log in'}
              </button>
              <Link to="/forgot-password" style={{ fontSize: '13px', color: '#4A7DA8', textDecoration: 'none', textAlign: 'center' }}>Forgot password?</Link>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

function AuthField({ label, type, value, onChange, inputMode, maxLength }: {
  label: string; type: string; value: string; onChange: (v: string) => void; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; maxLength?: number;
}) {
  return (
    <div>
      <label style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4A7DA8', display: 'block', marginBottom: '6px' }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} inputMode={inputMode} maxLength={maxLength}
        style={{ width: '100%', border: '1px solid #DCE3EA', padding: '11px 12px', fontSize: '15px', color: '#0F2338', background: '#fff', outline: 'none' }} />
    </div>
  );
}
