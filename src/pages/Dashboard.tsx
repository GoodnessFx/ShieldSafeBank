import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { DEPOSIT_ADDRESSES, BTC_NETWORK, USDT_NETWORK } from '../lib/config';
import { getMe, getTransactions, requestWithdrawal, submitDeposit, updateProfile, trackUserActivity, getMyCardTracking, type MeData, type TransactionData, type CardTrackingData } from '../lib/api';
import { fmtUSD, fmtDateTimeShort, toAmount, fmtText } from '../lib/format';
import CardScanner, { readCardScan, writeCardScan, type CardScanResult } from '../components/CardScanner';
import CardTracking from '../components/CardTracking';
import Toast, { type ToastData } from '../components/Toast';

const BTC_ADDR = DEPOSIT_ADDRESSES.BTC;
const USDT_ADDR = DEPOSIT_ADDRESSES['USDT-ERC20'];

const TRANSACTIONS: ReturnType<typeof mapTx>[] = [];

const FALLBACK_BALANCE = 0;

function mapTx(t: TransactionData) {
  return {
    id: fmtText(t.id, ''),
    date: fmtText(t.date),
    type: t.type === 'deposit' ? 'Deposit' : 'Withdrawal',
    asset: fmtText(t.asset),
    amount: fmtText(t.amount, 'n/a'),
    rate: toAmount(t.rate) > 0 ? fmtUSD(t.rate) : '',
    usd: fmtUSD(t.usd),
    status: t.status === 'completed' || t.status === 'cleared' ? 'Completed' : t.status === 'pending' ? 'Pending' : 'On Hold',
  };
}

function useCountUp(target: number, duration: number) {
  const safeTarget = toAmount(target);
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + (safeTarget - from) * eased;
      setValue(v);
      fromRef.current = v;
      if (t < 1) requestAnimationFrame(tick);
      else setValue(safeTarget);
    };
    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [safeTarget, duration]);
  return value;
}

