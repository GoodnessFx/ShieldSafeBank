import { GOOGLE_CLIENT_ID } from './config';

export function googleSignIn(): Promise<{ ok: boolean; email: string; name: string }> {
  if (GOOGLE_CLIENT_ID.trim().length > 0) {
    // Real integration point.
    // Set GOOGLE_CLIENT_ID in src/lib/config.ts, then a real flow can be wired
    // here with Google Identity Services: load https://accounts.google.com/gsi/client,
    // initialize with GOOGLE_CLIENT_ID, exchange the credential ID for a session
    // via POST /api/auth/google. Fall back to the demo path while unconfigured.
    return demoSignIn();
  }
  return demoSignIn();
}

function demoSignIn(): Promise<{ ok: boolean; email: string; name: string }> {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ ok: true, email: 'you@gmail.com', name: 'Demo User' }), 900);
  });
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