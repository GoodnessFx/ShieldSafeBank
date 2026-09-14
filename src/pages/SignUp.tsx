import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { googleSignIn, googleSvg } from '../lib/google';
import { register as apiRegister, googleAuth } from '../lib/api';
import BrandMark from '../components/BrandMark';

export default function SignUp() {
  const [params] = useSearchParams();
  const [type, setType] = useState<'personal' | 'business'>(params.get('type') === 'business' ? 'business' : 'personal');
  const [step, setStep] = useState<'account' | 'identity' | 'totp'>('account');
  const [form, setForm] = useState({ email: '', password: '', confirm: '', name: '', dob: '', address: '', bizName: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const nav = useNavigate();

  function f(key: string) { return (v: string) => setForm(prev => ({ ...prev, [key]: v })); }

  function handleGoogle() {
    setError(''); setLoading(true);
    googleSignIn().then(res => {
      if (!res.ok) { setLoading(false); setError('Google sign-in could not be completed.'); return; }
      googleAuth(res.email || '', res.name || '', res.idToken || '').then(r => {
        if (!r.ok && !r.offline) { setLoading(false); setError('Google sign-in could not be completed.'); return; }
        setLoading(false);
        nav('/verify-email');
      });
    });
  }

  function handleAccount(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) { setError("Passwords do not match."); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setError(''); setLoading(true);
    const payload = { email: form.email, password: form.password, name: form.name || form.email.split('@')[0] || 'New User', type };
    apiRegister(payload).then(r => {
      if (!r.ok && !r.offline) {
        setLoading(false);
        setError(r.data && r.data.error ? r.data.error : 'Account could not be created.');
        return;
      }
      setLoading(false);
      setStep('identity');
    });
  }

  function handleIdentity(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setLoading(false); setStep('totp'); }, 800);
  }

  function handleTotp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setLoading(false); nav('/verify-email'); }, 700);
  }

  const steps = ['Account', 'Identity', '2FA setup'];
  const stepIdx = ['account', 'identity', 'totp'].indexOf(step);

  return (
    <>
      <title>Open Account — Shield Safe Bank</title>
      <div style={{ minHeight: 'calc(100vh - 120px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6F8', padding: '40px 16px' }}>
        <div style={{ width: '100%', maxWidth: '480px' }}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <BrandMark height={40} />
          </div>
          {/* Steps */}
          <div style={{ display: 'flex', gap: 0, marginBottom: '24px' }}>
            {steps.map((s, i) => (
              <div key={s} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '24px', height: '24px', background: i <= stepIdx ? '#1B3A5C' : '#DCE3EA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: i <= stepIdx ? '#fff' : '#9CA3AF', fontWeight: 600 }}>{i + 1}</span>
                </div>
                <span style={{ fontSize: '12px', color: i === stepIdx ? '#0F2338' : '#9CA3AF', fontWeight: i === stepIdx ? 600 : 400 }}>{s}</span>
                {i < 2 && <div style={{ flex: 1, height: '1px', background: '#DCE3EA', marginLeft: '8px' }} />}
              </div>
            ))}
          </div>

          <div className="auth-card" style={{ background: '#fff', border: '1px solid #DCE3EA', padding: '40px' }}>
            {step === 'account' && (
              <>
                <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '22px', color: '#0F2338', margin: '0 0 20px' }}>Create your account</h1>
                {/* Type toggle */}
                <div style={{ display: 'flex', border: '1px solid #DCE3EA', marginBottom: '24px' }}>
                  {(['personal', 'business'] as const).map(t => (
                    <button key={t} onClick={() => setType(t)} style={{ flex: 1, padding: '10px', background: type === t ? '#1B3A5C' : '#fff', color: type === t ? '#fff' : '#6B7280', border: 'none', fontSize: '14px', fontWeight: type === t ? 600 : 400, cursor: 'pointer', textTransform: 'capitalize', transition: 'background 0.12s, color 0.12s' }}>
                      {t}
                    </button>
                  ))}
                </div>
                <form onSubmit={handleAccount} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                  <SField label="Email address" type="email" value={form.email} onChange={f('email')} required />
                  {type === 'business' && <SField label="Business name" type="text" value={form.bizName} onChange={f('bizName')} required />}
                  <SField label="Password" type="password" value={form.password} onChange={f('password')} required />
                  <SField label="Confirm password" type="password" value={form.confirm} onChange={f('confirm')} required />
                  {error && <p style={{ fontSize: '13px', color: '#DC2626', margin: 0 }}>{error}</p>}
                  <button type="submit" disabled={loading} className="btn-primary" style={{ padding: '12px', fontSize: '15px', marginTop: '4px', opacity: loading ? 0.6 : 1 }}>
                    {loading ? 'Creating…' : 'Continue'}
                  </button>
                  <p style={{ fontSize: '13px', color: '#6B7280', margin: 0, textAlign: 'center' }}>
                    Already have an account? <Link to="/login" style={{ color: '#1B3A5C' }}>Log in</Link>
                  </p>
                </form>
              </>
            )}

            {step === 'identity' && (
              <>
                <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '22px', color: '#0F2338', margin: '0 0 8px' }}>Verify your identity</h1>
                <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 24px' }}>Required by law. Takes about 90 seconds.</p>
                <form onSubmit={handleIdentity} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <SField label="Full legal name" type="text" value={form.name} onChange={f('name')} required />
                  <SField label="Date of birth" type="date" value={form.dob} onChange={f('dob')} required />
                  <SField label="Residential address" type="text" value={form.address} onChange={f('address')} required />
                  <div style={{ background: '#F4F6F8', border: '1px solid #DCE3EA', padding: '16px' }}>
                    <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '14px', color: '#0F2338', margin: '0 0 6px' }}>Government ID and liveness check</p>
                    <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 12px', lineHeight: 1.5 }}>Upload a government-issued photo ID and complete a brief video selfie.</p>
                    <div style={{ border: '2px dashed #DCE3EA', padding: '24px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>ID upload</div>
                  </div>
                  <button type="submit" disabled={loading} className="btn-primary" style={{ padding: '12px', fontSize: '15px', opacity: loading ? 0.6 : 1 }}>
                    {loading ? 'Submitting…' : 'Continue'}
                  </button>
                </form>
              </>
            )}

            {step === 'totp' && (
              <>
                <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '22px', color: '#0F2338', margin: '0 0 8px' }}>Set up two-factor authentication</h1>
                <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 20px' }}>Required on all accounts. Use an authenticator app (Google Authenticator, Authy, 1Password, etc.).</p>
                <div style={{ background: '#F4F6F8', border: '1px solid #DCE3EA', padding: '24px', textAlign: 'center', marginBottom: '20px' }}>
                  <div style={{ width: '120px', height: '120px', background: '#1B3A5C', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#fff', fontSize: '11px', fontFamily: 'IBM Plex Mono, monospace' }}>QR CODE</span>
                  </div>
                  <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#6B7280', margin: 0 }}>SSB-2FA-KEY</p>
                </div>
                <form onSubmit={handleTotp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <SField label="Enter 6-digit code to confirm" type="text" value="" onChange={() => {}} inputMode="numeric" maxLength={6} />
                  <button type="submit" disabled={loading} className="btn-primary" style={{ padding: '12px', fontSize: '15px', opacity: loading ? 0.6 : 1 }}>
                    {loading ? 'Verifying…' : 'Complete setup'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function SField({ label, type, value, onChange, required, inputMode, maxLength }: {
  label: string; type: string; value: string; onChange: (v: string) => void; required?: boolean; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; maxLength?: number;
}) {
  return (
    <div>
      <label style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4A7DA8', display: 'block', marginBottom: '6px' }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} required={required} inputMode={inputMode} maxLength={maxLength}
        style={{ width: '100%', border: '1px solid #DCE3EA', padding: '11px 12px', fontSize: '14px', color: '#0F2338', background: '#fff', outline: 'none' }} />
    </div>
  );
}
