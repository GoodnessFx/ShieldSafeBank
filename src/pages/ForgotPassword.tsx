import { useState } from 'react';
import { Link } from 'react-router';
import { forgotPassword } from '../lib/api';
import BrandMark from '../components/BrandMark';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    forgotPassword(email)
      .then(() => { setSent(true); })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      })
      .finally(() => { setLoading(false); });
  }

  return (
    <>
      <title>Reset Password | Shield Safe Bank</title>
      <div style={{ minHeight: 'calc(100vh - 120px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6F8', padding: '40px 16px' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <BrandMark height={44} />
          </div>
          <div className="auth-card" style={{ background: '#fff', border: '1px solid #DCE3EA', padding: '40px' }}>
            {sent ? (
              <>
                <div style={{ width: '40px', height: '40px', background: '#1E7A4C', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9l5 5 7-8" stroke="#fff" strokeWidth="2" strokeLinecap="square" /></svg>
                </div>
                <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '22px', color: '#0A2044', margin: '0 0 10px' }}>Check your email</h1>
                <p style={{ fontSize: '14px', color: '#4A5568', lineHeight: 1.7, margin: '0 0 24px' }}>
                  If an account exists for {email}, we sent a reset link. It expires in 30 minutes.
                </p>
                <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>Did not receive it? Check your spam folder or <button onClick={() => setSent(false)} style={{ background: 'none', border: 'none', color: '#123C7C', cursor: 'pointer', fontWeight: 500, padding: 0, fontSize: '13px' }}>try again</button>.</p>
              </>
            ) : (
              <>
                <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '22px', color: '#0A2044', margin: '0 0 8px' }}>Reset your password</h1>
                <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 24px' }}>Enter your account email and we will send a reset link.</p>
                {error && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '2px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#B91C1C' }}>
                    {error}
                  </div>
                )}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4779C4', display: 'block', marginBottom: '6px' }}>Email address</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                      style={{ width: '100%', border: '1px solid #DCE3EA', padding: '11px 12px', fontSize: '15px', color: '#0A2044', background: '#fff', outline: 'none' }} />
                  </div>
                  <button type="submit" disabled={loading} className="btn-primary" style={{ padding: '12px', fontSize: '15px', opacity: loading ? 0.6 : 1 }}>
                    {loading ? 'Sending…' : 'Send reset link'}
                  </button>
                  <Link to="/login" style={{ fontSize: '13px', color: '#4779C4', textDecoration: 'none', textAlign: 'center' }}>Back to log in</Link>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
