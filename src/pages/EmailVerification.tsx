import { useState } from 'react';
import { useNavigate } from 'react-router';
import { sendVerification, verifyEmailWithCode } from '../lib/api';
import BrandMark from '../components/BrandMark';

export default function EmailVerification() {
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [sendError, setSendError] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const nav = useNavigate();

  function handleResend() {
    setLoading(true);
    setSendError('');
    sendVerification()
      .then(() => { setCodeSent(true); })
      .catch((err: unknown) => {
        setSendError(err instanceof Error ? err.message : 'Failed to send. Please try again.');
      })
      .finally(() => { setLoading(false); });
  }

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setVerifyError('');
    if (!code.trim()) { setVerifyError('Please enter the 6-digit code.'); return; }
    setVerifying(true);
    verifyEmailWithCode(code.trim())
      .then(() => { setVerified(true); })
      .catch((err: unknown) => {
        setVerifyError(err instanceof Error ? err.message : 'Verification failed. Please try again.');
      })
      .finally(() => { setVerifying(false); });
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

            {verified ? (
              <>
                <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '24px', color: '#0A2044', margin: '0 0 12px' }}>Email verified</h1>
                <p style={{ fontSize: '15px', color: '#4A5568', lineHeight: 1.7, margin: '0 0 28px' }}>
                  Your email address has been verified. Your account is now queued for identity review.
                </p>
                <button
                  id="verify-continue-btn"
                  onClick={() => nav('/dashboard')}
                  style={{ background: '#123C7C', border: 'none', padding: '12px 28px', fontSize: '14px', fontWeight: 600, color: '#fff', cursor: 'pointer' }}
                >
                  Continue to dashboard
                </button>
              </>
            ) : (
              <>
                <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '24px', color: '#0A2044', margin: '0 0 12px' }}>Verify your email</h1>
                <p style={{ fontSize: '15px', color: '#4A5568', lineHeight: 1.7, margin: '0 0 28px' }}>
                  {codeSent
                    ? 'We sent a 6-digit code to your email address. Enter it below to confirm your account.'
                    : 'Click the button below to receive a 6-digit verification code by email.'}
                </p>

                {!codeSent ? (
                  <>
                    {sendError && (
                      <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '2px', padding: '10px 14px', marginBottom: '20px', fontSize: '13px', color: '#B91C1C', textAlign: 'left' }}>
                        {sendError}
                      </div>
                    )}
                    <div style={{ background: '#F4F6F8', border: '1px solid #DCE3EA', padding: '16px', marginBottom: '28px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: '#6B7280', textAlign: 'left' }}>
                      The code expires in 10 minutes.
                    </div>
                    <button
                      id="send-code-btn"
                      onClick={handleResend}
                      disabled={loading}
                      style={{ background: 'none', border: '1px solid #DCE3EA', padding: '10px 24px', fontSize: '14px', color: '#123C7C', cursor: 'pointer', fontWeight: 500, transition: 'border-color 0.15s', opacity: loading ? 0.6 : 1 }}
                    >
                      {loading ? 'Sending…' : 'Send verification code'}
                    </button>
                  </>
                ) : (
                  <form onSubmit={handleVerify} style={{ textAlign: 'left' }}>
                    {verifyError && (
                      <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '2px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#B91C1C' }}>
                        {verifyError}
                      </div>
                    )}
                    <label htmlFor="verify-code-input" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4779C4', display: 'block', marginBottom: '8px' }}>
                      6-digit code
                    </label>
                    <input
                      id="verify-code-input"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={code}
                      onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      autoComplete="one-time-code"
                      style={{ width: '100%', border: '1px solid #DCE3EA', padding: '11px 12px', fontSize: '22px', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '6px', color: '#0A2044', background: '#fff', outline: 'none', boxSizing: 'border-box', marginBottom: '16px', textAlign: 'center' }}
                    />
                    <button
                      id="verify-submit-btn"
                      type="submit"
                      disabled={verifying || code.length !== 6}
                      className="btn-primary"
                      style={{ width: '100%', padding: '12px', fontSize: '15px', opacity: (verifying || code.length !== 6) ? 0.6 : 1 }}
                    >
                      {verifying ? 'Verifying…' : 'Verify email'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCodeSent(false); setCode(''); setVerifyError(''); setSendError(''); }}
                      style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: '13px', marginTop: '12px', display: 'block', width: '100%', textAlign: 'center' }}
                    >
                      Resend code
                    </button>
                  </form>
                )}

                <p style={{ marginTop: '24px', fontSize: '13px', color: '#9CA3AF' }}>
                  Once verified, your account will be queued for identity review.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
