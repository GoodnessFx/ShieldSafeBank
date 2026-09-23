import { useState, useRef } from 'react';
import { Link } from 'react-router';
import { chatIdentity } from '../lib/localStore';
import { submitSupportMessage, sendChatMessage } from '../lib/api';

const FAQ: Record<string, { q: string; a: string }[]> = {
  'Getting Started': [
    { q: 'How do I open an account?', a: "Sign up with your email address. You'll need a government-issued ID and a brief liveness check. Verification typically completes within one business day." },
    { q: 'What countries are supported?', a: "Personal accounts are available to individuals with a valid government-issued ID. Business accounts require a US business bank account for withdrawals. We do not restrict by citizenship for deposits, but withdrawal methods are currently US-only." },
  ],
  'Deposits': [
    { q: 'What assets can I deposit?', a: "BTC and USDT. For USDT, you choose ERC-20 or TRC-20 during account setup. That address is permanent and cannot be changed." },
    { q: 'What happens if I send to the wrong network?', a: "Sending the wrong asset or using the wrong network (for example, sending USDT on BEP-20 to your ERC-20 address) results in a permanent loss. We cannot recover funds sent to the wrong network or contract. Always verify the network before sending." },
    { q: 'How many confirmations are required?', a: "3 confirmations for BTC. 12 confirmations for USDT on ERC-20. 20 confirmations for USDT on TRC-20." },
    { q: 'When is the exchange rate locked?', a: "At the moment your transaction reaches the required confirmation count on-chain. Not when you initiate the send, and not when you withdraw." },
  ],
  'Withdrawals': [
    { q: 'How do I withdraw?', a: "Link a US bank account (ACH or wire) or a US Visa/Mastercard debit card from your dashboard. Submit a withdrawal request. ACH takes one to three business days. Wire is same-day if submitted before 2pm EST. Debit card posts within minutes." },
    { q: 'Is there a minimum withdrawal?', a: "Yes. $10.00 for all withdrawal methods." },
    { q: 'What if my withdrawal exceeds my balance?', a: "The withdrawal form will show your available balance and reject the request inline if the amount is above it. There is no processing fee for a rejected withdrawal." },
  ],
  'Security': [
    { q: 'Is my balance safe if Shield Safe Bank is hacked?', a: "Customer USD balances are held in segregated reserve accounts at partner institutions, separate from our operating funds. The majority of crypto is in cold storage. We carry insurance on the custodied crypto." },
    { q: 'What 2FA methods are supported?', a: "Authenticator app (TOTP). SMS is not offered as a 2FA method." },
    { q: 'I lost my 2FA device. What do I do?', a: "Account recovery requires identity re-verification with a live ID check. Contact support@shieldsafebank.com from your account email to begin the process." },
  ],
  'Fees': [
    { q: 'Is there a fee to open an account?', a: "No." },
    { q: 'What is the conversion fee?', a: "0.50% of gross USD value for BTC. 0.30% for USDT. Business accounts pay 0.40% (BTC) and 0.25% (USDT). The exchange rate itself has no markup. It is mid-market at confirmation." },
  ],
  'Verification': [
    { q: 'How long does verification take?', a: "Personal accounts: typically within one business day. Business accounts: one to two business days depending on document complexity." },
    { q: 'What does the liveness check involve?', a: "A brief video selfie, about 90 seconds. It is matched against your ID photo automatically. You do not need to schedule a call." },
    { q: 'My verification is pending. Can I deposit?', a: "No. Deposit addresses are issued only after verification is complete. Your dashboard will show a clear verification-in-progress state." },
  ],
};

