import { useEffect, useRef, useState } from 'react';

export interface CardScanResult {
  front: boolean;
  back: boolean;
  last4: string;
  scannedAt: string;
}

export const CARD_KEY = 'ssb_card_scan';

export function readCardScan(email: string): CardScanResult | null {
  try {
    const all = JSON.parse(localStorage.getItem(CARD_KEY) || '{}');
    return all[email.toLowerCase()] || null;
  } catch {
    return null;
  }
}

export function writeCardScan(email: string, result: CardScanResult) {
  try {
    const all = JSON.parse(localStorage.getItem(CARD_KEY) || '{}');
    all[email.toLowerCase()] = result;
    localStorage.setItem(CARD_KEY, JSON.stringify(all));
  } catch {
    // storage unavailable
  }
}

type Step = 'intro' | 'front' | 'back' | 'done';

const STEP_COPY: Record<Exclude<Step, 'done'>, { title: string; body: string; action: string }> = {
  intro: {
    title: 'Verify your Shield Safe Bank card',
    body: 'Have your card ready. You will scan the front first, then flip it and scan the back. Both sides are required.',
    action: 'Open camera and start',
  },
  front: {
    title: 'Scan the FRONT of your card',
    body: 'Hold the card inside the frame. Keep it flat and well lit, then tap Capture.',
    action: 'Capture front',
  },
  back: {
    title: 'Now scan the BACK of your card',
    body: 'Flip the card over. Keep it inside the frame and avoid glare from the lighting.',
    action: 'Capture back',
  },
};

