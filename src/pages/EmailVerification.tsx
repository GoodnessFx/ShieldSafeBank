import { useState } from 'react';
import { useNavigate } from 'react-router';
import BrandMark from '../components/BrandMark';

export default function EmailVerification() {
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);
  const nav = useNavigate();

  function handleResend() {
    setLoading(true);
    setTimeout(() => { setLoading(false); setResent(true); }, 700);
  }

  return (
    <>
      <title>Verify Your Email | Shield Safe Bank</title>
      <div style={{ minHeight: 'calc(100vh - 120px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6F8', padding: '40px 16px' }}>
        <div style={{ width: '100%', maxWidth: '440px' }}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <BrandMark height={38} />
          </div>
          <div className="auth-card" style={{ background: '#fff', border: '1px solid #DCE3EA', padding: '48px 40px', textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', background: '#123C7C', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="5" width="20" height="14" rx="0" stroke="#fff" strokeWidth="1.5" />
                <path d="M2 5l10 9 10-9" stroke="#fff" strokeWidth="1.5" strokeLinecap="square" />
              </svg>
            </div>
            <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '24px', color: '#0A2044', margin: '0 0 12px' }}>Verify your email</h1>
            <p style={{ fontSize: '15px', color: '#4A5568', lineHeight: 1.7, margin: '0 0 28px' }}>
              We sent a verification link to your email address. Click the link to confirm your address before proceeding to identity verification.
            </p>
            <div style={{ background: '#F4F6F8', border: '1px solid #DCE3EA', padding: '16px', marginBottom: '28px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: '#6B7280' }}>
              The link expires in 24 hours.
            </div>

            {resent ? (
              <p style={{ fontSize: '14px', color: '#1E7A4C', fontWeight: 500 }}>Email sent. Check your inbox.</p>
            ) : (
              <button onClick={handleResend} disabled={loading}
                style={{ background: 'none', border: '1px solid #DCE3EA', padding: '10px 24px', fontSize: '14px', color: '#123C7C', cursor: 'pointer', fontWeight: 500, transition: 'border-color 0.15s', opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Sending…' : 'Resend verification email'}
              </button>
            )}

            <p style={{ marginTop: '24px', fontSize: '13px', color: '#9CA3AF' }}>
              Once verified, your account will be queued for identity review.
            </p>

            <button onClick={() => { localStorage.setItem('ssb_auth', '1'); nav('/dashboard'); }}
              style={{ marginTop: '20px', background: '#123C7C', border: 'none', padding: '12px 28px', fontSize: '14px', fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
              Continue to dashboard
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
