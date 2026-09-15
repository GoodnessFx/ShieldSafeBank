import { useSearchParams } from 'react-router';

const sections = ['terms', 'privacy', 'aml'] as const;
const titles: Record<string, string> = { terms: 'Terms of Service', privacy: 'Privacy Policy', aml: 'AML / KYC Policy' };

export default function Legal() {
  const [params, setParams] = useSearchParams();
  const section = (params.get('section') as typeof sections[number]) || 'terms';

  return (
    <>
      <title>{titles[section]} | Shield Safe Bank</title>
      <meta name="description" content={`Shield Safe Bank ${titles[section]}.`} />

      <section style={{ background: '#F4F6F8', borderBottom: '1px solid #DCE3EA', padding: '40px 0 0' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: 'clamp(28px, 3.5vw, 44px)', color: '#0A2044', margin: '0 0 24px', letterSpacing: '-0.02em' }}>Legal</h1>
          <div className="legal-tabs" style={{ display: 'flex', gap: 0 }}>
            {sections.map(s => (
              <button
                key={s}
                onClick={() => setParams({ section: s })}
                style={{ padding: '12px 24px', background: section === s ? '#fff' : 'transparent', border: '1px solid #DCE3EA', borderBottom: section === s ? '1px solid #fff' : '1px solid #DCE3EA', marginBottom: section === s ? '-1px' : 0, fontFamily: 'Sora, sans-serif', fontWeight: section === s ? 600 : 400, fontSize: '14px', color: section === s ? '#0A2044' : '#6B7280', cursor: 'pointer', position: 'relative', zIndex: section === s ? 1 : 0 }}
              >
                {titles[s]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '56px 0 80px', background: '#fff' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          {section === 'terms' && <TermsContent />}
          {section === 'privacy' && <PrivacyContent />}
          {section === 'aml' && <AMLContent />}
        </div>
      </section>
    </>
  );
}

function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '36px' }}>
      <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '18px', color: '#0A2044', marginBottom: '12px' }}>{title}</h2>
      <div style={{ fontSize: '14px', color: '#374151', lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: '10px' }}>{children}</div>
    </div>
  );
}

function TermsContent() {
  return (
    <>
      <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#6B7280', marginBottom: '32px' }}>Effective: January 1, 2025</p>
      <LegalSection title="1. Acceptance">
        <p>By creating an account or using the Shield Safe Bank platform, you agree to these Terms. If you do not agree, do not use the platform.</p>
      </LegalSection>
      <LegalSection title="2. Services">
        <p>Shield Safe Bank accepts BTC and USDT deposits and converts them to US dollar balances. We do not accept fiat deposits. We do not permit crypto withdrawals. Withdrawals are US dollar amounts only, to a linked US bank account or debit card.</p>
      </LegalSection>
      <LegalSection title="3. Eligibility">
        <p>You must be at least 18 years of age. You must complete identity verification before receiving a deposit address. We may decline to open an account or close an existing account at our discretion.</p>
      </LegalSection>
      <LegalSection title="4. Rates and fees">
        <p>Exchange rates are locked at the time your on-chain transaction reaches the required confirmation count. The current fee schedule is published at shieldsafebank.com/fees. Fees may change with 30 days notice to account holders.</p>
      </LegalSection>
      <LegalSection title="5. Prohibited activities">
        <p>You may not use the platform to launder money, evade taxes, conduct structuring transactions, or violate any applicable law. Accounts found engaging in prohibited activities will be suspended and reported to relevant authorities.</p>
      </LegalSection>
      <LegalSection title="6. Limitation of liability">
        <p>Shield Safe Bank is not liable for losses resulting from incorrect deposit addresses, wrong networks, or market movements between deposit initiation and chain confirmation. We are not liable for losses resulting from unauthorized access to your account where such access was made possible by your own disclosure of credentials.</p>
      </LegalSection>
    </>
  );
}

function PrivacyContent() {
  return (
    <>
      <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#6B7280', marginBottom: '32px' }}>Effective: January 1, 2025</p>
      <LegalSection title="What we collect">
        <p>Legal name, date of birth, residential address, government-issued ID, and a liveness check image. Email address and account credentials. Transaction history and balance information. Device and connection metadata for fraud and security purposes.</p>
      </LegalSection>
      <LegalSection title="How we use it">
        <p>To verify your identity and comply with KYC/AML requirements. To operate your account and process transactions. To send account notifications and service communications. We do not sell your data to third parties or use it for advertising.</p>
      </LegalSection>
      <LegalSection title="Retention">
        <p>We retain identity verification records for a minimum of five years after account closure, as required by applicable financial regulations. Transaction records are retained for seven years.</p>
      </LegalSection>
      <LegalSection title="Your rights">
        <p>You may request a copy of your personal data at any time by contacting support@shieldsafebank.com. Deletion requests are subject to legal retention requirements.</p>
      </LegalSection>
    </>
  );
}

function AMLContent() {
  return (
    <>
      <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#6B7280', marginBottom: '32px' }}>Effective: January 1, 2025</p>
      <LegalSection title="Identity verification">
        <p>All account holders must complete full identity verification before receiving a deposit address. We use a combination of document verification and biometric liveness matching. Business accounts require entity-level documentation and verification of all beneficial owners above 25%.</p>
      </LegalSection>
      <LegalSection title="Transaction monitoring">
        <p>All transactions are monitored for patterns associated with money laundering, structuring, and sanctions exposure. Transactions from or to addresses flagged in public blockchain analytics databases are flagged for review automatically.</p>
      </LegalSection>
      <LegalSection title="Suspicious activity">
        <p>We file Suspicious Activity Reports (SARs) as required by applicable law. We do not tip off the subject of an SAR filing. Accounts subject to review may have transactions held pending completion of the review.</p>
      </LegalSection>
      <LegalSection title="Sanctions screening">
        <p>We screen all account holders and transactions against OFAC and other applicable sanctions lists. Accounts matching a sanctions designation will be blocked immediately and reported to relevant authorities.</p>
      </LegalSection>
      <LegalSection title="Record keeping">
        <p>Identity verification records are retained for a minimum of five years. Transaction records are retained for seven years. All records are available to regulators upon request.</p>
      </LegalSection>
    </>
  );
}
