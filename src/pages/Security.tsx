export default function Security() {
  return (
    <>
      <title>Security — Shield Safe Bank</title>
      <meta name="description" content="Shield Safe Bank's custody model, cold storage, on-chain monitoring, 2FA, and audit practices." />

      <section style={{ background: '#12283F', padding: '56px 0 48px' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4A7DA8', marginBottom: '16px' }}>Security</p>
          <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: 'clamp(32px, 4vw, 52px)', color: '#fff', margin: '0 0 16px', letterSpacing: '-0.02em' }}>How we protect your funds</h1>
          <p style={{ fontSize: '17px', color: '#A8C4DA', maxWidth: '520px', lineHeight: 1.65, margin: 0 }}>
            Security is not a feature list. The choices below reflect how we actually hold and move money.
          </p>
        </div>
      </section>

      <section style={{ padding: '72px 0', background: '#fff', borderBottom: '1px solid #DCE3EA' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex flex-col gap-14">
          <SecuritySection title="Custody model">
            <p>The majority of customer crypto is held in cold storage. Cold storage hardware is air-gapped, never connected to any network. The minority held in hot wallets is sized to cover expected withdrawal volume for a rolling 48-hour window.</p>
            <p>Customer USD balances are held in segregated reserve accounts at partner institutions, separated from Shield Safe Bank operating funds. We do not lend, invest, or stake customer balances.</p>
          </SecuritySection>

          <SecuritySection title="On-chain monitoring">
            <p>Every deposit address is monitored individually from the block it was generated. We watch for anomalous transaction patterns, unauthorized internal transfers, and contract interactions (for USDT). Any anomaly triggers an automatic hold on the affected account pending review.</p>
          </SecuritySection>

          <SecuritySection title="Two-factor authentication">
            <p>2FA is required on all accounts. We support authenticator app codes (TOTP). SMS is not offered as a 2FA method. If you lose access to your authenticator, account recovery requires identity re-verification with a live ID check.</p>
            <p>Withdrawal actions require a secondary 2FA confirmation separate from login.</p>
          </SecuritySection>

          <SecuritySection title="Withdrawal review">
            <p>Withdrawals above $50,000 are queued for a manual review step before release. Review typically completes within two hours during business hours. Accounts with new payment methods on file have a 24-hour cooling period before withdrawals to that method are processed.</p>
          </SecuritySection>

          <SecuritySection title="Independent audits">
            <p>Our custody practices and reserve accounts are subject to annual independent audits. Audit reports are available to account holders on request. We do not publish attestation certificates based on self-reported figures.</p>
          </SecuritySection>

          <SecuritySection title="KYC and AML">
            <p>Every account holder completes full identity verification before receiving a deposit address. Ongoing transaction monitoring screens for patterns associated with sanctions, structuring, and high-risk jurisdiction exposure. Suspicious activity is reported as required under applicable law.</p>
          </SecuritySection>

          <div style={{ background: '#F4F6F8', border: '1px solid #DCE3EA', padding: '28px' }}>
            <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '16px', color: '#0F2338', marginBottom: '10px' }}>Report a security issue</p>
            <p style={{ fontSize: '14px', color: '#4A5568', lineHeight: 1.65, margin: '0 0 12px' }}>
              If you believe you have found a security vulnerability, contact us at security@shieldsafebank.com. We respond to all reports within one business day.
            </p>
            <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: '#4A7DA8', margin: 0 }}>security@shieldsafebank.com</p>
          </div>
        </div>
      </section>
    </>
  );
}

function SecuritySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '32px' }}>
      <div style={{ width: '6px', flexShrink: 0, background: '#1B3A5C', alignSelf: 'stretch', maxHeight: '100%' }} />
      <div>
        <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '22px', color: '#0F2338', marginBottom: '16px', letterSpacing: '-0.01em' }}>{title}</h2>
        <div style={{ fontSize: '15px', color: '#374151', lineHeight: 1.75, display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '68ch' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