export default function Dashboard() {
  const nav = useNavigate();
  const [copied, setCopied] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawSent, setWithdrawSent] = useState(false);
  const [wLoading, setWLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'btc' | 'usdt'>('btc');
  const [txs, setTxs] = useState(TRANSACTIONS);
  const [balanceTarget, setBalanceTarget] = useState(FALLBACK_BALANCE);
  const [user, setUser] = useState<MeData | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositError, setDepositError] = useState('');
  const [depositSent, setDepositSent] = useState(false);
  const [dLoading, setDLoading] = useState(false);
  const [cardScan, setCardScan] = useState<CardScanResult | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [cardTracking, setCardTracking] = useState<CardTrackingData | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileForm, setProfileForm] = useState({ firstName: '', middleName: '', lastName: '', phone: '', dob: '', address: '', businessName: '' });
  const balance = useCountUp(balanceTarget, 1800);

  function profileFromUser(u: MeData | null) {
    return {
      firstName: u?.firstName || '',
      middleName: u?.middleName || '',
      lastName: u?.lastName || '',
      phone: u?.phone || '',
      dob: u?.dob || '',
      address: u?.address || '',
      businessName: u?.businessName || '',
    };
  }

  async function saveProfile() {
    const p = profileForm;
    if (!p.firstName.trim() || !p.lastName.trim()) { setProfileError('First name and last name are required.'); return; }
    if (p.phone.trim() && !/^[+0-9()\-\s.]{7,20}$/.test(p.phone.trim())) { setProfileError('Enter a valid phone number, e.g. +1 555 010 2233.'); return; }
    setProfileError('');
    setProfileSaving(true);
    const r = await updateProfile({
      firstName: p.firstName.trim(), middleName: p.middleName.trim(), lastName: p.lastName.trim(),
      phone: p.phone.trim(), dob: p.dob, address: p.address.trim(), businessName: p.businessName.trim(),
    });
    setProfileSaving(false);
    if (!r.ok && !r.offline) {
      const msg = (r.data as { error?: string; message?: string } | null);
      setProfileError(msg && (msg.error || msg.message) ? String(msg.error || msg.message) : 'Changes could not be saved.');
      return;
    }
    setEditingProfile(false);
    const me = await getMe();
    if (me.ok && me.data) setUser(me.data);
    pushToast('Profile updated', 'Your details were saved. Our verification team sees the updated version.');
  }

  function currentEmail(): string {
    try {
      const lu = JSON.parse(localStorage.getItem('ssb_local_user') || 'null');
      if (lu && lu.email) return String(lu.email);
    } catch {
      // ignore
    }
    return '';
  }

  function pushToast(title: string, body: string, tone: ToastData['tone'] = 'success') {
    const id = `t${Date.now()}`;
    setToasts(prev => [...prev, { id, title, body, tone }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 7000);
  }

  function dismissToast(id: string) {
    setToasts(prev => prev.filter(t => t.id !== id));
  }

  function handleCardComplete(result: CardScanResult) {
    trackUserActivity('card_scan_complete', { note: `Card •••• ${result.last4} (${result.holderName})`, last4: result.last4 });
    const email = user?.email || currentEmail();
    if (email) writeCardScan(email, result);
    setCardScan(result);
    setScanOpen(false);
    pushToast(
      'Card details saved',
      `Your Shield Safe Bank card for ${result.holderName}, ending •••• ${result.last4}, was saved to your account.`,
    );
  }

  function logout() {
    trackUserActivity('logout', {});
    localStorage.removeItem('ssb_auth');
    localStorage.removeItem('ssb_token');
    localStorage.removeItem('ssb_local_user');
    nav('/');
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = await getMe();
      if (!cancelled && me.ok && me.data) {
        setUser(me.data);
        setBalanceTarget(toAmount(me.data.balance));
        setCardScan(readCardScan(me.data.email));
      }
      const t = await getTransactions();
      if (!cancelled && t.ok && t.data) setTxs(t.data.map(mapTx));
      const tr = await getMyCardTracking();
      if (!cancelled && tr.ok && tr.data && tr.data.tracking) setCardTracking(tr.data.tracking);
    })();
    return () => { cancelled = true; };
  }, []);

  function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    trackUserActivity('deposit_click', { note: `Opened/submitted deposit form (${activeTab === 'btc' ? 'BTC' : 'USDT'})` });
    const amt = parseFloat(depositAmount);
    if (!depositAmount || isNaN(amt)) { setDepositError('Enter an amount.'); return; }
    setDepositError('');
    setDLoading(true);
    submitDeposit(activeTab === 'btc' ? 'BTC' : 'USDT', amt).then(r => {
      if (r.ok && r.data) {
        setBalanceTarget(toAmount(r.data.balance));
        setDepositAmount('');
        setDLoading(false);
        setDepositSent(true);
        getTransactions().then(t => { if (t.ok && t.data) setTxs(t.data.map(mapTx)); });
      } else {
        setDLoading(false);
        setDepositError(r.data && r.data.error ? r.data.error : r.data && r.data.message ? r.data.message : 'Deposit could not be recorded.');
      }
    });
  }

  function copy(addr: string, key: string) {
    navigator.clipboard.writeText(addr).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    trackUserActivity('withdraw_click', { usd: parseFloat(withdrawAmount) || 0 });
    const amt = parseFloat(withdrawAmount);
    if (!withdrawAmount || isNaN(amt)) { setWithdrawError('Enter an amount.'); return; }
    if (amt > balanceTarget) { setWithdrawError(`Amount exceeds your available balance of ${fmtUSD(balanceTarget)}.`); return; }
    if (amt < 10) { setWithdrawError('Minimum withdrawal is $10.00.'); return; }
    setWithdrawError('');
    setWLoading(true);
    requestWithdrawal(amt).then(r => {
      if (r.ok) {
        setBalanceTarget(r.data ? toAmount(r.data.balance) : toAmount(balanceTarget) - amt);
        setWithdrawAmount('');
        setWLoading(false);
        setWithdrawSent(true);
      } else {
        setWLoading(false);
        setWithdrawError(r.data && r.data.error ? r.data.error : 'Request could not be completed.');
      }
    });
  }

  const kycPending = user && (user.kycStatus === 'in_review' || user.kycStatus === 'pending');

  return (
    <>
      <title>Dashboard | Shield Safe Bank</title>
      <div style={{ background: '#F4F6F8', minHeight: 'calc(100vh - 56px)' }}>

        {/* Dashboard nav strip */}
        <div style={{ background: '#0B2B5C', borderBottom: '1px solid #0A2044' }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-11 flex items-center justify-between">
            <nav className="dash-rail" style={{ display: 'flex', gap: '24px' }}>
              {['Overview', 'My Card', 'Tracking', 'Deposit', 'Withdraw', 'History'].map(t => (
                <a key={t} href={`#${t === 'My Card' ? 'card' : t.toLowerCase()}`} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#A9C6E8', textDecoration: 'none', letterSpacing: '0.04em', transition: 'color 0.12s' }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.color = '#fff'; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.color = '#A9C6E8'; }}>
                  {t}
                </a>
              ))}
            </nav>
            <button onClick={logout} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#A9C6E8', background: 'none', border: 'none', cursor: 'pointer' }}>Log out</button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Balance card */}
          <div id="overview" className="dash-balance-card" style={{ background: '#123C7C', padding: '36px', display: 'grid', gridTemplateColumns: '1fr auto', gap: '20px', alignItems: 'center' }}>
            <div>
              {user && (
                <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '18px', color: '#fff', margin: '0 0 4px' }}>
                  Welcome, {user.name}
                </p>
              )}
              {user && user.accountNumber && (
                <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#A9C6E8', margin: '0 0 12px', letterSpacing: '0.04em' }}>
                  Account number: {user.accountNumber}
                </p>
              )}
              <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4779C4', margin: '0 0 8px' }}>USD Balance</p>
              <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 600, color: '#fff', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
                {fmtUSD(balance)}
              </p>
              <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#4779C4', margin: 0 }}>
                As of {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
              {user ? (
                <StatusPill label={user.kycStatus === 'approved' ? 'Verified' : user.kycStatus === 'in_review' || user.kycStatus === 'pending' ? 'Pending' : user.kycStatus === 'rejected' ? 'Rejected' : 'Active'}
                  color={user.kycStatus === 'approved' ? '#1E7A4C' : user.kycStatus === 'rejected' ? '#DC2626' : '#9A6B00'} />
              ) : <StatusPill label="Verified" color="#1E7A4C" />}
              <StatusPill label="2FA Active" color="#123C7C" border />
            </div>
          </div>

          {/* Profile details — collected at sign-up, editable here, visible to the admin */}
          <div id="profile" style={{ background: '#fff', border: '1px solid #DCE3EA', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '18px' }}>
              <div>
                <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '18px', color: '#0A2044', margin: '0 0 4px' }}>Profile details</h2>
                <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                  The identity information we hold for your account. Our verification team sees the same details.
                </p>
              </div>
              {!editingProfile ? (
                <button onClick={() => { setProfileForm(profileFromUser(user)); setEditingProfile(true); }}
                  style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', fontWeight: 600, color: '#fff', background: '#123C7C', border: 'none', padding: '9px 18px', cursor: 'pointer' }}>
                  EDIT DETAILS
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={saveProfile} disabled={profileSaving}
                    style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', fontWeight: 600, color: '#fff', background: profileSaving ? '#6B7280' : '#1E7A4C', border: 'none', padding: '9px 18px', cursor: profileSaving ? 'default' : 'pointer' }}>
                    {profileSaving ? 'SAVING…' : 'SAVE'}
                  </button>
                  <button onClick={() => { setEditingProfile(false); setProfileError(''); }}
                    style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', fontWeight: 600, color: '#6B7280', background: '#F4F6F8', border: '1px solid #DCE3EA', padding: '9px 18px', cursor: 'pointer' }}>
                    CANCEL
                  </button>
                </div>
              )}
            </div>

            {profileError && <p style={{ fontSize: '13px', color: '#DC2626', margin: '0 0 14px' }}>{profileError}</p>}

            {editingProfile ? (
              <div className="grid sm:grid-cols-3 gap-4">
                <DashField label="First name" value={profileForm.firstName} onChange={v => setProfileForm(p => ({ ...p, firstName: v }))} />
                <DashField label="Middle name" value={profileForm.middleName} onChange={v => setProfileForm(p => ({ ...p, middleName: v }))} />
                <DashField label="Last name" value={profileForm.lastName} onChange={v => setProfileForm(p => ({ ...p, lastName: v }))} />
                <DashField label="Phone number" value={profileForm.phone} onChange={v => setProfileForm(p => ({ ...p, phone: v }))} placeholder="+1 555 010 2233" />
                <DashField label="Date of birth" value={profileForm.dob} onChange={v => setProfileForm(p => ({ ...p, dob: v }))} type="date" />
                <DashField label="Business name" value={profileForm.businessName} onChange={v => setProfileForm(p => ({ ...p, businessName: v }))} placeholder="Optional" />
                <div style={{ gridColumn: '1 / -1' }}>
                  <DashField label="Residential address" value={profileForm.address} onChange={v => setProfileForm(p => ({ ...p, address: v }))} placeholder="Street, city, state, ZIP" />
                </div>
              </div>
            ) : (
              <div className="grid sm:grid-cols-3 gap-4" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px' }}>
                <ProfileRow label="Full name" value={[user?.firstName, user?.middleName, user?.lastName].filter(Boolean).join(' ') || user?.name || '—'} />
                <ProfileRow label="Phone number" value={user?.phone || '—'} />
                <ProfileRow label="Date of birth" value={user?.dob || '—'} />
                <ProfileRow label="Email address" value={user?.email || '—'} />
                <ProfileRow label="Account number" value={user?.accountNumber || '—'} />
                <ProfileRow label="Account type" value={(user?.type || 'personal').replace(/^\w/, c => c.toUpperCase())} />
                <div style={{ gridColumn: '1 / -1' }}>
                  <ProfileRow label="Residential address" value={user?.address || '—'} />
                </div>
                {user?.businessName && <div style={{ gridColumn: '1 / -1' }}><ProfileRow label="Business name" value={user.businessName} /></div>}
              </div>
            )}
          </div>

          {/* Card verification */}
          <div id="card" style={{ background: '#fff', border: '1px solid #DCE3EA', borderLeft: cardScan ? '1px solid #DCE3EA' : '4px solid #4779C4', padding: '28px', transition: 'border-color 0.2s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '18px', color: '#0A2044', margin: '0 0 4px' }}>Your Shield Safe Bank card</h2>
                <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                  Scan both sides to add your physical card to your account.
                </p>
              </div>
              {cardScan ? (
                <StatusPill label="Card verified" color="#1E7A4C" />
              ) : (
                <StatusPill label="Not scanned" color="#9A6B00" />
              )}
            </div>

            <div className="card-scan-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) 1fr', gap: '28px', alignItems: 'center' }}>
              <CardVisual last4={cardScan ? cardScan.last4 : '••••'} holderName={cardScan ? cardScan.holderName || '' : ''} />

              <div>
                {cardScan ? (
                  <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '18px', marginBottom: '16px' }}>
                    <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#166534', margin: 0, lineHeight: 1.8 }}>
                      Front side captured<br />
                      Back side captured<br />
                      Saved {fmtDateTimeShort(cardScan && cardScan.scannedAt)}{cardScan.holderName ? ` for ${cardScan.holderName}` : ''}
                    </p>
                  </div>
                ) : (
                  <ul style={{ margin: '0 0 18px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      'You scan the front of the card first, then turn it over and scan the back.',
                      'Both sides must be captured before your card is saved.',
                      'Hold the card flat and fill the frame.',
                    ].map(t => (
                      <li key={t} style={{ display: 'flex', gap: '10px', fontSize: '13px', color: '#4A5568', lineHeight: 1.6 }}>
                        <span style={{ color: '#4779C4', fontWeight: 700, flexShrink: 0 }}>•</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  onClick={() => { trackUserActivity('card_scan_start', {}); setScanOpen(true); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#123C7C', color: '#fff', border: 'none', padding: '12px 22px', fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#0B2B5C'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#123C7C'; }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <rect x="1" y="4" width="14" height="9" rx="1" stroke="#fff" strokeWidth="1.3" />
                    <circle cx="8" cy="8.5" r="2.4" stroke="#fff" strokeWidth="1.3" />
                    <path d="M5.5 4l1-1.6h3L10.5 4" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round" />
                  </svg>
                  {cardScan ? 'Scan card again' : 'Scan your card'}
                </button>
              </div>
            </div>
          </div>

          {/* Card delivery tracking */}
          <div id="tracking" style={{ background: '#fff', border: '1px solid #DCE3EA', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '18px', color: '#0A2044', margin: '0 0 4px' }}>Card Delivery Tracking</h2>
                <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                  Real-time status of your Shield Safe Bank card delivery.
                </p>
              </div>
              {cardTracking && (
                <span style={{
                  fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600,
                  color: cardTracking.step === 4 ? '#1E7A4C' : '#4779C4',
                  background: cardTracking.step === 4 ? '#F0FDF4' : '#EEF2FA',
                  border: `1px solid ${cardTracking.step === 4 ? '#BBF7D0' : '#C7D5EE'}`,
                  padding: '4px 12px',
                }}>
                  {cardTracking.step === 4 ? 'DELIVERED' : 'IN PROGRESS'}
                </span>
              )}
            </div>

            {cardTracking ? (
              <CardTracking tracking={cardTracking} />
            ) : (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                padding: '40px 20px', textAlign: 'center',
                background: '#F4F6F9', border: '1px dashed #DCE3EC',
              }}>
                <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true">
                  <rect x="2" y="12" width="28" height="22" rx="2" stroke="#C7D5EE" strokeWidth="2" />
                  <path d="M30 16l8 4v8l-8 4" stroke="#C7D5EE" strokeWidth="2" strokeLinejoin="round" />
                  <circle cx="9" cy="36" r="3" stroke="#C7D5EE" strokeWidth="1.8" />
                  <circle cx="25" cy="36" r="3" stroke="#C7D5EE" strokeWidth="1.8" />
                </svg>
                <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '15px', color: '#6B7280', margin: 0 }}>
                  No active delivery
                </p>
                <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#9CA3AF', margin: 0, maxWidth: '340px', lineHeight: 1.6 }}>
                  Once your card order is placed, your personalised tracking will appear here. Our team will update each step as your card moves through the process.
                </p>
              </div>
            )}
          </div>

          {kycPending ? (            <div style={{ background: '#FFFBEB', border: '1px solid #F59E0B', padding: '32px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <div style={{ width: '8px', flexShrink: 0, background: '#F59E0B', alignSelf: 'stretch' }} />
              <div>
                <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '18px', color: '#92400E', margin: '0 0 6px' }}>Verification in progress</p>
                <p style={{ fontSize: '14px', color: '#78350F', lineHeight: 1.65, margin: 0 }}>
                  Our team has been notified and will verify your account shortly. You can still deposit below.
                </p>
              </div>
            </div>
          ) : null}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Deposit addresses */}
            <div id="deposit" style={{ background: '#fff', border: '1px solid #DCE3EA', padding: '28px' }}>
              <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '18px', color: '#0A2044', margin: '0 0 4px' }}>Deposit address</h2>
              <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 20px' }}>Send only the matching asset to each address.</p>

              <div style={{ display: 'flex', gap: 0, marginBottom: '16px', border: '1px solid #DCE3EA' }}>
                {(['btc', 'usdt'] as const).map(t => (
                  <button key={t} onClick={() => setActiveTab(t)}
                    style={{ flex: 1, padding: '8px', background: activeTab === t ? '#123C7C' : '#fff', color: activeTab === t ? '#fff' : '#6B7280', border: 'none', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, fontSize: '13px', cursor: 'pointer', textTransform: 'uppercase', transition: 'background 0.12s, color 0.12s' }}>
                    {t}
                  </button>
                ))}
              </div>

              {activeTab === 'btc' ? (
                <AddressBlock addr={BTC_ADDR} network={BTC_NETWORK} onCopy={() => copy(BTC_ADDR, 'btc')} copied={copied === 'btc'} />
              ) : (
                <AddressBlock addr={USDT_ADDR} network={USDT_NETWORK} onCopy={() => copy(USDT_ADDR, 'usdt')} copied={copied === 'usdt'} />
              )}

              {depositSent ? (
                <div style={{ marginTop: '16px', background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '20px' }}>
                  <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '15px', color: '#15803D', margin: '0 0 6px' }}>Deposit recorded</p>
                  <p style={{ fontSize: '13px', color: '#166534', margin: 0 }}>
                    Your balance was credited. The transfer will be confirmed once it lands on-chain.
                  </p>
                  <button onClick={() => setDepositSent(false)} style={{ marginTop: '12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#166534', background: 'none', border: '1px solid #BBF7D0', padding: '6px 14px', cursor: 'pointer' }}>Make another deposit</button>
                </div>
              ) : (
                <form onSubmit={handleDeposit} style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4779C4', display: 'block', marginBottom: '6px' }}>Amount to deposit (USD value)</label>
                    <div style={{ display: 'flex', border: '1px solid #DCE3EA', alignItems: 'center' }}>
                      <span style={{ padding: '0 12px', fontFamily: 'IBM Plex Mono, monospace', color: '#6B7280', fontSize: '16px' }}>$</span>
                      <input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} min="0" step="0.01" placeholder="0.00"
                        style={{ flex: 1, border: 'none', padding: '11px 8px 11px 0', fontFamily: 'IBM Plex Mono, monospace', fontSize: '18px', fontWeight: 600, color: '#0A2044', background: 'transparent', outline: 'none' }}
                        aria-label="Deposit amount in USD" />
                    </div>
                  </div>
                  {depositError && <p style={{ fontSize: '13px', color: '#DC2626', margin: 0, fontWeight: 500 }}>{depositError}</p>}
                  <button type="submit" disabled={dLoading} style={{ background: '#123C7C', color: '#fff', border: 'none', padding: '12px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'background 0.15s', opacity: dLoading ? 0.6 : 1 }}>
                    {dLoading ? 'Recording…' : 'I have sent this amount'}
                  </button>
                </form>
              )}

              <div style={{ marginTop: '14px', background: '#FFF8E1', border: '1px solid #F59E0B', padding: '10px 14px' }}>
                <p style={{ fontSize: '12px', color: '#92400E', margin: 0, lineHeight: 1.5 }}>
                  <strong>Wrong network = permanent loss.</strong> Sending {activeTab === 'btc' ? 'USDT or any non-BTC asset' : 'BTC or non-ERC-20 USDT'} to this address will result in unrecoverable funds.
                </p>
              </div>
            </div>

            {/* Withdrawal */}
            <div id="withdraw" style={{ background: '#fff', border: '1px solid #DCE3EA', padding: '28px' }}>
              <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '18px', color: '#0A2044', margin: '0 0 4px' }}>Withdraw USD</h2>
              <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 20px' }}>To linked bank account (ACH). Free, one to three business days.</p>

              {withdrawSent ? (
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '20px' }}>
                  <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '15px', color: '#15803D', margin: '0 0 6px' }}>Withdrawal requested</p>
                  <p style={{ fontSize: '13px', color: '#166534', margin: 0 }}>
                    Your withdrawal is being processed.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleWithdraw} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4779C4', display: 'block', marginBottom: '6px' }}>Amount (USD)</label>
                    <div style={{ display: 'flex', border: '1px solid #DCE3EA', alignItems: 'center' }}>
                      <span style={{ padding: '0 12px', fontFamily: 'IBM Plex Mono, monospace', color: '#6B7280', fontSize: '16px' }}>$</span>
                      <input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} min="10" step="0.01"
                        style={{ flex: 1, border: 'none', padding: '11px 8px 11px 0', fontFamily: 'IBM Plex Mono, monospace', fontSize: '18px', fontWeight: 600, color: '#0A2044', background: 'transparent', outline: 'none' }}
                        aria-label="Withdrawal amount in USD" />
                    </div>
                    <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280', margin: '4px 0 0' }}>
                      Available: {fmtUSD(balanceTarget)}
                    </p>
                  </div>
                  {withdrawError && <p style={{ fontSize: '13px', color: '#DC2626', margin: 0, fontWeight: 500 }}>{withdrawError}</p>}
                  <div style={{ background: '#F4F6F8', border: '1px solid #DCE3EA', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#374151', margin: 0 }}>
                      From: {user && user.accountNumber ? user.accountNumber : 'Shield Safe Bank account'}
                    </p>
                    <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#374151', margin: 0 }}>
                      To: ••••• Bank ending 4821 (ACH)
                    </p>
                  </div>
                  <button type="submit" disabled={wLoading} style={{ background: '#123C7C', color: '#fff', border: 'none', padding: '12px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'background 0.15s', opacity: wLoading ? 0.6 : 1 }}>
                    {wLoading ? 'Submitting…' : 'Request withdrawal'}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Transaction history */}
          <div id="history" style={{ background: '#fff', border: '1px solid #DCE3EA' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #DCE3EA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '18px', color: '#0A2044', margin: 0 }}>Transaction history</h2>
              <button style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#4779C4', background: 'none', border: '1px solid #DCE3EA', padding: '6px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 4h9M4 7h5M6 10h1" stroke="#4779C4" strokeWidth="1.2" strokeLinecap="square" /></svg>
                Download PDF
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              {txs.length === 0 ? (
                <div style={{ padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '16px', color: '#0A2044', margin: 0 }}>No activity yet</p>
                  <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>Send your first deposit to the address above and it will appear here.</p>
                </div>
              ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#F4F6F8' }}>
                    {['Date', 'Type', 'Asset', 'Amount', 'Rate', 'USD', 'Status'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: h === 'USD' || h === 'Amount' ? 'right' : 'left', fontWeight: 600, fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B7280', whiteSpace: 'nowrap', borderBottom: '1px solid #DCE3EA' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {txs.map((tx, i) => (
                    <tr key={tx.id} style={{ borderBottom: i < txs.length - 1 ? '1px solid #DCE3EA' : 'none' }}>
                      <td style={{ padding: '12px 16px', color: '#374151' }}>{tx.date}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 500, color: tx.type === 'Deposit' ? '#1E7A4C' : '#123C7C' }}>
                          {tx.type === 'Deposit' ? '↓' : '↑'} {tx.type}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#374151' }}>{tx.asset}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#374151' }}>{tx.amount || 'n/a'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#6B7280' }}>{tx.rate || 'n/a'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#0A2044' }}>{tx.usd}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: tx.status === 'Pending' ? '#9A6B00' : tx.status === 'On Hold' ? '#9A6B00' : '#1E7A4C', letterSpacing: '0.04em' }}>
                          ● {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
            </div>
          </div>
        </div>
      </div>
      <Toast toasts={toasts} onDismiss={dismissToast} />
      {scanOpen && (
        <CardScanner
          accountName={user?.name || ''}
          initialHolderName={cardScan?.holderName || ''}
          onClose={() => setScanOpen(false)}
          onComplete={handleCardComplete}
        />
      )}
    </>
  );
}

function CardVisual({ last4, holderName }: { last4: string; holderName: string }) {
  const masked = last4 && last4 !== '••••';
  const holder = (holderName || '').trim();
  return (
    <figure style={{ margin: 0 }}>
      <div
        style={{
          background: 'linear-gradient(135deg, #12498F 0%, #123C7C 48%, #0B2B5C 100%)',
          borderRadius: '14px',
          border: '1px solid #0A2044',
          padding: '18px 20px',
          aspectRatio: '1.586 / 1',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 10px 26px rgba(10, 32, 68, 0.28)',
        }}
        aria-hidden="true"
      >
        {/* Top row: logo lockup and contactless mark */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CardShieldLogo />
            <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '13.5px', color: '#fff', letterSpacing: '0.05em', lineHeight: 1.1 }}>
              SHIELD SAFE BANK
            </span>
          </div>
          <ContactlessMark />
        </div>

        {/* Chip */}
        <div style={{ marginTop: '4px' }}>
          <EmvChip />
        </div>

        {/* Card number, masked */}
        <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: 'clamp(14px, 4.4vw, 18px)', color: '#fff', margin: '0 0 12px', letterSpacing: '0.06em', fontVariantNumeric: 'tabular-nums', textShadow: '0 1px 2px rgba(10, 32, 68, 0.45)' }}>
          •••• •••• •••• {masked ? last4 : '••••'}
        </p>

        {/* Holder, expiry, network mark */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '12px' }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8.5px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#A9C6E8', margin: '0 0 3px' }}>
              Cardholder
            </p>
            <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '11.5px', color: '#fff', margin: 0, letterSpacing: '0.05em', textTransform: 'uppercase', filter: 'blur(5px)', userSelect: 'none' }}>
              {holder === '' ? 'Cardholder Name' : holder}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px' }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8.5px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#A9C6E8', margin: '0 0 3px' }}>
                Expires
              </p>
              <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#fff', margin: 0, letterSpacing: '0.1em', filter: 'blur(4px)', userSelect: 'none' }}>
                ••/••
              </p>
            </div>
            <MastercardMark />
          </div>
        </div>
      </div>

      <figcaption style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10.5px', color: '#6B7280', margin: '10px 0 0', lineHeight: 1.5 }}>
        Card details are hidden for your security.
      </figcaption>
    </figure>
  );
}

