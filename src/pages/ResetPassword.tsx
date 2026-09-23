import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { resetPassword } from '../lib/api';
import BrandMark from '../components/BrandMark';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const nav = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (!token) { setError('Reset token is missing. Please use the link from your email.'); return; }
    setLoading(true);
    resetPassword(token, password)
      .then(() => { setDone(true); setTimeout(() => nav('/login'), 3000); })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      })
      .finally(() => { setLoading(false); });
  }

  return (
    <>
      <title>Set New Password | Shield Safe Bank</title>
      <div style={{ minHeight: 'calc(100vh - 120px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6F8', padding: '40px 16px' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <BrandMark height={44} />
          </div>
          <div className="auth-card" style={{ background: '#fff', border: '1px solid #DCE3EA', padding: '40px' }}>
            {done ? (
              <>
                <div style={{ width: '40px', height: '40px', background: '#1E7A4C', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9l5 5 7-8" stroke="#fff" strokeWidth="2" strokeLinecap="square" /></svg>
                </div>
                <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '22px', color: '#0A2044', margin: '0 0 10px' }}>Password updated</h1>
                <p style={{ fontSize: '14px', color: '#4A5568', lineHeight: 1.7, margin: '0 0 24px' }}>
                  Your password has been changed successfully. Redirecting you to sign in…
                </p>
                <Link to="/login" style={{ fontSize: '13px', color: '#4779C4', textDecoration: 'none' }}>Go to sign in</Link>
              </>
            ) : (
              <>
                <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '22px', color: '#0A2044', margin: '0 0 8px' }}>Set a new password</h1>
                <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 24px' }}>Choose a new password for your Shield Safe Bank account.</p>
                {!token && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '2px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#B91C1C' }}>
                    Reset token is missing. Please use the link from your email or <Link to="/forgot-password" style={{ color: '#B91C1C' }}>request a new one</Link>.
                  </div>
                )}
                {error && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '2px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#B91C1C' }}>
                    {error}
                  </div>
                )}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4779C4', display: 'block', marginBottom: '6px' }}>New password</label>
                    <input
                      id="reset-new-password"
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="At least 6 characters"
                      style={{ width: '100%', border: '1px solid #DCE3EA', padding: '11px 12px', fontSize: '15px', color: '#0A2044', background: '#fff', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4779C4', display: 'block', marginBottom: '6px' }}>Confirm password</label>
                    <input
                      id="reset-confirm-password"
                      type="password"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      required
                      placeholder="Repeat your new password"
                      style={{ width: '100%', border: '1px solid #DCE3EA', padding: '11px 12px', fontSize: '15px', color: '#0A2044', background: '#fff', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <button
                    id="reset-submit-btn"
                    type="submit"
                    disabled={loading || !token}
                    className="btn-primary"
                    style={{ padding: '12px', fontSize: '15px', opacity: (loading || !token) ? 0.6 : 1 }}
                  >
                    {loading ? 'Saving…' : 'Set new password'}
                  </button>
                  <Link to="/forgot-password" style={{ fontSize: '13px', color: '#4779C4', textDecoration: 'none', textAlign: 'center' }}>Request a new reset link</Link>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