export default function CardScanner({ onClose, onComplete }: { onClose: () => void; onComplete: (result: CardScanResult) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [step, setStep] = useState<Step>('intro');
  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'live' | 'denied'>('idle');
  const [scanning, setScanning] = useState(false);
  const [flash, setFlash] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<CardScanResult | null>(null);

  const activeStep = step === 'done' ? 'back' : step;
  const copy = STEP_COPY[activeStep as Exclude<Step, 'done'>];

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  async function startCamera() {
    if (cameraState === 'live' || cameraState === 'starting') return;
    setCameraState('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        const played = videoRef.current.play();
        if (played && typeof played.catch === 'function') await played.catch(() => {});
      }
      setCameraState('live');
    } catch {
      setCameraState('denied');
    }
  }

  function stopCamera() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraState('idle');
  }

  function runScan(nextStep: Step) {
    setScanning(true);
    setFlash(true);
    setTimeout(() => setFlash(false), 240);
    setProgress(0);
    const startedAt = Date.now();
    const duration = 2200;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - startedAt) / duration) * 100);
      setProgress(pct);
      if (pct >= 100) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setScanning(false);
        setStep(nextStep);
        if (nextStep === 'done') {
          const digits = String(Math.floor(1000 + Math.random() * 9000));
          const finished: CardScanResult = { front: true, back: true, last4: digits, scannedAt: new Date().toISOString() };
          setResult(finished);
          stopCamera();
          onComplete(finished);
        }
      }
    }, 60);
  }

  function handleCapture() {
    if (scanning) return;
    if (step === 'front') runScan('back');
    else if (step === 'back') runScan('done');
  }

  function handleIntroStart() {
    setStep('front');
    startCamera();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Card verification"
      style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(10, 32, 68, 0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}
    >
      <div style={{ background: '#fff', border: '1px solid #DCE3EA', width: '100%', maxWidth: '520px', maxHeight: '92vh', overflowY: 'auto', animation: 'ssb-fade-in-up 0.25s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #DCE3EA', background: '#F4F6F8' }}>
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4779C4' }}>
            Card verification
          </span>
          <button
            onClick={() => { stopCamera(); onClose(); }}
            aria-label="Close card verification"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: '20px', lineHeight: 1, padding: '2px 4px' }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <StepDot index={1} label="Front" state={step === 'front' ? 'active' : step === 'back' || step === 'done' ? 'done' : 'idle'} />
            <div style={{ flex: 1, height: '1px', background: step === 'back' || step === 'done' ? '#1E7A4C' : '#DCE3EA' }} />
            <StepDot index={2} label="Back" state={step === 'back' ? 'active' : step === 'done' ? 'done' : 'idle'} />
          </div>

          <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '19px', color: '#0A2044', margin: '0 0 8px' }}>
            {step === 'done' ? 'Card verified' : copy.title}
          </h2>
          <p style={{ fontSize: '13.5px', color: '#4A5568', lineHeight: 1.6, margin: '0 0 18px' }}>
            {step === 'done'
              ? 'Both sides of your Shield Safe Bank card were scanned successfully and saved to your account.'
              : copy.body}
          </p>

          {step !== 'done' && (
            <>
              <div style={{ position: 'relative', background: '#0A2044', border: '1px solid #DCE3EA', aspectRatio: '16 / 10', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: cameraState === 'live' ? 'block' : 'none' }}
                />

                {cameraState !== 'live' && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '20px', textAlign: 'center' }}>
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                      <rect x="3" y="10" width="34" height="22" rx="2" stroke="#4779C4" strokeWidth="1.6" />
                      <circle cx="20" cy="21" r="6" stroke="#4779C4" strokeWidth="1.6" />
                      <path d="M14 10l2.5-3h7L26 10" stroke="#4779C4" strokeWidth="1.6" strokeLinejoin="round" />
                    </svg>
                    <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#A9C6E8', margin: 0, lineHeight: 1.6 }}>
                      {cameraState === 'denied'
                        ? 'Camera access was blocked. Allow camera permission in your browser, then try again.'
                        : cameraState === 'starting'
                          ? 'Opening your camera…'
                          : 'Your camera stays on this device. Nothing is uploaded until you confirm.'}
                    </p>
                    {cameraState === 'denied' && (
                      <button onClick={() => { setCameraState('idle'); startCamera(); }} style={{ background: '#4779C4', color: '#fff', border: 'none', padding: '9px 18px', fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                        Try camera again
                      </button>
                    )}
                  </div>
                )}

                {cameraState === 'live' && (
                  <div style={{ position: 'absolute', inset: '12% 8%', border: '1px solid rgba(169, 198, 232, 0.55)', pointerEvents: 'none' }}>
                    <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />
                  </div>
                )}

                {flash && (
                  <div
                    aria-hidden="true"
                    style={{ position: 'absolute', inset: 0, background: '#fff', animation: 'ssb-capture-flash 0.24s ease-out', pointerEvents: 'none' }}
                  />
                )}

                {scanning && (
                  <>
                    <div style={{ position: 'absolute', left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, rgba(71,121,196,0) 0%, #4779C4 50%, rgba(71,121,196,0) 100%)', animation: 'ssb-scan-sweep 1.6s ease-in-out infinite', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '10px 14px', background: 'rgba(10, 32, 68, 0.85)', pointerEvents: 'none' }}>
                      <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11.5px', color: '#A9C6E8', margin: '0 0 6px', letterSpacing: '0.04em' }}>
                        Scanning {step === 'front' ? 'front' : 'back'} of card… {Math.round(progress)}%
                      </p>
                      <div style={{ height: '2px', background: 'rgba(71,121,196,0.3)' }}>
                        <div style={{ height: '100%', width: `${progress}%`, background: '#4779C4', transition: 'width 0.06s linear' }} />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '18px' }}>
                {step === 'intro' ? (
                  <button
                    onClick={handleIntroStart}
                    className="btn-primary"
                    style={{ padding: '13px', fontSize: '14.5px', animation: 'ssb-pulse-ring 1.8s ease-out infinite' }}
                  >
                    {copy.action}
                  </button>
                ) : cameraState === 'live' ? (
                  <button
                    onClick={handleCapture}
                    disabled={scanning}
                    style={{ background: scanning ? '#6B7280' : '#123C7C', color: '#fff', border: 'none', padding: '13px', fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '14.5px', cursor: scanning ? 'default' : 'pointer', transition: 'background 0.15s' }}
                  >
                    {scanning ? `Scanning ${step === 'front' ? 'front' : 'back'}…` : copy.action}
                  </button>
                ) : (
                  <button
                    onClick={startCamera}
                    disabled={cameraState === 'starting'}
                    style={{ background: '#123C7C', color: '#fff', border: 'none', padding: '13px', fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '14.5px', cursor: cameraState === 'starting' ? 'default' : 'pointer', opacity: cameraState === 'starting' ? 0.7 : 1 }}
                  >
                    {cameraState === 'starting' ? 'Opening camera…' : 'Open camera'}
                  </button>
                )}
                <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#9CA3AF', margin: 0, lineHeight: 1.6 }}>
                  Both sides are required before your card can be saved. Keep the card flat, fill the frame, and avoid shadows.
                </p>
              </div>
            </>
          )}

          {step === 'done' && result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" stroke="#1E7A4C" strokeWidth="1.5" /><path d="M6 10.3l2.6 2.6 5.4-6" stroke="#1E7A4C" strokeWidth="1.6" strokeLinecap="square" /></svg>
                  <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '15px', color: '#15803D', margin: 0 }}>Card saved to your account</p>
                </div>
                <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#166534', margin: 0, lineHeight: 1.7 }}>
                  Front side captured<br />
                  Back side captured<br />
                  Card ending •••• {result.last4}
                </p>
              </div>
              <button
                onClick={() => { stopCamera(); onClose(); }}
                className="btn-primary"
                style={{ padding: '13px', fontSize: '14.5px' }}
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepDot({ index, label, state }: { index: number; label: string; state: 'idle' | 'active' | 'done' }) {
  const bg = state === 'done' ? '#1E7A4C' : state === 'active' ? '#123C7C' : '#fff';
  const fg = state === 'idle' ? '#9CA3AF' : '#fff';
  const border = state === 'idle' ? '#DCE3EA' : 'transparent';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ width: '22px', height: '22px', background: bg, color: fg, border: `1px solid ${border}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 600 }}>
        {state === 'done' ? '✓' : index}
      </span>
      <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11.5px', letterSpacing: '0.04em', textTransform: 'uppercase', color: state === 'idle' ? '#9CA3AF' : '#0A2044', fontWeight: 600 }}>
        {label}
      </span>
    </div>
  );
}

function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const base = { position: 'absolute' as const, width: '18px', height: '18px', borderColor: '#A9C6E8', borderStyle: 'solid' as const };
  const map = {
    tl: { top: '-1px', left: '-1px', borderWidth: '2px 0 0 2px' },
    tr: { top: '-1px', right: '-1px', borderWidth: '2px 2px 0 0' },
    bl: { bottom: '-1px', left: '-1px', borderWidth: '0 0 2px 2px' },
    br: { bottom: '-1px', right: '-1px', borderWidth: '0 2px 2px 0' },
  };
  return <div style={{ ...base, ...map[pos] }} />;
}
