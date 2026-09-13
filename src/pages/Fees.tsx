export default function Fees() {
  return (
    <>
      <title>Fees — Shield Safe Bank</title>
      <meta name="description" content="Complete fee table for Shield Safe Bank. No hidden markups. Flat, itemized rates for conversion, withdrawals, and account services." />

      <section style={{ background: '#F4F6F8', borderBottom: '1px solid #DCE3EA', padding: '56px 0 48px' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4A7DA8', marginBottom: '16px' }}>Pricing</p>
          <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: 'clamp(32px, 4vw, 52px)', color: '#0F2338', margin: '0 0 16px', letterSpacing: '-0.02em' }}>Fees</h1>
          <p style={{ fontSize: '16px', color: '#4A5568', lineHeight: 1.65, maxWidth: '480px', margin: 0 }}>
            Every fee is listed here. There are no hidden markups embedded in the exchange rate.
          </p>
        </div>
      </section>

      <section style={{ padding: '64px 0', background: '#fff' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex flex-col gap-12">

          <FeeTable title="Conversion" rows={[
            ['BTC to USD', '0.50% of gross USD value'],
            ['USDT to USD (ERC-20)', '0.30% of gross USD value'],
            ['USDT to USD (TRC-20)', '0.30% of gross USD value'],
            ['Exchange rate markup', '$0.00 — rate is mid-market at confirmation'],
          ]} />

          <FeeTable title="Withdrawals" rows={[
            ['ACH (1–3 business days)', '$0.00'],
            ['Wire (same day if before 2pm EST)', '$18.00 flat'],
            ['Debit card (minutes)', '1.50% of withdrawal amount, min $2.00'],
            ['Minimum withdrawal', '$10.00'],
          ]} />

          <FeeTable title="Account" rows={[
            ['Account opening', '$0.00'],
            ['Monthly maintenance', '$0.00'],
            ['Identity verification', '$0.00'],
            ['Deposit address issuance', '$0.00'],
            ['Statement download', '$0.00'],
          ]} />

          <FeeTable title="Business accounts" rows={[
            ['Additional authorized users', '$0.00'],
            ['Business conversion fee', '0.40% of gross USD value (BTC), 0.25% (USDT)'],
            ['Business ACH', '$0.00'],
            ['Business wire', '$15.00 flat'],
          ]} />

          <div style={{ background: '#F4F6F8', border: '1px solid #DCE3EA', padding: '24px' }}>
            <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '15px', color: '#0F2338', margin: '0 0 8px' }}>Network fees (gas)</p>
            <p style={{ fontSize: '14px', color: '#4A5568', lineHeight: 1.65, margin: 0 }}>
              Network transaction fees (gas) on the sending side are paid by you when you initiate the transfer from your wallet. We do not add a surcharge. We do not charge any fee for receiving a deposit on our end.
            </p>
          </div>

          <p style={{ fontSize: '12px', color: '#9CA3AF', fontFamily: 'IBM Plex Mono, monospace', lineHeight: 1.7 }}>
            Fees are subject to change with 30 days notice to account holders. Rates effective as of the date shown on your account fee schedule.
          </p>
        </div>
      </section>
    </>
  );
}

function FeeTable({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div>
      <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '20px', color: '#0F2338', marginBottom: '16px', letterSpacing: '-0.01em' }}>{title}</h2>
      <div style={{ border: '1px solid #DCE3EA' }}>
        {rows.map(([label, val], i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: i < rows.length - 1 ? '1px solid #DCE3EA' : 'none', background: i % 2 === 0 ? '#fff' : '#F4F6F8' }}>
            <span style={{ fontSize: '14px', color: '#374151' }}>{label}</span>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '14px', fontWeight: 600, color: '#0F2338', textAlign: 'right' }}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
