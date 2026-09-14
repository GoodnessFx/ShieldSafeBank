export default function About() {
  return (
    <>
      <title>About — Shield Safe Bank</title>
      <meta name="description" content="The founding story behind Shield Safe Bank. A simple product built by people who have moved money before." />

      <section style={{ background: '#F4F6F8', borderBottom: '1px solid #DCE3EA', padding: '56px 0 48px' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4A7DA8', marginBottom: '16px' }}>Company</p>
          <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: 'clamp(32px, 4vw, 52px)', color: '#0F2338', margin: 0, letterSpacing: '-0.02em' }}>About</h1>
        </div>
      </section>

      <section style={{ padding: '72px 0', background: '#fff' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', fontSize: '16px', color: '#374151', lineHeight: 1.8 }}>
            <p>
              Shield Safe Bank was built by three people who spent a combined decade working inside wire-transfer operations and digital asset custody at financial institutions. We have watched crypto users lose money because the on-ramp to the banking system is broken — slow ACH holds, unexpected conversion markups, platforms that disappear.
            </p>
            <p>
              We decided the right answer was narrow scope, not wide scope. Banks that try to do everything do nothing particularly well. We do one thing: we take your crypto, convert it to dollars at the market rate the moment your transaction confirms, and hold those dollars until you want them in your bank account.
            </p>
            <p>
              The rate you see in the conversion ledger is the rate we use. There is no spread on top of it. There is a fee, and the fee is on the fee page. That is the whole pricing model.
            </p>
            <p>
              Cold storage for the majority of funds was not optional for us. Neither were segregated reserve accounts. These are baseline expectations, not differentiators. We mention them because some of our competitors do not do them, not because we expect credit for it.
            </p>
            <p>
              The platform is currently in development and investor review. Taking real customer deposits requires operating licenses and regulatory approvals that are a separate step from the build itself. We are pursuing that path in parallel.
            </p>
          </div>

          <div className="about-team" style={{ marginTop: '56px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', background: '#DCE3EA' }}>
            {[
              { name: 'Marcus Webb', role: 'Co-founder, Operations' },
              { name: 'Priya Nair', role: 'Co-founder, Engineering' },
              { name: 'Daniel Osei', role: 'Co-founder, Compliance' },
            ].map((p, i) => (
              <div key={i} style={{ background: '#F4F6F8', padding: '28px' }}>
                <div style={{ width: '44px', height: '44px', background: '#1B3A5C', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '16px' }}>{p.name[0]}</span>
                </div>
                <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '15px', color: '#0F2338', margin: '0 0 4px' }}>{p.name}</p>
                <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>{p.role}</p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '56px', borderTop: '1px solid #DCE3EA', paddingTop: '40px' }}>
            <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '22px', color: '#0F2338', marginBottom: '16px' }}>Contact</h2>
            <p style={{ fontSize: '15px', color: '#374151', lineHeight: 1.7, margin: '0 0 12px' }}>
              General inquiries: hello@shieldsafebank.com<br />
              Support: support@shieldsafebank.com<br />
              Security issues: security@shieldsafebank.com
            </p>
            <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>
              We respond to all emails within one business day.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
