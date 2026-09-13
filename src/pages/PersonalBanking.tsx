import { Link } from 'react-router';

export default function PersonalBanking() {
  return (
    <>
      <title>Personal Banking — Shield Safe Bank</title>
      <meta name="description" content="Shield Safe Bank personal accounts. Convert your BTC or USDT to a dollar balance and withdraw to your bank account or debit card." />

      <section style={{ background: '#1B3A5C', padding: '72px 0 56px' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4A7DA8', marginBottom: '16px' }}>Personal</p>
          <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: 'clamp(32px, 4vw, 52px)', color: '#fff', margin: '0 0 16px', letterSpacing: '-0.02em' }}>Banking for individuals</h1>
          <p style={{ fontSize: '17px', color: '#A8C4DA', maxWidth: '480px', lineHeight: 1.65, margin: '0 0 32px' }}>
            Convert your crypto to dollars. One deposit address per asset. Withdraw whenever you need the cash.
          </p>
          <Link to="/signup?type=personal" style={{ display: 'inline-block', background: '#4A7DA8', color: '#fff', textDecoration: 'none', padding: '12px 28px', fontWeight: 600, fontSize: '15px', transition: 'background 0.15s' }}>Open personal account</Link>
        </div>
      </section>

      <section style={{ padding: '72px 0', background: '#fff', borderBottom: '1px solid #DCE3EA' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '28px', color: '#0F2338', marginBottom: '40px', letterSpacing: '-0.01em' }}>What you get</h2>
          <div className="grid md:grid-cols-2 gap-0" style={{ border: '1px solid #DCE3EA' }}>
            {[
              { title: 'BTC deposit address', body: 'A permanent Bitcoin deposit address. Send from any wallet or exchange. 3-confirmation requirement.' },
              { title: 'USDT deposit address', body: 'One address for ERC-20 or TRC-20 USDT (selected during setup). Cannot be changed after account opening.' },
              { title: 'USD balance', body: 'Your converted balance in US dollars. Protected from market movement after the conversion rate locks.' },
              { title: 'ACH withdrawal', body: 'Link your US bank account. Withdraw free via ACH in 1–3 business days.' },
              { title: 'Wire withdrawal', body: 'Same-day wire if submitted before 2pm EST. $18.00 flat fee.' },
              { title: 'Debit card withdrawal', body: 'Instant withdrawal to a supported Visa or Mastercard debit. 1.50% fee, min $2.00.' },
              { title: 'Transaction history', body: 'Full record of every deposit and withdrawal with timestamps, rates, and fees.' },
              { title: 'Downloadable statements', body: 'Monthly PDF statements. Print-friendly layout. Available from day one.' },
            ].map((item, i) => (
              <div key={i} style={{ padding: '28px 32px', borderRight: i % 2 === 0 ? '1px solid #DCE3EA' : 'none', borderBottom: i < 6 ? '1px solid #DCE3EA' : 'none' }}>
                <h3 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '16px', color: '#0F2338', marginBottom: '8px' }}>{item.title}</h3>
                <p style={{ fontSize: '14px', color: '#4A5568', lineHeight: 1.65, margin: 0 }}>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '64px 0', background: '#F4F6F8', borderBottom: '1px solid #DCE3EA' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '24px', color: '#0F2338', marginBottom: '32px' }}>What is required to open an account</h2>
          <div className="grid md:grid-cols-3 gap-0" style={{ border: '1px solid #DCE3EA', background: '#fff' }}>
            {[
              ['Government-issued ID', 'Passport, national ID, or driver\'s license. Must be valid.'],
              ['Liveness check', 'A brief video selfie matched against your ID. Takes about 90 seconds.'],
              ['US bank account or debit card', 'Required to withdraw. Can be added after verification.'],
            ].map(([t, b], i) => (
              <div key={i} style={{ padding: '28px', borderRight: i < 2 ? '1px solid #DCE3EA' : 'none' }}>
                <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '15px', color: '#0F2338', margin: '0 0 8px' }}>{t}</p>
                <p style={{ fontSize: '14px', color: '#4A5568', lineHeight: 1.65, margin: 0 }}>{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '64px 0', background: '#1B3A5C' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row gap-8 items-center justify-between">
          <div>
            <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '26px', color: '#fff', margin: '0 0 8px' }}>Ready to start?</h2>
            <p style={{ color: '#A8C4DA', margin: 0, fontSize: '15px' }}>Verification takes about ten minutes.</p>
          </div>
          <Link to="/signup?type=personal" style={{ background: '#4A7DA8', color: '#fff', padding: '13px 32px', textDecoration: 'none', fontWeight: 600, fontSize: '15px', flexShrink: 0 }}>Open personal account</Link>
        </div>
      </section>
    </>
  );
}
