import { Link } from 'react-router';
import ConversionLedger from '../components/ConversionLedger';
import ForeignExchange from '../components/ForeignExchange';

export default function Home() {
  return (
    <>
      {/* SEO */}
      <title>Shield Safe Bank | Personal and Business Banking</title>
      <meta name="description" content="Shield Safe Bank is a full-service bank offering checking accounts, business banking, and a debit card, plus crypto services so you can convert BTC and USDT to your USD balance." />

      {/* Hero */}
      <section style={{ background: '#0B2B5C', padding: 0, overflow: 'hidden' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4779C4', marginBottom: '20px' }}>
              Personal & business banking
            </p>
            <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: 'clamp(36px, 5vw, 60px)', lineHeight: 1.06, color: '#fff', margin: '0 0 24px', letterSpacing: '-0.02em' }}>
              Banking built for<br />how you actually live.
            </h1>
            <p style={{ fontSize: '17px', color: '#A9C6E8', lineHeight: 1.65, maxWidth: '420px', margin: '0 0 36px' }}>
              Open a Shield Safe Bank account for everyday banking: a USD balance, a debit card, and free withdrawals to your bank. Crypto conversion is available as an optional service if you want to fund your account with BTC or USDT.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Link to="/signup" className="btn-primary" style={{ fontSize: '15px', padding: '12px 28px', background: '#4779C4' }}>Open Account</Link>
              <Link to="/how-it-works" style={{ fontSize: '15px', fontWeight: 500, color: '#A9C6E8', textDecoration: 'none', padding: '12px 0', borderBottom: '1px solid #4779C4' }}>See how it works</Link>
            </div>
            <div style={{ marginTop: '36px', display: 'flex', gap: '28px', flexWrap: 'wrap' }}>
              <Stat label="Accounts" value="Personal, Business" />
              <Stat label="Card" value="Shield Safe Debit" />
              <Stat label="Crypto service" value="BTC, USDT" />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <ConversionLedger />
          </div>
        </div>
      </section>

      {/* Notice bar */}
      <div style={{ background: '#123C7C', padding: '10px 24px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '13px', color: '#A9C6E8', fontFamily: 'IBM Plex Mono, monospace' }}>
          Accounts, debit cards, and transfers to your bank. Crypto conversion is available as an optional service.
        </p>
      </div>

      {/* Foreign currency exchange */}
      <section style={{ background: '#F4F6F8', padding: '64px 0' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 'clamp(24px, 3.5vw, 34px)', color: '#0A2044', marginBottom: '12px', letterSpacing: '-0.02em' }}>
            Foreign currency exchange
          </h2>
          <p style={{ fontSize: '16px', color: '#4A5568', lineHeight: 1.65, maxWidth: '520px', marginBottom: '32px' }}>
            Check indicative rates for major currencies alongside your BTC and USDT conversions, all in one place.
          </p>
          <ForeignExchange />
        </div>
      </section>

      {/* How it works */}
      <section style={{ background: '#fff', padding: '80px 0' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 'clamp(26px, 3.5vw, 38px)', color: '#0A2044', marginBottom: '12px', letterSpacing: '-0.02em' }}>
            Three steps. That is the whole process.
          </h2>
          <p style={{ fontSize: '16px', color: '#4A5568', lineHeight: 1.65, maxWidth: '480px', marginBottom: '56px' }}>
            Open an account. Hold a dollar balance. Withdraw whenever you want, and add funds from crypto if you choose.
          </p>
          <div className="no-col-border" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 0, border: '1px solid #DCE3EA' }}>
            {[
              { n: '01', heading: 'Open your account', body: "Apply in about ten minutes. You get a USD balance, a Shield Safe Bank debit card, and free ACH withdrawals to your bank." },
              { n: '02', heading: 'Add funds', body: "Hold your dollars like any bank account. Optionally send BTC or USDT to your deposit address, and the rate locks the moment the chain confirms." },
              { n: '03', heading: 'Withdraw whenever', body: "Withdraw to a linked bank account via ACH or wire, or spend with your debit card. No minimum hold period." },
            ].map((step, i) => (
              <div key={i} style={{ padding: '36px 32px', borderRight: i < 2 ? '1px solid #DCE3EA' : 'none', borderBottom: 0 }} className="step-card">
                <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, fontSize: '13px', color: '#4779C4', marginBottom: '16px' }}>{step.n}</p>
                <h3 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '20px', color: '#0A2044', marginBottom: '12px' }}>{step.heading}</h3>
                <p style={{ fontSize: '15px', color: '#4A5568', lineHeight: 1.65, margin: 0 }}>{step.body}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '28px' }}>
            <Link to="/how-it-works" style={{ fontSize: '14px', color: '#123C7C', textDecoration: 'none', fontWeight: 500, borderBottom: '1px solid #DCE3EA', paddingBottom: '2px' }}>Full walkthrough with a worked example</Link>
          </div>
        </div>
      </section>

      {/* Why us */}
      <section style={{ background: '#F4F6F8', padding: '80px 0', borderTop: '1px solid #DCE3EA', borderBottom: '1px solid #DCE3EA' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 'clamp(26px, 3.5vw, 38px)', color: '#0A2044', marginBottom: '16px', letterSpacing: '-0.02em' }}>
                A bank account, not a trading desk.
              </h2>
              <p style={{ fontSize: '16px', color: '#4A5568', lineHeight: 1.7, maxWidth: '460px' }}>
                Your account comes first: a USD balance, a debit card, and withdrawals to your bank. Crypto conversion is an optional service. We do not offer crypto trading, lending, yield, or a token.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {[
                { icon: 'rate', heading: 'Rate locked at confirmation', body: "Your USD balance reflects the rate when the chain confirmed. Market moves after that are not your problem." },
                { icon: 'statement', heading: 'Statements and history', body: "Full transaction history, downloadable statements. Every conversion shows the rate, timestamp, and fee." },
                { icon: 'both', heading: 'Personal and business accounts', body: "Separate account types with separate verification and feature sets. Business accounts support multiple authorized users." },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '16px', paddingBottom: '24px', borderBottom: i < 2 ? '1px solid #DCE3EA' : 'none' }}>
                  <div style={{ width: '40px', height: '40px', background: '#123C7C', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <LineIcon type={item.icon} />
                  </div>
                  <div>
                    <h3 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '16px', color: '#0A2044', marginBottom: '6px' }}>{item.heading}</h3>
                    <p style={{ fontSize: '14px', color: '#4A5568', lineHeight: 1.65, margin: 0 }}>{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Security snapshot */}
      <section style={{ background: '#fff', padding: '80px 0', borderBottom: '1px solid #DCE3EA' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-3 gap-0 no-col-border" style={{ border: '1px solid #DCE3EA' }}>
            {[
              { heading: 'Cold storage majority', body: "The majority of customer funds are held in cold storage, air-gapped from any network." },
              { heading: 'On-chain monitoring', body: "Every account's deposit address is monitored per-transaction. Anomalies trigger an automatic review hold." },
              { heading: 'Segregated reserves', body: "Customer USD balances are held in segregated reserve accounts, separate from operating funds." },
            ].map((item, i) => (
              <div key={i} style={{ padding: '32px', borderRight: i < 2 ? '1px solid #DCE3EA' : 'none' }}>
                <div style={{ width: '6px', height: '6px', background: '#1E7A4C', marginBottom: '16px' }} />
                <h3 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '17px', color: '#0A2044', marginBottom: '8px' }}>{item.heading}</h3>
                <p style={{ fontSize: '14px', color: '#4A5568', lineHeight: 1.65, margin: 0 }}>{item.body}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '24px' }}>
            <Link to="/security" style={{ fontSize: '14px', color: '#123C7C', textDecoration: 'none', fontWeight: 500, borderBottom: '1px solid #DCE3EA', paddingBottom: '2px' }}>Full security model</Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: '#123C7C', padding: '80px 0' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row gap-10 items-center justify-between">
          <div>
            <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 'clamp(24px, 3vw, 36px)', color: '#fff', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
              Open an account today.
            </h2>
            <p style={{ fontSize: '16px', color: '#A9C6E8', margin: 0 }}>
              Verification takes about ten minutes. No credit check.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexShrink: 0, flexWrap: 'wrap' }}>
            <Link to="/signup?type=personal" style={{ fontSize: '15px', fontWeight: 600, padding: '13px 28px', background: '#4779C4', color: '#fff', textDecoration: 'none', transition: 'background 0.15s' }}
              onMouseEnter={e => { (e.target as HTMLElement).style.background = '#3A66AD'; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = '#4779C4'; }}>
              Personal Account
            </Link>
            <Link to="/signup?type=business" style={{ fontSize: '15px', fontWeight: 600, padding: '13px 28px', border: '1px solid #4779C4', color: '#A9C6E8', textDecoration: 'none', transition: 'color 0.15s, border-color 0.15s' }}
              onMouseEnter={e => { const el = e.target as HTMLElement; el.style.color = '#fff'; el.style.borderColor = '#fff'; }}
              onMouseLeave={e => { const el = e.target as HTMLElement; el.style.color = '#A9C6E8'; el.style.borderColor = '#4779C4'; }}>
              Business Account
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#4779C4', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</p>
      <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, fontSize: '14px', color: '#fff', margin: 0 }}>{value}</p>
    </div>
  );
}

function LineIcon({ type }: { type: string }) {
  if (type === 'rate') return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M2 14L6 9L9 12L13 6L16 9" stroke="#fff" strokeWidth="1.5" strokeLinecap="square" />
      <path d="M14 4h2v2" stroke="#fff" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
  if (type === 'statement') return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="3" y="2" width="12" height="14" rx="0" stroke="#fff" strokeWidth="1.5" />
      <line x1="6" y1="6" x2="12" y2="6" stroke="#fff" strokeWidth="1.2" />
      <line x1="6" y1="9" x2="12" y2="9" stroke="#fff" strokeWidth="1.2" />
      <line x1="6" y1="12" x2="10" y2="12" stroke="#fff" strokeWidth="1.2" />
    </svg>
  );
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="7" stroke="#fff" strokeWidth="1.5" />
      <path d="M6 9l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}
