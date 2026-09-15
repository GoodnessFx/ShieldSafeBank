import { useState, useEffect } from 'react';

const CURRENCIES = {
  GBP: { name: 'British Pound', rate: 0.7834, symbol: '£' },
  EUR: { name: 'Euro', rate: 0.9215, symbol: '€' },
  CAD: { name: 'Canadian Dollar', rate: 1.3712, symbol: 'C$' },
  NGN: { name: 'Nigerian Naira', rate: 1538.5, symbol: '₦' },
} as const;

type CurrencyCode = keyof typeof CURRENCIES;

function fmtUSD(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtForeign(n: number, symbol: string) {
  return symbol + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ForeignExchange() {
  const [currency, setCurrency] = useState<CurrencyCode>('GBP');
  const [rawInput, setRawInput] = useState('100');
  const [rates, setRates] = useState(() => Object.fromEntries(Object.entries(CURRENCIES).map(([k, v]) => [k, v.rate])) as Record<CurrencyCode, number>);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => {
      setRates(prev => {
        const next = { ...prev };
        (Object.keys(next) as CurrencyCode[]).forEach(k => {
          const base = CURRENCIES[k].rate;
          const delta = (Math.random() - 0.5) * base * 0.002;
          next[k] = Math.max(prev[k] + delta, base * 0.9);
        });
        return next;
      });
      setLastUpdate(new Date());
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const amount = parseFloat(rawInput) || 0;
  const rate = rates[currency];
  const converted = amount / rate;

  return (
    <div className="fx-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 480px) minmax(260px, 1fr)', gap: '24px', alignItems: 'start', width: '100%' }}>
      <div style={{ border: '1px solid #DCE3EA', background: '#fff', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #DCE3EA', background: '#F4F6F8' }}>
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4779C4' }}>Foreign Currency</span>
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280' }}>
          Updated {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>

      <div style={{ padding: '20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0, marginBottom: '16px', border: '1px solid #DCE3EA' }}>
          {(Object.keys(CURRENCIES) as CurrencyCode[]).map(c => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              style={{
                flex: '1 1 auto',
                minWidth: '64px',
                padding: '8px',
                background: currency === c ? '#123C7C' : '#fff',
                color: currency === c ? '#fff' : '#6B7280',
                border: 'none',
                fontFamily: 'IBM Plex Mono, monospace',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
              }}
              aria-pressed={currency === c}
            >
              {c}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: '4px' }}>
          <label style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>YOU SEND (USD)</label>
          <div style={{ display: 'flex', border: '1px solid #DCE3EA', alignItems: 'center' }}>
            <span style={{ padding: '0 14px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, fontSize: '14px', color: '#4779C4' }}>$</span>
            <input
              type="number"
              value={rawInput}
              onChange={e => setRawInput(e.target.value)}
              min={0}
              step="0.01"
              style={{
                flex: 1,
                border: 'none',
                padding: '12px 14px 12px 0',
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: '22px',
                fontWeight: 600,
                color: '#0A2044',
                background: 'transparent',
                outline: 'none',
                width: '100%',
              }}
              aria-label="Amount in USD"
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '14px 0' }}>
          <div style={{ flex: 1, height: '1px', background: '#DCE3EA' }} />
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 2v12M4 10l4 4 4-4" stroke="#4779C4" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" />
          </svg>
          <div style={{ flex: 1, height: '1px', background: '#DCE3EA' }} />
        </div>

        <div>
          <label style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
            YOU RECEIVE ({currency})
          </label>
          <div style={{ padding: '12px 14px', background: '#F4F6F8', border: '1px solid #DCE3EA' }}>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '28px', fontWeight: 600, color: '#1E7A4C', letterSpacing: '-0.02em' }}>
              {fmtForeign(converted, CURRENCIES[currency].symbol)}
            </span>
          </div>
        </div>

        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <FxRow label="Currency" value={CURRENCIES[currency].name} />
          <FxRow label="Rate" value={`${fmtUSD(1)} = ${fmtForeign(1 / rate, CURRENCIES[currency].symbol)}`} />
          <FxRow label="You send" value={fmtUSD(amount)} />
        </div>

        <p style={{ marginTop: '12px', fontSize: '11px', color: '#9CA3AF', fontFamily: 'IBM Plex Mono, monospace', lineHeight: 1.5 }}>
          Rates shown are indicative and updated periodically. Final rate is locked at confirmation time.
        </p>
      </div>
      </div>

      {/* Live rate table */}
      <div style={{ border: '1px solid #DCE3EA', background: '#fff', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #DCE3EA', background: '#F4F6F8' }}>
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4779C4' }}>Rate table</span>
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#6B7280' }}>Base: USD</span>
        </div>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '12px', padding: '10px 20px', borderBottom: '1px solid #DCE3EA', fontFamily: 'IBM Plex Mono, monospace', fontSize: '10.5px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B7280' }}>
            <span>Currency</span>
            <span style={{ textAlign: 'right' }}>1 USD =</span>
            <span style={{ textAlign: 'right' }}>1 unit =</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '12px', padding: '11px 20px', borderBottom: '1px solid #DCE3EA', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12.5px' }}>
            <span style={{ color: '#0A2044', fontWeight: 600 }}>USD (US Dollar)</span>
            <span style={{ textAlign: 'right', color: '#0A2044' }}>1.0000</span>
            <span style={{ textAlign: 'right', color: '#6B7280' }}>$1.00</span>
          </div>
          {(Object.keys(CURRENCIES) as CurrencyCode[]).map((c, idx) => (
            <div key={c} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '12px', padding: '11px 20px', borderBottom: idx < Object.keys(CURRENCIES).length - 1 ? '1px solid #DCE3EA' : 'none', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12.5px' }}>
              <span style={{ color: '#0A2044', fontWeight: currency === c ? 600 : 400 }}>{c} ({CURRENCIES[c].name})</span>
              <span style={{ textAlign: 'right', color: '#0A2044' }}>{rates[c].toFixed(c === 'NGN' ? 2 : 4)}</span>
              <span style={{ textAlign: 'right', color: '#6B7280' }}>{fmtForeign(1 / rates[c], CURRENCIES[c].symbol)}</span>
            </div>
          ))}
        </div>
        <p style={{ padding: '12px 20px', margin: 0, fontSize: '11px', color: '#9CA3AF', fontFamily: 'IBM Plex Mono, monospace', lineHeight: 1.5 }}>
          Indicative mid-market rates. Your rate is locked when a conversion is confirmed.
        </p>
      </div>
    </div>
  );
}

function FxRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontFamily: 'IBM Plex Mono, monospace', color: '#6B7280' }}>
      <span>{label}</span>
      <span style={{ textAlign: 'right', color: '#0A2044', fontWeight: 500 }}>{value}</span>
    </div>
  );
}
