import { Link } from 'react-router';

export default function BusinessBanking() {
  return (
    <>
      <title>Business Banking — Shield Safe Bank</title>
      <meta name="description" content="Shield Safe Bank business accounts. Lower conversion fees, multiple authorized users, wire transfers, and business-grade statements." />

      <section style={{ background: '#12283F', padding: '72px 0 56px' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4A7DA8', marginBottom: '16px' }}>Business</p>
          <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: 'clamp(32px, 4vw, 52px)', color: '#fff', margin: '0 0 16px', letterSpacing: '-0.02em' }}>Banking for businesses</h1>
          <p style={{ fontSize: '17px', color: '#A8C4DA', maxWidth: '480px', lineHeight: 1.65, margin: '0 0 32px' }}>
            Lower fees, multiple authorized users, and the same simple crypto-to-dollar conversion your team can rely on.
          </p>
          <Link to="/signup?type=business" style={{ display: 'inline-block', background: '#4A7DA8', color: '#fff', textDecoration: 'none', padding: '12px 28px', fontWeight: 600, fontSize: '15px' }}>Open business account</Link>
        </div>
      </section>

      <section style={{ padding: '72px 0', background: '#fff', borderBottom: '1px solid #DCE3EA' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-16">
            <div>
              <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '28px', color: '#0F2338', marginBottom: '24px' }}>Lower fees for higher volume</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', border: '1px solid #DCE3EA' }}>
                {[
                  ['BTC conversion', '0.40%'],
                  ['USDT conversion', '0.25%'],
                  ['ACH withdrawal', '$0.00'],
                  ['Wire withdrawal', '$15.00'],
                  ['Additional users', '$0.00'],
                ].map(([l, v], i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 18px', borderBottom: i < 4 ? '1px solid #DCE3EA' : 'none' }}>
                    <span style={{ color: '#6B7280' }}>{l}</span>
                    <span style={{ fontWeight: 600, color: '#0F2338' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '28px', color: '#0F2338', marginBottom: '24px' }}>Business features</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {[
                  ['Multiple authorized users', 'Add team members with access controls. Each requires individual identity verification.'],
                  ['Entity-level KYC', 'We verify the entity plus every beneficial owner above 25% and each authorized user.'],
                  ['Business statements', 'Business-format monthly statements. PDF and CSV export.'],
                  ['Higher withdrawal limits', 'Business accounts have higher default daily withdrawal limits. Larger volumes available with prior notice.'],
                ].map(([t, b], i) => (
                  <div key={i} style={{ paddingBottom: '20px', borderBottom: i < 3 ? '1px solid #DCE3EA' : 'none' }}>
                    <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '15px', color: '#0F2338', margin: '0 0 6px' }}>{t}</p>
                    <p style={{ fontSize: '14px', color: '#4A5568', lineHeight: 1.65, margin: 0 }}>{b}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: '56px 0', background: '#F4F6F8', borderBottom: '1px solid #DCE3EA' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '22px', color: '#0F2338', marginBottom: '20px' }}>What we need to open a business account</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px', color: '#374151', lineHeight: 1.65 }}>
            <p style={{ margin: 0 }}>Articles of incorporation or equivalent formation document</p>
            <p style={{ margin: 0 }}>Business address and registered jurisdiction</p>
            <p style={{ margin: 0 }}>Government-issued ID and liveness check for each authorized user and beneficial owner above 25%</p>
            <p style={{ margin: 0 }}>US business bank account for withdrawals</p>
          </div>
        </div>
      </section>

      <section style={{ padding: '64px 0', background: '#1B3A5C' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row gap-8 items-center justify-between">
          <div>
            <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '26px', color: '#fff', margin: '0 0 8px' }}>Start your business account</h2>
            <p style={{ color: '#A8C4DA', margin: 0, fontSize: '15px' }}>Business verification takes 1–2 business days.</p>
          </div>
          <Link to="/signup?type=business" style={{ background: '#4A7DA8', color: '#fff', padding: '13px 32px', textDecoration: 'none', fontWeight: 600, fontSize: '15px', flexShrink: 0 }}>Open business account</Link>
        </div>
      </section>
    </>
  );
}