function CardShieldLogo() {
  return (
    <svg width="20" height="23" viewBox="0 0 28 32" fill="none" aria-hidden="true">
      <path d="M14 1L2 6V17C2 23.627 7.373 29.627 14 31C20.627 29.627 26 23.627 26 17V6L14 1Z" fill="#E3B23C" />
      <rect x="11" y="12" width="6" height="7" rx="0.5" stroke="#123C7C" strokeWidth="1.6" fill="none" />
      <path d="M11.5 12V10.5C11.5 8.567 13.067 7 15 7V7" stroke="#123C7C" strokeWidth="1.6" strokeLinecap="square" />
      <circle cx="14" cy="15.2" r="1" fill="#123C7C" />
      <line x1="14" y1="16.2" x2="14" y2="17.8" stroke="#123C7C" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function ContactlessMark() {
  return (
    <svg width="18" height="20" viewBox="0 0 18 20" fill="none" aria-hidden="true">
      <path d="M5 6.5a7 7 0 0 1 0 7" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M8.4 4.4a10.5 10.5 0 0 1 0 11.2" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M11.8 2.3a14 14 0 0 1 0 15.4" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function EmvChip() {
  return (
    <svg width="34" height="26" viewBox="0 0 34 26" fill="none" aria-hidden="true">
      <rect x="0.5" y="0.5" width="33" height="25" rx="4" fill="#D8B26B" stroke="#B8934A" />
      <path d="M11 0.5v25M23 0.5v25M0.5 9h33M0.5 17h33" stroke="#B8934A" strokeWidth="0.9" />
      <rect x="8" y="7" width="18" height="12" rx="2" fill="#C9A259" stroke="#B8934A" strokeWidth="0.8" />
    </svg>
  );
}

function MastercardMark() {
  return (
    <svg width="36" height="23" viewBox="0 0 36 23" fill="none" aria-hidden="true">
      <circle cx="13" cy="11.5" r="10.5" fill="#EB001B" />
      <circle cx="23" cy="11.5" r="10.5" fill="#F79E1B" fillOpacity="0.92" />
    </svg>
  );
}

function AddressBlock({ addr, network, onCopy, copied }: { addr: string; network: string; onCopy: () => void; copied: boolean }) {
  return (
    <div>
      <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280', margin: '0 0 6px' }}>{network}</p>
      <div style={{ display: 'flex', border: '1px solid #DCE3EA', alignItems: 'center', gap: '0', background: '#F4F6F8' }}>
        <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#0A2044', padding: '10px 12px', margin: 0, flex: 1, wordBreak: 'break-all', lineHeight: 1.5 }}>{addr}</p>
        <button onClick={onCopy} aria-label="Copy address"
          style={{ padding: '10px 14px', background: copied ? '#1E7A4C' : '#123C7C', border: 'none', cursor: 'pointer', flexShrink: 0, transition: 'background 0.15s' }}>
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-7" stroke="#fff" strokeWidth="1.5" strokeLinecap="square" /></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="3" width="9" height="10" rx="0" stroke="#fff" strokeWidth="1.2" /><path d="M4 3V2h9v9h-1" stroke="#fff" strokeWidth="1.2" /></svg>
          )}
        </button>
      </div>
    </div>
  );
}

function StatusPill({ label, color, border }: { label: string; color: string; border?: boolean }) {
  return (
    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, color: '#fff', background: border ? 'transparent' : color, border: border ? '1px solid #4779C4' : 'none', padding: '3px 10px', letterSpacing: '0.04em' }}>
      {label}
    </span>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4779C4', margin: '0 0 3px' }}>{label}</p>
      <p style={{ fontSize: '13.5px', color: '#0A2044', margin: 0, wordBreak: 'break-word' }}>{value}</p>
    </div>
  );
}

function DashField({ label, value, onChange, type, placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4779C4', display: 'block', marginBottom: '6px' }}>{label}</label>
      <input type={type || 'text'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', border: '1px solid #DCE3EA', padding: '10px 12px', fontSize: '14px', color: '#0A2044', background: '#fff', outline: 'none', boxSizing: 'border-box' }} />
    </div>
  );
}
