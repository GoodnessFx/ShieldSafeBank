import { GOOGLE_CLIENT_ID } from './config';

export type GoogleSignInResult = {
  ok: boolean;
  idToken?: string;
  email?: string;
  name?: string;
  error?: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: { client_id: string; callback: (resp: { credential?: string }) => void }) => void;
          prompt: (hint?: Record<string, unknown>) => void;
        };
      };
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadGsi(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  if (window.google?.accounts?.id) return Promise.resolve();
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Google Sign-In'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

function decodeJwt(token: string): { email?: string; name?: string } {
  try {
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(encoded);
    return JSON.parse(decodeURIComponent(decoded.split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
  } catch {
    return {};
  }
}

export function googleSignIn(): Promise<GoogleSignInResult> {
  const clientId = GOOGLE_CLIENT_ID.trim();
  if (!clientId) {
    return new Promise(resolve =>
      setTimeout(() => resolve({ ok: true, idToken: '', email: 'you@gmail.com', name: 'Demo User' }), 900),
    );
  }
  return loadGsi()
    .then(
      () =>
        new Promise<GoogleSignInResult>(resolve => {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: resp => {
              const token = resp.credential || '';
              const claims = decodeJwt(token);
              if (!token || !claims.email) {
                resolve({ ok: false, error: 'Google did not return a valid account.' });
                return;
              }
              resolve({ ok: true, idToken: token, email: claims.email, name: claims.name || '' });
            },
          });
          window.google.accounts.id.prompt();
        }),
    )
    .catch(() => ({ ok: false, error: 'Google sign-in could not be loaded. Check your connection.' }));
}

export function isGoogleConfigured() {
  return GOOGLE_CLIENT_ID.trim().length > 0;
}

export function googleSvg() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.6 9.2c0-.64-.057-1.25-.164-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.796 2.716v2.259h2.909C16.71 14.3 17.6 11.99 17.6 9.2z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.26c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.594.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958l3.007 2.332C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}