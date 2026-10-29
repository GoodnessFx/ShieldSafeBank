import { useState } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import SplashScreen from './components/SplashScreen';
import TawkToWidget from './components/TawkToWidget';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <>
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      <RouterProvider router={router} />
      {/* Tawk.to (Hawk) customer-facing live-chat widget — a fallback support
          channel agents answer from the Tawk.to dashboard. Only renders when
          VITE_TAWK_TO_ID is configured. */}
      <TawkToWidget />
    </>
  );
}

