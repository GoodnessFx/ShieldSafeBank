/**
 * Tawk.to live-chat widget.
 *
 * Property ID is hardcoded here. Agents reply from the Tawk.to mobile app
 * or dashboard (https://app.tawk.to). Works on every page, every device,
 * no backend required.
 *
 * The widget is suppressed inside the admin console so agents don't
 * see the customer bubble while they're already logged into Tawk.to.
 */
import { useEffect } from 'react';

const TAWK_PROPERTY_ID = '6aee85a1f124803c2f39570b';
const TAWK_WIDGET_ID = 'default';

export default function TawkToWidget() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Never show the customer widget inside the admin console.
    if (window.location.pathname.includes('xk9-admin-console')) return;
    if (document.getElementById('tawk-to-script')) return;

    const w = window as Record<string, unknown>;
    w['Tawk_API'] = w['Tawk_API'] || {};
    w['Tawk_LoadStart'] = new Date();

    const script = document.createElement('script');
    script.id = 'tawk-to-script';
    script.async = true;
    script.src = `https://embed.tawk.to/${TAWK_PROPERTY_ID}/${TAWK_WIDGET_ID}`;
    script.charset = 'UTF-8';
    script.setAttribute('crossorigin', '*');
    document.head.appendChild(script);
  }, []);

  return null;
}
