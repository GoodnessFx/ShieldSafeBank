/**
 * Tawk.to (a.k.a. "Hawk") live-chat widget.
 *
 * Embeds the Tawk.to chat bubble on the customer-facing app so clients can reach
 * support through Tawk.to and agents reply from the Tawk.to dashboard. This is a
 * fallback channel that keeps working even when the ShieldSafeBank admin console
 * chat is having issues.
 *
 * Configure with VITE_TAWK_TO_ID (your Tawk.to property id). When unset nothing is
 * rendered, so it is safe to ship by default.
 */
import { useEffect } from 'react';
import { TAWK_TO_PROPERTY_ID } from '../lib/config';

export default function TawkToWidget() {
  useEffect(() => {
    if (!TAWK_TO_PROPERTY_ID) return;

    const scriptId = 'tawk-to-script';
    if (document.getElementById(scriptId)) return;

    const script = document.createElement('script');
    script.id = scriptId;
    script.type = 'text/javascript';
    script.async = true;
    script.src = `https://embed.tawk.to/${TAWK_TO_PROPERTY_ID}/1`;
    script.charset = 'UTF-8';
    script.crossOrigin = '*';

    // Tawk.to reads a global Tawk_API object before the script loads.
    (window as any).Tawk_API = (window as any).Tawk_API || {};
    (window as any).Tawk_LoadStart = new Date();

    const first = document.getElementsByTagName('script')[0];
    first.parentNode!.insertBefore(script, first);

    return () => {
      try { script.remove(); } catch {}
      const el = document.getElementById(scriptId);
      if (el) el.remove();
    };
  }, [TAWK_TO_PROPERTY_ID]);

  return null;
}
