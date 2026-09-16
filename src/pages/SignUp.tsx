import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { googleSignIn, googleSvg } from '../lib/google';
import { register as apiRegister, googleAuth } from '../lib/api';
import BrandMark from '../components/BrandMark';

export default function SignUp() {
  const [params] = useSearchParams();
  const [type, setType] = useState<'personal' | 'business'>(params.get('type') === 'business' ? 'business' : 'personal');
  const [form, setForm] = useState({ email: '', password: '', confirm: '', firstName: '', middleName: '', lastName: '', phone: '', dob: '', address: '', bizName: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const nav = useNavigate();

  function f(key: string) { return (v: string) => setForm(prev => ({ ...prev, [key]: v })); }

  function fullName(): string {
    const parts = [form.firstName.trim(), form.middleName.trim(), form.lastName.trim()].filter(Boolean);
    return parts.join(' ');
  }

  function handleGoogle() {
    setError(''); setLoading(true);
    googleSignIn().then(res => {
      if (!res.ok) { setLoading(false); setError('Google sign-in could not be completed.'); return; }
      googleAuth(res.email || '', res.name || '', res.idToken || '').then(r => {
        if (!r.ok && !r.offline) { setLoading(false); setError('Google sign-in could not be completed.'); return; }
        setLoading(false);
        nav('/dashboard');
      });
    });
  }

  function handleAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) { setError('First name and last name are required.'); return; }
    if (!form.phone.trim()) { setError('Phone number is required.'); return; }
    if (!/^[+0-9()\-\s.]{7,20}$/.test(form.phone.trim())) { setError('Enter a valid phone number, e.g. +1 555 010 2233.'); return; }
    if (!form.dob) { setError('Date of birth is required.'); return; }
    const dobDate = new Date(form.dob);
    if (isNaN(dobDate.getTime()) || dobDate > new Date()) { setError('Enter a valid date of birth.'); return; }
    const age = (Date.now() - dobDate.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (age < 18) { setError('You must be at least 18 years old to open an account.'); return; }
    if (!form.address.trim()) { setError('Residential address is required.'); return; }
    if (form.password !== form.confirm) { setError("Passwords do not match."); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setError(''); setLoading(true);
    const payload = {
      email: form.email,
      password: form.password,
      name: fullName() || form.email.split('@')[0] || 'New User',
      type,
      firstName: form.firstName.trim(),
      middleName: form.middleName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim(),
      dob: form.dob,
      address: form.address.trim(),
      businessName: type === 'business' ? form.bizName.trim() : undefined,
    };
    apiRegister(payload).then(r => {
      if (!r.ok && !r.offline) {
        setLoading(false);
        setError(r.data && r.data.error ? r.data.error : 'Account could not be created.');
        return;
      }
      setLoading(false);
      nav('/dashboard');
    });
  }

  return (
    <>
      <title>Open Account | Shield Safe Bank</title>
      <div style={{ minHeight: 'calc(100vh - 120px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6F8', padding: '40px 16px' }}>
        <div style={{ width: '100%', maxWidth: '480px' }}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <BrandMark height={40} />
          </div>

          <div className="auth-card" style={{ background: '#fff', border: '1px solid #DCE3EA', padding: '40px' }}>
            <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '22px', color: '#0A2044', margin: '0 0 20px' }}>Create your account</h1>
            <div style={{ display: 'flex', border: '1px solid #DCE3EA', marginBottom: '24px' }}>
              {(['personal', 'business'] as const).map(t => (
                <button key={t} onClick={() => setType(t)} style={{ flex: 1, padding: '10px', background: type === t ? '#123C7C' : '#fff', color: type === t ? '#fff' : '#6B7280', border: 'none', fontSize: '14px', fontWeight: type === t ? 600 : 400, cursor: 'pointer', textTransform: 'capitalize', transition: 'background 0.12s, color 0.12s' }}>
                  {t}
                </button>
              ))}
            </div>
            <form onSubmit={handleAccount} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <button type="button" onClick={handleGoogle} disabled={loading}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', border: '1px solid #DCE3EA', background: '#fff', padding: '11px', fontSize: '14px', fontWeight: 500, color: '#0A2044', cursor: 'pointer', transition: 'background 0.15s', opacity: loading ? 0.6 : 1 }}
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
              <div className="grid sm:grid-cols-3 gap-4">
                <SField label="First name" type="text" value={form.firstName} onChange={f('firstName')} required autoComplete="given-name" />
                <SField label="Middle name" type="text" value={form.middleName} onChange={f('middleName')} autoComplete="additional-name" />
                <SField label="Last name" type="text" value={form.lastName} onChange={f('lastName')} required autoComplete="family-name" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <SField label="Phone number" type="tel" value={form.phone} onChange={f('phone')} required inputMode="tel" maxLength={20} autoComplete="tel" placeholder="+1 555 010 2233" />
                <SField label="Date of birth" type="date" value={form.dob} onChange={f('dob')} required />
              </div>
              <SField label="Residential address" type="text" value={form.address} onChange={f('address')} required autoComplete="street-address" placeholder="Street, city, state, ZIP" />
              {type === 'business' && <SField label="Business name" type="text" value={form.bizName} onChange={f('bizName')} required />}
              <SField label="Password" type="password" value={form.password} onChange={f('password')} required autoComplete="new-password" />
              <SField label="Confirm password" type="password" value={form.confirm} onChange={f('confirm')} required autoComplete="new-password" />
              {error && <p style={{ fontSize: '13px', color: '#DC2626', margin: 0 }}>{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary" style={{ padding: '12px', fontSize: '15px', marginTop: '4px', opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Creating…' : 'Open account'}
              </button>
              <p style={{ fontSize: '13px', color: '#6B7280', margin: 0, textAlign: 'center' }}>
                Already have an account? <Link to="/login" style={{ color: '#123C7C' }}>Log in</Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

function SField({ label, type, value, onChange, required, inputMode, maxLength, autoComplete, placeholder }: {
  label: string; type: string; value: string; onChange: (v: string) => void; required?: boolean; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; maxLength?: number; autoComplete?: string; placeholder?: string;
}) {
  return (
    <div>
      <label style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4779C4', display: 'block', marginBottom: '6px' }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} required={required} inputMode={inputMode} maxLength={maxLength} autoComplete={autoComplete} placeholder={placeholder}
        style={{ width: '100%', border: '1px solid #DCE3EA', padding: '11px 12px', fontSize: '14px', color: '#0A2044', background: '#fff', outline: 'none', boxSizing: 'border-box' }} />
    </div>
  );
}
