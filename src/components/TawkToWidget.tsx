/**
 * Tawk.to (a.k.a. "Hawk") live-chat widget.
 *
 * The admin connects a Tawk.to property in the admin console (Chat Inbox). It is
 * stored on the shared server, so every customer device — desktop and mobile —
 * loads the widget. Agents reply from the Tawk.to mobile app or dashboard, which
 * keeps working even if the in-app admin chat has issues.
 *
 * Resolution order: shared server -> this browser's saved id -> VITE_TAWK_TO_ID.
 * Nothing renders when no id is configured. The admin console itself never loads
 * the widget (agents use the Tawk.to app instead).
 */
import { useEffect } from 'react';
import { getTawkConfig } from '../lib/api';

export default function TawkToWidget() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Never render the customer widget inside the admin console.
    if (window.location.pathname.includes('xk9-admin-console')) return;
    let cancelled = false;

    (async () => {
      const remote = await getTawkConfig();
      let propertyId = remote?.propertyId || '';
      const widgetId = remote?.widgetId || '1';
      if (!propertyId) {
        try { propertyId = localStorage.getItem('ssb_tawk_property_id') || ''; } catch { /* ignore */ }
      }
      if (!propertyId) propertyId = (import.meta.env?.VITE_TAWK_TO_ID as string | undefined) || '';
      if (cancelled || !propertyId || document.getElementById('tawk-to-script')) return;

      const w = window as any;
      w.Tawk_API = w.Tawk_API || {};
      w.Tawk_LoadStart = new Date();
      const script = document.createElement('script');
      script.id = 'tawk-to-script';
      script.async = true;
      script.src = `https://embed.tawk.to/${propertyId}/${widgetId}`;
      script.charset = 'UTF-8';
      script.setAttribute('crossorigin', '*');
      document.head.appendChild(script);
    })();

    return () => { cancelled = true; };
  }, []);

  return null;
}
