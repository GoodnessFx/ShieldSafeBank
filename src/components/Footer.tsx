import { Link } from 'react-router';

export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid #DCE3EA', background: '#F4F6F8', marginTop: 'auto' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div>
            <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4A7DA8', marginBottom: '12px' }}>Product</p>
            <nav className="flex flex-col gap-2">
              <FootLink to="/how-it-works">How It Works</FootLink>
              <FootLink to="/personal">Personal Banking</FootLink>
              <FootLink to="/business">Business Banking</FootLink>
              <FootLink to="/fees">Fees</FootLink>
            </nav>
          </div>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4A7DA8', marginBottom: '12px' }}>Company</p>
            <nav className="flex flex-col gap-2">
              <FootLink to="/about">About</FootLink>
              <FootLink to="/security">Security</FootLink>
              <FootLink to="/support">Support</FootLink>
            </nav>
          </div>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4A7DA8', marginBottom: '12px' }}>Legal</p>
            <nav className="flex flex-col gap-2">
              <FootLink to="/legal?section=terms">Terms of Service</FootLink>
              <FootLink to="/legal?section=privacy">Privacy Policy</FootLink>
              <FootLink to="/legal?section=aml">AML/KYC Policy</FootLink>
            </nav>
          </div>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4A7DA8', marginBottom: '12px' }}>Account</p>
            <nav className="flex flex-col gap-2">
              <FootLink to="/login">Log In</FootLink>
              <FootLink to="/signup">Open Account</FootLink>
              <FootLink to="/forgot-password">Reset Password</FootLink>
            </nav>
          </div>
        </div>

        <div style={{ borderTop: '1px solid #DCE3EA', paddingTop: '24px', display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>
            &copy; {new Date().getFullYear()} Shield Safe Bank. Not a licensed money transmitter. Platform for demonstration and investor review.
          </p>
          <p style={{ fontSize: '12px', color: '#6B7280', margin: 0, fontFamily: 'IBM Plex Mono, monospace' }}>
            support@shieldsafebank.com &middot; Mon–Fri 9am–6pm EST
          </p>
        </div>
      </div>
    </footer>
  );
}

function FootLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      style={{ fontSize: '14px', color: '#374151', textDecoration: 'none', transition: 'color 0.15s' }}
      onMouseEnter={e => { (e.target as HTMLElement).style.color = '#1B3A5C'; }}
      onMouseLeave={e => { (e.target as HTMLElement).style.color = '#374151'; }}
    >
      {children}
    </Link>
  );
}
