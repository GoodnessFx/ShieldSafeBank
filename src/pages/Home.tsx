import { Link } from 'react-router';
import ConversionLedger from '../components/ConversionLedger';

export default function Home() {
  return (
    <>
      {/* SEO */}
      <title>Shield Safe Bank — Send crypto. Bank in dollars.</title>
      <meta name="description" content="Convert Bitcoin and USDT to a US dollar balance. Withdraw to your bank account or debit card whenever you want. No fiat deposits. No crypto withdrawals." />

      {/* Hero */}
      <section style={{ background: '#12283F', padding: 0, overflow: 'hidden' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4A7DA8', marginBottom: '20px' }}>
              Crypto-to-fiat banking
            </p>
            <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: 'clamp(36px, 5vw, 60px)', lineHeight: 1.06, color: '#fff', margin: '0 0 24px', letterSpacing: '-0.02em' }}>
              Send crypto.<br />Bank in dollars.
            </h1>
            <p style={{ fontSize: '17px', color: '#A8C4DA', lineHeight: 1.65, maxWidth: '420px', margin: '0 0 36px' }}>
              Deposit BTC or USDT. We convert it to USD at the rate locked at confirmation. Your balance sits like a normal bank account. Withdraw to your bank whenever you want.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Link to="/signup" className="btn-primary" style={{ fontSize: '15px', padding: '12px 28px', background: '#4A7DA8' }}>Open Account</Link>
              <Link to="/how-it-works" style={{ fontSize: '15px', fontWeight: 500, color: '#A8C4DA', textDecoration: 'none', padding: '12px 0', borderBottom: '1px solid #4A7DA8' }}>See how it works</Link>
            </div>
            <div style={{ marginTop: '36px', display: 'flex', gap: '28px', flexWrap: 'wrap' }}>
              <Stat label="Deposits" value="BTC, USDT" />
              <Stat label="Withdrawals" value="USD only" />
              <Stat label="Networks" value="ERC-20, TRC-20" />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <ConversionLedger />
          </div>
        </div>
      </section>

      {/* Notice bar */}
      <div style={{ background: '#1B3A5C', padding: '10px 24px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '13px', color: '#A8C4DA', fontFamily: 'IBM Plex Mono, monospace' }}>
          No fiat deposits. No crypto withdrawals. Crypto in, dollars out.
        </p>
      </div>

      {/* How it works */}
      <section style={{ background: '#fff', padding: '80px 0' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 'clamp(26px, 3.5vw, 38px)', color: '#0F2338', marginBottom: '12px', letterSpacing: '-0.02em' }}>
            Three steps. That is the whole process.
          </h2>
          <p style={{ fontSize: '16px', color: '#4A5568', lineHeight: 1.65, maxWidth: '480px', marginBottom: '56px' }}>
            No wire transfers in. No buying crypto from us. You already have crypto. We hold your dollars.
          </p>
          <div className="no-col-border" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 0, border: '1px solid #DCE3EA' }}>
            {[
              { n: '01', heading: 'Deposit crypto', body: "Send BTC or USDT to your unique deposit address. The address is permanent. One address per asset per account." },
              { n: '02', heading: 'Confirmation converts', body: "Once your transaction confirms on-chain, we lock the exchange rate at that moment and credit your USD balance. Not at withdrawal time." },
              { n: '03', heading: 'Withdraw whenever', body: "Your balance sits in USD. Withdraw to a linked bank account via ACH or wire, or to a debit card. No minimum hold period." },
            ].map((step, i) => (
              <div key={i} style={{ padding: '36px 32px', borderRight: i < 2 ? '1px solid #DCE3EA' : 'none', borderBottom: 0 }} className="step-card">
                <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, fontSize: '13px', color: '#4A7DA8', marginBottom: '16px' }}>{step.n}</p>
                <h3 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '20px', color: '#0F2338', marginBottom: '12px' }}>{step.heading}</h3>
                <p style={{ fontSize: '15px', color: '#4A5568', lineHeight: 1.65, margin: 0 }}>{step.body}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '28px' }}>
            <Link to="/how-it-works" style={{ fontSize: '14px', color: '#1B3A5C', textDecoration: 'none', fontWeight: 500, borderBottom: '1px solid #DCE3EA', paddingBottom: '2px' }}>Full walkthrough with a worked example</Link>
          </div>
        </div>
      </section>

      {/* Why us */}
      <section style={{ background: '#F4F6F8', padding: '80px 0', borderTop: '1px solid #DCE3EA', borderBottom: '1px solid #DCE3EA' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 'clamp(26px, 3.5vw, 38px)', color: '#0F2338', marginBottom: '16px', letterSpacing: '-0.02em' }}>
                One product, done right.
              </h2>
              <p style={{ fontSize: '16px', color: '#4A5568', lineHeight: 1.7, maxWidth: '460px' }}>
                We do not offer crypto trading, lending, yield, or a token. The only thing we do is convert crypto to dollars and hold the dollars until you withdraw them.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {[
                { icon: 'rate', heading: 'Rate locked at confirmation', body: "Your USD balance reflects the rate when the chain confirmed. Market moves after that are not your problem." },
                { icon: 'statement', heading: 'Statements and history', body: "Full transaction history, downloadable statements. Every conversion shows the rate, timestamp, and fee." },
                { icon: 'both', heading: 'Personal and business accounts', body: "Separate account types with separate verification and feature sets. Business accounts support multiple authorized users." },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '16px', paddingBottom: '24px', borderBottom: i < 2 ? '1px solid #DCE3EA' : 'none' }}>
                  <div style={{ width: '40px', height: '40px', background: '#1B3A5C', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <LineIcon type={item.icon} />
                  </div>
                  <div>
                    <h3 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '16px', color: '#0F2338', marginBottom: '6px' }}>{item.heading}</h3>
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
                <h3 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '17px', color: '#0F2338', marginBottom: '8px' }}>{item.heading}</h3>
                <p style={{ fontSize: '14px', color: '#4A5568', lineHeight: 1.65, margin: 0 }}>{item.body}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '24px' }}>
            <Link to="/security" style={{ fontSize: '14px', color: '#1B3A5C', textDecoration: 'none', fontWeight: 500, borderBottom: '1px solid #DCE3EA', paddingBottom: '2px' }}>Full security model</Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: '#1B3A5C', padding: '80px 0' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row gap-10 items-center justify-between">
          <div>
            <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 'clamp(24px, 3vw, 36px)', color: '#fff', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
              Open an account today.
            </h2>
            <p style={{ fontSize: '16px', color: '#A8C4DA', margin: 0 }}>
              Verification takes about ten minutes. No credit check.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexShrink: 0, flexWrap: 'wrap' }}>
            <Link to="/signup?type=personal" style={{ fontSize: '15px', fontWeight: 600, padding: '13px 28px', background: '#4A7DA8', color: '#fff', textDecoration: 'none', transition: 'background 0.15s' }}
              onMouseEnter={e => { (e.target as HTMLElement).style.background = '#3d6d96'; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = '#4A7DA8'; }}>
              Personal Account
            </Link>
            <Link to="/signup?type=business" style={{ fontSize: '15px', fontWeight: 600, padding: '13px 28px', border: '1px solid #4A7DA8', color: '#A8C4DA', textDecoration: 'none', transition: 'color 0.15s, border-color 0.15s' }}
              onMouseEnter={e => { const el = e.target as HTMLElement; el.style.color = '#fff'; el.style.borderColor = '#fff'; }}
              onMouseLeave={e => { const el = e.target as HTMLElement; el.style.color = '#A8C4DA'; el.style.borderColor = '#4A7DA8'; }}>
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
      <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#4A7DA8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</p>
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
