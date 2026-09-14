import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { DEPOSIT_ADDRESSES, BTC_NETWORK, USDT_NETWORK } from '../lib/config';
import { getMe, getTransactions, requestWithdrawal, type MeData, type TransactionData } from '../lib/api';

const BTC_ADDR = DEPOSIT_ADDRESSES.BTC;
const USDT_ADDR = DEPOSIT_ADDRESSES['USDT-ERC20'];

const TRANSACTIONS = [
  { id: 'T001', date: '2025-09-10', type: 'Deposit', asset: 'BTC', amount: '0.25', rate: '$67,842.50', usd: '$16,875.83', status: 'Completed' },
  { id: 'T002', date: '2025-09-08', type: 'Withdrawal', asset: 'USD', amount: '', rate: '', usd: '$5,000.00', status: 'Completed' },
  { id: 'T003', date: '2025-09-05', type: 'Deposit', asset: 'USDT', amount: '2,000', rate: '$0.9998', usd: '$1,999.10', status: 'Completed' },
  { id: 'T004', date: '2025-09-01', type: 'Withdrawal', asset: 'USD', amount: '', rate: '', usd: '$2,500.00', status: 'Completed' },
  { id: 'T005', date: '2025-08-28', type: 'Deposit', asset: 'BTC', amount: '0.10', rate: '$64,180.00', usd: '$6,386.01', status: 'Completed' },
];

const FALLBACK_BALANCE = 17760.94;

