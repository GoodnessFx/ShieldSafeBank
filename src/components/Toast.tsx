export interface ToastData {
  id: string;
  title: string;
  body: string;
  tone: 'success' | 'info' | 'error';
}

export default function Toast({ toasts, onDismiss }: { toasts: ToastData[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div
      style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: 'calc(100vw - 32px)',
        width: '360px',
      }}
      aria-live="polite"
      role="status"
    >
      {toasts.map(t => (
        <div
          key={t.id}
          style={{
            background: '#fff',
            border: '1px solid #DCE3EA',
            borderLeft: `4px solid ${t.tone === 'success' ? '#1E7A4C' : t.tone === 'error' ? '#DC2626' : '#4779C4'}`,
            boxShadow: '0 8px 24px rgba(10, 32, 68, 0.14)',
            padding: '14px 16px',
            animation: 'ssb-fade-in-up 0.25s ease',
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-start',
          }}
        >
          <div style={{ flexShrink: 0, marginTop: '2px' }}>
            {t.tone === 'success' ? (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="8" stroke="#1E7A4C" strokeWidth="1.4" /><path d="M5.5 9.2l2.2 2.2 4.8-5" stroke="#1E7A4C" strokeWidth="1.5" strokeLinecap="square" /></svg>
            ) : t.tone === 'error' ? (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="8" stroke="#DC2626" strokeWidth="1.4" /><path d="M6 6l6 6M12 6l-6 6" stroke="#DC2626" strokeWidth="1.4" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="8" stroke="#4779C4" strokeWidth="1.4" /><line x1="9" y1="8" x2="9" y2="13" stroke="#4779C4" strokeWidth="1.4" /><circle cx="9" cy="5.4" r="0.9" fill="#4779C4" /></svg>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '13.5px', color: '#0A2044', margin: '0 0 3px' }}>{t.title}</p>
            <p style={{ fontSize: '12.5px', color: '#4A5568', margin: 0, lineHeight: 1.5 }}>{t.body}</p>
          </div>
          <button
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss notification"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', flexShrink: 0, fontSize: '16px', lineHeight: 1, padding: '2px' }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