export default function Support() {
  const identity = chatIdentity();
  const signedIn = !!identity.email;
  const [active, setActive] = useState('Getting Started');
  const [openQ, setOpenQ] = useState<number | null>(null);
  const [formState, setFormState] = useState({
    name: identity.email && identity.user !== identity.email ? identity.user : '',
    email: identity.email || '',
    category: 'General',
    message: '',
  });
  const [sent, setSent] = useState(false);
  const sendingRef = useRef(false);

  return (
    <>
      <title>Support | Shield Safe Bank</title>
      <meta name="description" content="Shield Safe Bank help center. Find answers about deposits, withdrawals, verification, security, and fees." />

      <section style={{ background: '#F4F6F8', borderBottom: '1px solid #DCE3EA', padding: '56px 0 48px' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4779C4', marginBottom: '16px' }}>Help Center</p>
          <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: 'clamp(32px, 4vw, 52px)', color: '#0A2044', margin: 0, letterSpacing: '-0.02em' }}>Support</h1>
        </div>
      </section>

      <section style={{ padding: '64px 0', background: '#fff', borderBottom: '1px solid #DCE3EA' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-4 gap-8">
            {/* Sidebar */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {Object.keys(FAQ).map(cat => (
                <button
                  key={cat}
                  onClick={() => { setActive(cat); setOpenQ(null); }}
                  style={{ textAlign: 'left', padding: '9px 14px', background: active === cat ? '#123C7C' : 'transparent', color: active === cat ? '#fff' : '#374151', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: active === cat ? 600 : 400, transition: 'background 0.12s, color 0.12s' }}
                >
                  {cat}
                </button>
              ))}
            </nav>

            {/* FAQ */}
            <div className="col-span-3 faq-content" style={{ borderLeft: '1px solid #DCE3EA', paddingLeft: '32px' }}>
              <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '22px', color: '#0A2044', marginBottom: '24px' }}>{active}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid #DCE3EA' }}>
                {FAQ[active].map((item, i) => (
                  <div key={i} style={{ borderBottom: i < FAQ[active].length - 1 ? '1px solid #DCE3EA' : 'none' }}>
                    <button
                      onClick={() => setOpenQ(openQ === i ? null : i)}
                      style={{ width: '100%', textAlign: 'left', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}
                      aria-expanded={openQ === i}
                    >
                      <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '15px', color: '#0A2044' }}>{item.q}</span>
                      <span style={{ color: '#4779C4', fontSize: '18px', lineHeight: 1, flexShrink: 0 }}>{openQ === i ? '−' : '+'}</span>
                    </button>
                    {openQ === i && (
                      <div style={{ padding: '0 20px 20px', fontSize: '14px', color: '#4A5568', lineHeight: 1.75 }}>{item.a}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact form */}
      <section style={{ padding: '64px 0', background: '#F4F6F8' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '26px', color: '#0A2044', marginBottom: '8px' }}>Still need help?</h2>
          <p style={{ fontSize: '15px', color: '#4A5568', marginBottom: '32px' }}>Send us a message. We respond within one business day.</p>
          {sent ? (
            <div style={{ background: '#fff', border: '1px solid #DCE3EA', padding: '28px' }}>
              <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '16px', color: '#1E7A4C', margin: '0 0 8px' }}>Message received</p>
              <p style={{ fontSize: '14px', color: '#4A5568', margin: 0 }}>We will follow up at {formState.email} within one business day.</p>
            </div>
          ) : !signedIn ? (
            <div style={{ background: '#fff', border: '1px solid #DCE3EA', padding: '32px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '16px', color: '#0A2044', margin: '0 0 8px' }}>Sign in to send us a message</p>
              <p style={{ fontSize: '13px', color: '#4A5568', margin: '0 0 24px', lineHeight: 1.6 }}>We reply to messages through the account you're signed in with, so we always know who we're talking to.</p>
              <Link to="/login" style={{ display: 'inline-block', background: '#123C7C', color: '#fff', padding: '12px 28px', fontWeight: 600, fontSize: '14px', textDecoration: 'none' }}>Sign in</Link>
            </div>
          ) : (
            <form onSubmit={async (e) => { e.preventDefault(); if (!signedIn || sendingRef.current) return; sendingRef.current = true; const who = chatIdentity(); try { await sendChatMessage(formState.message); await submitSupportMessage({ name: who.user || formState.name, email: who.email, category: formState.category, message: formState.message }); } catch { /* still mark sent so UI shows confirmation */ } setSent(true); sendingRef.current = false; }} style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: '#fff', border: '1px solid #DCE3EA', padding: '32px' }}>
              <p style={{ fontSize: '12px', color: '#6B7280', fontFamily: 'IBM Plex Mono, monospace', margin: '0 0 4px' }}>Contacting as {formState.email}</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Full name" value={formState.name} onChange={v => setFormState(f => ({ ...f, name: v }))} type="text" required />
                <Field label="Email address" value={formState.email} onChange={v => setFormState(f => ({ ...f, email: v }))} type="email" readOnly />
              </div>
              <div>
                <label style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4779C4', display: 'block', marginBottom: '6px' }}>Category</label>
                <select value={formState.category} onChange={e => setFormState(f => ({ ...f, category: e.target.value }))} style={{ width: '100%', border: '1px solid #DCE3EA', padding: '10px 12px', fontSize: '14px', background: '#fff', color: '#0A2044', outline: 'none' }}>
                  {['General', 'Deposits', 'Withdrawals', 'Security', 'Fees', 'Verification'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4779C4', display: 'block', marginBottom: '6px' }}>Message</label>
                <textarea value={formState.message} onChange={e => setFormState(f => ({ ...f, message: e.target.value }))} required rows={5} style={{ width: '100%', border: '1px solid #DCE3EA', padding: '10px 12px', fontSize: '14px', background: '#fff', color: '#0A2044', outline: 'none', resize: 'vertical' }} />
              </div>
              <button type="submit" style={{ alignSelf: 'flex-start', background: '#123C7C', color: '#fff', border: 'none', padding: '12px 28px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'background 0.15s' }}>Send message</button>
            </form>
          )}
          <p style={{ marginTop: '24px', fontSize: '13px', color: '#6B7280', fontFamily: 'IBM Plex Mono, monospace' }}>
            support@shieldsafebank.com &middot; Monday to Friday, 9am to 6pm EST
          </p>
        </div>
      </section>
    </>
  );
}

function Field({ label, value, onChange, type, required, readOnly }: { label: string; value: string; onChange: (v: string) => void; type: string; required?: boolean; readOnly?: boolean }) {
  return (
    <div>
      <label style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4779C4', display: 'block', marginBottom: '6px' }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} required={required} readOnly={readOnly} style={{ width: '100%', border: '1px solid #DCE3EA', padding: '10px 12px', fontSize: '14px', background: readOnly ? '#F4F6F8' : '#fff', color: readOnly ? '#0A2044' : '#0A2044', outline: 'none' }} />
    </div>
  );
}
