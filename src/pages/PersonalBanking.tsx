import { Link } from 'react-router';

export default function PersonalBanking() {
  return (
    <>
      <title>Personal Banking | Shield Safe Bank</title>
      <meta name="description" content="Shield Safe Bank personal accounts. A USD balance, a debit card, free ACH withdrawals, and optional BTC or USDT conversion when you want to top up from crypto." />

      <section style={{ background: '#123C7C', padding: '72px 0 56px' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4779C4', marginBottom: '16px' }}>Personal</p>
          <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: 'clamp(32px, 4vw, 52px)', color: '#fff', margin: '0 0 16px', letterSpacing: '-0.02em' }}>Banking for individuals</h1>
          <p style={{ fontSize: '17px', color: '#A9C6E8', maxWidth: '480px', lineHeight: 1.65, margin: '0 0 32px' }}>
            A USD balance, a debit card, and free ACH withdrawals. Add BTC or USDT conversion when you want to top up your account from crypto.
          </p>
          <Link to="/signup?type=personal" style={{ display: 'inline-block', background: '#4779C4', color: '#fff', textDecoration: 'none', padding: '12px 28px', fontWeight: 600, fontSize: '15px', transition: 'background 0.15s' }}>Open personal account</Link>
        </div>
      </section>

      <section style={{ padding: '72px 0', background: '#fff', borderBottom: '1px solid #DCE3EA' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '28px', color: '#0A2044', marginBottom: '40px', letterSpacing: '-0.01em' }}>What you get</h2>
          <div className="grid md:grid-cols-2 gap-0 no-col-border" style={{ border: '1px solid #DCE3EA' }}>
            {[
              { title: 'USD balance', body: 'Your account balance in US dollars. Protected from market movement after the conversion rate locks.' },
              { title: 'Debit card', body: 'A Shield Safe Bank debit card for spending and instant withdrawal to a supported Visa or Mastercard debit. 1.50% fee, min $2.00.' },
              { title: 'ACH withdrawal', body: 'Link your US bank account. Withdraw free via ACH in one to three business days.' },
              { title: 'Wire withdrawal', body: 'Same-day wire if submitted before 2pm EST. $18.00 flat fee.' },
              { title: 'Transaction history', body: 'Full record of every deposit and withdrawal with timestamps, rates, and fees.' },
              { title: 'Downloadable statements', body: 'Monthly PDF statements. Print-friendly layout. Available from day one.' },
              { title: 'BTC deposit address', body: 'Optional crypto service. A permanent Bitcoin deposit address. Send from any wallet or exchange. 3-confirmation requirement.' },
              { title: 'USDT deposit address', body: 'Optional crypto service. One address for ERC-20 or TRC-20 USDT (selected during setup). Cannot be changed after account opening.' },
            ].map((item, i) => (
              <div key={i} style={{ padding: '28px 32px', borderRight: i % 2 === 0 ? '1px solid #DCE3EA' : 'none', borderBottom: i < 6 ? '1px solid #DCE3EA' : 'none' }}>
                <h3 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '16px', color: '#0A2044', marginBottom: '8px' }}>{item.title}</h3>
                <p style={{ fontSize: '14px', color: '#4A5568', lineHeight: 1.65, margin: 0 }}>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '64px 0', background: '#F4F6F8', borderBottom: '1px solid #DCE3EA' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '24px', color: '#0A2044', marginBottom: '32px' }}>What is required to open an account</h2>
          <div className="grid md:grid-cols-3 gap-0 no-col-border" style={{ border: '1px solid #DCE3EA', background: '#fff' }}>
            {[
              ['Government-issued ID', 'Passport, national ID, or driver\'s license. Must be valid.'],
              ['Liveness check', 'A brief video selfie matched against your ID. Takes about 90 seconds.'],
              ['US bank account or debit card', 'Required to withdraw. Can be added after verification.'],
            ].map(([t, b], i) => (
              <div key={i} style={{ padding: '28px', borderRight: i < 2 ? '1px solid #DCE3EA' : 'none' }}>
                <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '15px', color: '#0A2044', margin: '0 0 8px' }}>{t}</p>
                <p style={{ fontSize: '14px', color: '#4A5568', lineHeight: 1.65, margin: 0 }}>{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '64px 0', background: '#123C7C' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row gap-8 items-center justify-between">
          <div>
            <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '26px', color: '#fff', margin: '0 0 8px' }}>Ready to start?</h2>
            <p style={{ color: '#A9C6E8', margin: 0, fontSize: '15px' }}>Verification takes about ten minutes.</p>
          </div>
          <Link to="/signup?type=personal" style={{ background: '#4779C4', color: '#fff', padding: '13px 32px', textDecoration: 'none', fontWeight: 600, fontSize: '15px', flexShrink: 0 }}>Open personal account</Link>
        </div>
      </section>
    </>
  );
}
