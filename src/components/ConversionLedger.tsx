import { useState, useEffect } from 'react';

const RATES = {
  BTC: 67842.50,
  USDT: 0.9998,
};

const BTC_TICK = 0.00000001;

function fmtUSD(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtCrypto(n: number, asset: 'BTC' | 'USDT') {
  if (asset === 'BTC') {
    const s = n.toFixed(8);
    return s.replace(/\.?0+$/, '') || '0';
  }
  return n.toFixed(2);
}

export default function ConversionLedger() {
  const [asset, setAsset] = useState<'BTC' | 'USDT'>('BTC');
  const [rawInput, setRawInput] = useState('0.5');
  const [rate, setRate] = useState(RATES.BTC);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Simulate live rate fluctuation
  useEffect(() => {
    const id = setInterval(() => {
      setRate(r => {
        const delta = (Math.random() - 0.5) * (asset === 'BTC' ? 18 : 0.0001);
        return Math.max(r + delta, asset === 'BTC' ? 60000 : 0.99);
      });
      setLastUpdate(new Date());
    }, 4000);
    return () => clearInterval(id);
  }, [asset]);

  useEffect(() => {
    setRate(RATES[asset]);
    setRawInput(asset === 'BTC' ? '0.5' : '1000');
  }, [asset]);

  const amount = parseFloat(rawInput) || 0;
  const usdResult = amount * rate;
  const fee = usdResult * 0.005;
  const net = usdResult - fee;

  return (
    <div style={{ border: '1px solid #DCE3EA', background: '#fff', maxWidth: '480px', width: '100%' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #DCE3EA', background: '#F4F6F8' }}>
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4A7DA8' }}>Conversion Ledger</span>
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280' }}>
          Updated {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>

      <div style={{ padding: '20px' }}>
        {/* Asset toggle */}
        <div style={{ display: 'flex', gap: 0, marginBottom: '16px', border: '1px solid #DCE3EA' }}>
          {(['BTC', 'USDT'] as const).map(a => (
            <button
              key={a}
              onClick={() => setAsset(a)}
              style={{
                flex: 1,
                padding: '8px',
                background: asset === a ? '#1B3A5C' : '#fff',
                color: asset === a ? '#fff' : '#6B7280',
                border: 'none',
                fontFamily: 'IBM Plex Mono, monospace',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
              }}
              aria-pressed={asset === a}
            >
              {a}
            </button>
          ))}
        </div>

        {/* Input row */}
        <div style={{ marginBottom: '4px' }}>
          <label style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>YOU SEND</label>
          <div style={{ display: 'flex', border: '1px solid #DCE3EA', alignItems: 'center' }}>
            <input
              type="number"
              value={rawInput}
              onChange={e => setRawInput(e.target.value)}
              min={BTC_TICK}
              step={asset === 'BTC' ? '0.00000001' : '1'}
              style={{
                flex: 1,
                border: 'none',
                padding: '12px 14px',
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: '22px',
                fontWeight: 600,
                color: '#0F2338',
                background: 'transparent',
                outline: 'none',
                width: '100%',
              }}
              aria-label={`Amount in ${asset}`}
            />
            <span style={{ padding: '0 14px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, fontSize: '14px', color: '#4A7DA8' }}>{asset}</span>
          </div>
        </div>

        {/* Divider with arrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '14px 0' }}>
          <div style={{ flex: 1, height: '1px', background: '#DCE3EA' }} />
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 2v12M4 10l4 4 4-4" stroke="#4A7DA8" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" />
          </svg>
          <div style={{ flex: 1, height: '1px', background: '#DCE3EA' }} />
        </div>

        {/* Result row */}
        <div>
          <label style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>YOU RECEIVE (USD)</label>
          <div style={{ padding: '12px 14px', background: '#F4F6F8', border: '1px solid #DCE3EA' }}>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '28px', fontWeight: 600, color: '#1E7A4C', letterSpacing: '-0.02em' }}>
              {fmtUSD(net)}
            </span>
          </div>
        </div>

        {/* Breakdown */}
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <LedgerRow label="Rate" value={`1 ${asset} = ${fmtUSD(rate)}`} />
          <LedgerRow label="Gross amount" value={fmtUSD(usdResult)} />
          <LedgerRow label="Conversion fee (0.50%)" value={`-${fmtUSD(fee)}`} />
          <div style={{ borderTop: '1px solid #DCE3EA', paddingTop: '6px' }}>
            <LedgerRow label="Net to balance" value={fmtUSD(net)} bold />
          </div>
        </div>

        <p style={{ marginTop: '12px', fontSize: '11px', color: '#9CA3AF', fontFamily: 'IBM Plex Mono, monospace', lineHeight: 1.5 }}>
          Rate locked at confirmation time. Price shown is indicative.
        </p>
      </div>
    </div>
  );
}

function LedgerRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontFamily: 'IBM Plex Mono, monospace', color: bold ? '#0F2338' : '#6B7280', fontWeight: bold ? 600 : 400 }}>
      <span>{label}</span>
      <span style={{ textAlign: 'right' }}>{value}</span>
    </div>
  );
}
