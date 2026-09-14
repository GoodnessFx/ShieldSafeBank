import { useState } from 'react';
import { useNavigate } from 'react-router';
import { adminLogin } from '../../lib/api';
import BrandMark from '../../components/BrandMark';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [step, setStep] = useState<'creds' | 'totp'>('creds');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const nav = useNavigate();

  function handleCreds(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setLoading(false); setStep('totp'); }, 700);
  }

  function handleTotp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    adminLogin(email, password, totp).then(r => {
      if (!r.ok && !r.offline) { setLoading(false); setError('Invalid admin credentials.'); return; }
      sessionStorage.setItem('ssb_admin', '1');
      setLoading(false);
      nav('/xk9-admin-console-7f3a/console');
    });
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F2338', padding: '40px 16px' }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>
        <div style={{ marginBottom: '28px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <BrandMark height={30} white />
          </div>
          <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#374151', margin: 0, letterSpacing: '0.06em' }}>ADMIN CONSOLE — RESTRICTED</p>
        </div>

        <div className="auth-card" style={{ background: '#12283F', border: '1px solid #1B3A5C', padding: '36px' }}>
          {step === 'creds' ? (
            <form onSubmit={handleCreds} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <AField label="Admin email" type="email" value={email} onChange={setEmail} />
              <AField label="Password" type="password" value={password} onChange={setPassword} />
              {error && <p style={{ fontSize: '13px', color: '#F87171', margin: 0 }}>{error}</p>}
              <button type="submit" disabled={loading}
                style={{ background: '#4A7DA8', color: '#fff', border: 'none', padding: '12px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, fontSize: '13px', cursor: 'pointer', letterSpacing: '0.04em', opacity: loading ? 0.6 : 1 }}>
                {loading ? 'CHECKING…' : 'CONTINUE'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleTotp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#A8C4DA', margin: 0 }}>TOTP code required for admin access.</p>
              <AField label="Authenticator code" type="text" value={totp} onChange={setTotp} inputMode="numeric" maxLength={6} />
              <button type="submit" disabled={loading}
                style={{ background: '#4A7DA8', color: '#fff', border: 'none', padding: '12px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, fontSize: '13px', cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
                {loading ? 'VERIFYING…' : 'AUTHENTICATE'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function AField({ label, type, value, onChange, inputMode, maxLength }: {
  label: string; type: string; value: string; onChange: (v: string) => void; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; maxLength?: number;
}) {
  return (
    <div>
      <label style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4A7DA8', display: 'block', marginBottom: '6px' }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} inputMode={inputMode} maxLength={maxLength}
        style={{ width: '100%', border: '1px solid #1B3A5C', padding: '10px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '14px', color: '#fff', background: '#0F2338', outline: 'none', boxSizing: 'border-box' }} />
    </div>
  );
}
