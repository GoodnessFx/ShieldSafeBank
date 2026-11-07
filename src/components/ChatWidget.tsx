/**
 * Chat support widget.
 *
 * Direct backend chat is not available in this environment.
 * Customers are directed to contact support via email.
 */
export default function ChatWidget() {
  return (
    <div className="chat-widget no-print" style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 100 }}>
      <a
        href="mailto:customercare@shieldsafe.com"
        title="Contact Support"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: '#123C7C',
          color: '#fff',
          boxShadow: '0 4px 16px rgba(18,60,124,0.25)',
          textDecoration: 'none',
        }}
        aria-label="Contact support by email"
      >
        {/* Envelope icon */}
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <rect x="2" y="5" width="18" height="13" rx="2" stroke="#fff" strokeWidth="1.8" fill="none"/>
          <path d="M2 7l9 6 9-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
        </svg>
      </a>
    </div>
  );
}