function fmtUSD(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function mapTx(t: TransactionData) {
  return {
    id: t.id,
    date: t.date,
    type: t.type === 'deposit' ? 'Deposit' : 'Withdrawal',
    asset: t.asset,
    amount: t.amount || '',
    rate: t.rate ? fmtUSD(t.rate) : '',
    usd: fmtUSD(t.usd),
    status: t.status === 'completed' || t.status === 'cleared' ? 'Completed' : t.status === 'pending' ? 'Pending' : 'On Hold',
  };
}

function useCountUp(target: number, duration: number) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + (target - from) * eased;
      setValue(v);
      fromRef.current = v;
      if (t < 1) requestAnimationFrame(tick);
      else setValue(target);
    };
    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [target, duration]);
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
  const balance = useCountUp(balanceTarget, 1800);

  function logout() {
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
        setBalanceTarget(me.data.balance);
      }
      const t = await getTransactions();
      if (!cancelled && t.ok && t.data) setTxs(t.data.map(mapTx));
    })();
    return () => { cancelled = true; };
  }, []);

  function copy(addr: string, key: string) {
    navigator.clipboard.writeText(addr).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(withdrawAmount);
    if (!withdrawAmount || isNaN(amt)) { setWithdrawError('Enter an amount.'); return; }
    if (amt > balanceTarget) { setWithdrawError(`Amount exceeds your available balance of ${fmtUSD(balanceTarget)}.`); return; }
    if (amt < 10) { setWithdrawError('Minimum withdrawal is $10.00.'); return; }
    setWithdrawError('');
    setWLoading(true);
    requestWithdrawal(amt).then(r => {
      if (r.ok) {
        setBalanceTarget(r.data ? r.data.balance : balanceTarget - amt);
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
      <title>Dashboard — Shield Safe Bank</title>
      <div style={{ background: '#F4F6F8', minHeight: 'calc(100vh - 56px)' }}>

        {/* Dashboard nav strip */}
        <div style={{ background: '#12283F', borderBottom: '1px solid #0F2338' }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-11 flex items-center justify-between">
            <nav style={{ display: 'flex', gap: '24px' }}>
              {['Overview', 'Deposit', 'Withdraw', 'History'].map(t => (
                <a key={t} href={`#${t.toLowerCase()}`} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#A8C4DA', textDecoration: 'none', letterSpacing: '0.04em', transition: 'color 0.12s' }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.color = '#fff'; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.color = '#A8C4DA'; }}>
                  {t}
                </a>
              ))}
            </nav>
            <button onClick={logout} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#A8C4DA', background: 'none', border: 'none', cursor: 'pointer' }}>Log out</button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Balance card */}
          <div id="overview" style={{ background: '#1B3A5C', padding: '36px', display: 'grid', gridTemplateColumns: '1fr auto', gap: '20px', alignItems: 'center' }}>
            <div>
              <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4A7DA8', margin: '0 0 8px' }}>USD Balance</p>
              <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 600, color: '#fff', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
                {fmtUSD(balance)}
              </p>
              <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#4A7DA8', margin: 0 }}>
                As of {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
              {user ? (
                <StatusPill label={user.kycStatus === 'approved' ? 'Verified' : user.kycStatus === 'in_review' || user.kycStatus === 'pending' ? 'Pending' : user.kycStatus === 'rejected' ? 'Rejected' : 'Active'}
                  color={user.kycStatus === 'approved' ? '#1E7A4C' : user.kycStatus === 'rejected' ? '#DC2626' : '#9A6B00'} />
              ) : <StatusPill label="Verified" color="#1E7A4C" />}
              <StatusPill label="2FA Active" color="#1B3A5C" border />
            </div>
          </div>

          {kycPending ? (
            <div style={{ background: '#FFFBEB', border: '1px solid #F59E0B', padding: '32px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <div style={{ width: '8px', flexShrink: 0, background: '#F59E0B', alignSelf: 'stretch' }} />
              <div>
                <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '18px', color: '#92400E', margin: '0 0 6px' }}>Verification in progress</p>
                <p style={{ fontSize: '14px', color: '#78350F', lineHeight: 1.65, margin: 0 }}>
                  Your identity verification is being reviewed. Deposit addresses will appear here once verification is complete. This usually takes within one business day.
                </p>
              </div>
            </div>
          ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Deposit addresses */}
            <div id="deposit" style={{ background: '#fff', border: '1px solid #DCE3EA', padding: '28px' }}>
              <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '18px', color: '#0F2338', margin: '0 0 4px' }}>Deposit address</h2>
              <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 20px' }}>Send only the matching asset to each address.</p>

              <div style={{ display: 'flex', gap: 0, marginBottom: '16px', border: '1px solid #DCE3EA' }}>
                {(['btc', 'usdt'] as const).map(t => (
                  <button key={t} onClick={() => setActiveTab(t)}
                    style={{ flex: 1, padding: '8px', background: activeTab === t ? '#1B3A5C' : '#fff', color: activeTab === t ? '#fff' : '#6B7280', border: 'none', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, fontSize: '13px', cursor: 'pointer', textTransform: 'uppercase', transition: 'background 0.12s, color 0.12s' }}>
                    {t}
                  </button>
                ))}
              </div>

              {activeTab === 'btc' ? (
                <AddressBlock addr={BTC_ADDR} network={BTC_NETWORK} onCopy={() => copy(BTC_ADDR, 'btc')} copied={copied === 'btc'} />
              ) : (
                <AddressBlock addr={USDT_ADDR} network={USDT_NETWORK} onCopy={() => copy(USDT_ADDR, 'usdt')} copied={copied === 'usdt'} />
              )}

              <div style={{ marginTop: '14px', background: '#FFF8E1', border: '1px solid #F59E0B', padding: '10px 14px' }}>
                <p style={{ fontSize: '12px', color: '#92400E', margin: 0, lineHeight: 1.5 }}>
                  <strong>Wrong network = permanent loss.</strong> Sending {activeTab === 'btc' ? 'USDT or any non-BTC asset' : 'BTC or non-ERC-20 USDT'} to this address will result in unrecoverable funds.
                </p>
              </div>
            </div>

            {/* Withdrawal */}
            <div id="withdraw" style={{ background: '#fff', border: '1px solid #DCE3EA', padding: '28px' }}>
              <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '18px', color: '#0F2338', margin: '0 0 4px' }}>Withdraw USD</h2>
              <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 20px' }}>To linked bank account (ACH). Free, 1–3 business days.</p>

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
                    <label style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4A7DA8', display: 'block', marginBottom: '6px' }}>Amount (USD)</label>
                    <div style={{ display: 'flex', border: '1px solid #DCE3EA', alignItems: 'center' }}>
                      <span style={{ padding: '0 12px', fontFamily: 'IBM Plex Mono, monospace', color: '#6B7280', fontSize: '16px' }}>$</span>
                      <input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} min="10" step="0.01"
                        style={{ flex: 1, border: 'none', padding: '11px 8px 11px 0', fontFamily: 'IBM Plex Mono, monospace', fontSize: '18px', fontWeight: 600, color: '#0F2338', background: 'transparent', outline: 'none' }}
                        aria-label="Withdrawal amount in USD" />
                    </div>
                    <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280', margin: '4px 0 0' }}>
                      Available: {fmtUSD(balanceTarget)}
                    </p>
                  </div>
                  {withdrawError && <p style={{ fontSize: '13px', color: '#DC2626', margin: 0, fontWeight: 500 }}>{withdrawError}</p>}
                  <div style={{ background: '#F4F6F8', border: '1px solid #DCE3EA', padding: '12px 14px' }}>
                    <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#374151', margin: 0 }}>
                      To: ••••• Bank ending 4821 (ACH)
                    </p>
                  </div>
                  <button type="submit" disabled={wLoading} style={{ background: '#1B3A5C', color: '#fff', border: 'none', padding: '12px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'background 0.15s', opacity: wLoading ? 0.6 : 1 }}>
                    {wLoading ? 'Submitting…' : 'Request withdrawal'}
                  </button>
                </form>
              )}
            </div>
          </div>
          )}

          {/* Transaction history */}
          <div id="history" style={{ background: '#fff', border: '1px solid #DCE3EA' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #DCE3EA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '18px', color: '#0F2338', margin: 0 }}>Transaction history</h2>
              <button style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#4A7DA8', background: 'none', border: '1px solid #DCE3EA', padding: '6px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 4h9M4 7h5M6 10h1" stroke="#4A7DA8" strokeWidth="1.2" strokeLinecap="square" /></svg>
                Download PDF
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              {txs.length === 0 ? (
                <div style={{ padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '16px', color: '#0F2338', margin: 0 }}>No activity yet</p>
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
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 500, color: tx.type === 'Deposit' ? '#1E7A4C' : '#1B3A5C' }}>
                          {tx.type === 'Deposit' ? '↓' : '↑'} {tx.type}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#374151' }}>{tx.asset}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#374151' }}>{tx.amount || '—'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#6B7280' }}>{tx.rate || '—'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#0F2338' }}>{tx.usd}</td>
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
    </>
  );
}

function AddressBlock({ addr, network, onCopy, copied }: { addr: string; network: string; onCopy: () => void; copied: boolean }) {
  return (
    <div>
      <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280', margin: '0 0 6px' }}>{network}</p>
      <div style={{ display: 'flex', border: '1px solid #DCE3EA', alignItems: 'center', gap: '0', background: '#F4F6F8' }}>
        <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#0F2338', padding: '10px 12px', margin: 0, flex: 1, wordBreak: 'break-all', lineHeight: 1.5 }}>{addr}</p>
        <button onClick={onCopy} aria-label="Copy address"
          style={{ padding: '10px 14px', background: copied ? '#1E7A4C' : '#1B3A5C', border: 'none', cursor: 'pointer', flexShrink: 0, transition: 'background 0.15s' }}>
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
    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600, color: '#fff', background: border ? 'transparent' : color, border: border ? '1px solid #4A7DA8' : 'none', padding: '3px 10px', letterSpacing: '0.04em' }}>
      {label}
    </span>
  );
}
