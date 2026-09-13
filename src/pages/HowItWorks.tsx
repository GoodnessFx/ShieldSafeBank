export default function HowItWorks() {
  return (
    <>
      <title>How It Works — Shield Safe Bank</title>
      <meta name="description" content="A detailed walkthrough of how Shield Safe Bank converts your crypto deposits to a US dollar balance, with a worked numeric example." />

      <section style={{ background: '#F4F6F8', borderBottom: '1px solid #DCE3EA', padding: '56px 0 48px' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4A7DA8', marginBottom: '16px' }}>Process</p>
          <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: 'clamp(32px, 4vw, 52px)', color: '#0F2338', margin: 0, letterSpacing: '-0.02em' }}>How it works</h1>
        </div>
      </section>

      <section style={{ padding: '72px 0', background: '#fff' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6">

          {[
            {
              n: '01', title: 'Create and verify your account',
              body: `Sign up with your email address. We ask for full legal name, date of birth, residential address, and a government-issued photo ID plus a liveness check. Verification typically completes within one business day. Business accounts require the same for each authorized user plus articles of incorporation and a business address.`
            },
            {
              n: '02', title: 'Receive your deposit addresses',
              body: `Once verified, your dashboard shows two permanent deposit addresses: one for BTC and one for USDT (you choose ERC-20 or TRC-20 during setup, and that address does not change). Send only BTC to the BTC address and only the supported USDT contract to the USDT address. Sending the wrong asset or network results in a permanent loss that we cannot recover.`
            },
            {
              n: '03', title: 'Send your crypto',
              body: `Initiate a transfer from your external wallet or exchange to your Shield Safe Bank deposit address. The address is yours alone. You can send multiple transactions and they convert independently.`
            },
            {
              n: '04', title: 'On-chain confirmation',
              body: `We require 3 confirmations for BTC and 12 for USDT on ERC-20, or 20 for USDT on TRC-20. Once confirmed, we lock the exchange rate at that moment and credit your USD balance. The locked rate is the rate at time of confirmation, not when you initiated the transaction.`
            },
            {
              n: '05', title: 'Your USD balance',
              body: `Your balance sits in USD. It does not fluctuate with crypto markets. There is no yield, no staking, and no reinvestment. It is a dollar balance.`
            },
            {
              n: '06', title: 'Withdraw whenever you want',
              body: `Link a US bank account (ACH or wire) or a debit card. Submit a withdrawal request. ACH withdrawals take 1–3 business days. Wire withdrawals take same day if submitted before 2pm EST. Debit card withdrawals post within minutes. A minimum of $10.00 applies to all withdrawals.`
            },
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: '28px', paddingBottom: '52px', marginBottom: '52px', borderBottom: i < 5 ? '1px solid #DCE3EA' : 'none' }}>
              <div style={{ flexShrink: 0, paddingTop: '4px' }}>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, fontSize: '13px', color: '#4A7DA8' }}>{step.n}</span>
              </div>
              <div>
                <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '22px', color: '#0F2338', marginBottom: '14px', letterSpacing: '-0.01em' }}>{step.title}</h2>
                <p style={{ fontSize: '15px', color: '#374151', lineHeight: 1.75, margin: 0, maxWidth: '72ch' }}>{step.body}</p>
              </div>
            </div>
          ))}

          {/* Worked example */}
          <div style={{ background: '#F4F6F8', border: '1px solid #DCE3EA', padding: '32px' }}>
            <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4A7DA8', marginBottom: '20px' }}>Worked example</p>
            <h3 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '20px', color: '#0F2338', marginBottom: '24px' }}>0.25 BTC → USD, step by step</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px' }}>
              {[
                ['You send', '0.25000000 BTC'],
                ['Chain confirmations', '3'],
                ['Rate at confirmation', '$67,842.50 / BTC'],
                ['Gross USD', '$16,960.63'],
                ['Conversion fee (0.50%)', '−$84.80'],
                ['Net USD credited', '$16,875.83'],
                ['Balance after deposit', '$16,875.83'],
                ['Withdrawal (ACH, 2 days)', '$16,875.83'],
                ['Withdrawal fee', '$0.00 (included)'],
                ['Wire fee ($18.00 flat)', '−$18.00'],
                ['If wire: net received', '$16,857.83'],
              ].map(([label, val], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #DCE3EA', color: '#0F2338' }}>
                  <span style={{ color: '#6B7280' }}>{label}</span>
                  <span style={{ fontWeight: 600 }}>{val}</span>
                </div>
              ))}
            </div>
            <p style={{ marginTop: '20px', fontSize: '12px', color: '#9CA3AF', fontFamily: 'IBM Plex Mono, monospace', margin: '20px 0 0' }}>
              Rates shown are illustrative. Actual rates vary at time of confirmation.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
