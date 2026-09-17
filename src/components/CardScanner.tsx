import { useEffect, useRef, useState } from 'react';
import { trackUserActivity } from '../lib/api';

export interface CardScanResult {
  front: boolean;
  back: boolean;
  last4: string;
  holderName: string;
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

export default function CardScanner({ accountName, initialHolderName, onClose, onComplete }: { accountName: string; initialHolderName?: string; onClose: () => void; onComplete: (result: CardScanResult) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [step, setStep] = useState<Step>('intro');
  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'live' | 'denied'>('idle');
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scanComplete, setScanComplete] = useState(false);
  const [flash, setFlash] = useState(false);
  const [progress, setProgress] = useState(0);
  const [frontOk, setFrontOk] = useState(false);
  const [result, setResult] = useState<CardScanResult | null>(null);
  const [last4, setLast4] = useState('');
  const [last4Error, setLast4Error] = useState('');
  const [holderName, setHolderName] = useState(
    (initialHolderName || '').trim() || accountName.trim()
  );

  const activeStep = step === 'done' ? 'back' : step;
  const copy = STEP_COPY[activeStep as Exclude<Step, 'done'>];

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
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
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
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

  function captureFrameStats(): { w: number; h: number; mean: number; edge: number } | null {
    const video = videoRef.current;
    if (!video) return null;
    const w = video.videoWidth || 0;
    const h = video.videoHeight || 0;
    if (w < 8 || h < 8) return null;
    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvasRef.current = canvas;
    }
    const sw = 96;
    const sh = Math.max(8, Math.round((h / w) * sw));
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    try {
      ctx.drawImage(video, 0, 0, sw, sh);
      const data = ctx.getImageData(0, 0, sw, sh).data;
      const lum = new Array<number>(sw * sh);
      let sum = 0;
      for (let i = 0; i < lum.length; i += 1) {
        const v = 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
        lum[i] = v;
        sum += v;
      }
      const mean = sum / lum.length;
      let edge = 0;
      for (let y = 1; y < sh; y += 1) {
        for (let x = 1; x < sw; x += 1) {
          edge += Math.abs(lum[y * sw + x] - lum[y * sw + x - 1]);
          edge += Math.abs(lum[y * sw + x] - lum[(y - 1) * sw + x]);
        }
      }
      return { w, h, mean, edge: edge / lum.length };
    } catch {
      return null;
    }
  }

  function runScan(nextStep: Step) {
    setScanError('');
    const stats = captureFrameStats();
    if (cameraState !== 'live' || !stats) {
      setScanError('Open your camera first so the card is visible in the frame.');
      return;
    }
    if (stats.mean < 22) {
      setScanError('The view is too dark. Move to a brighter spot and keep the card inside the frame.');
      return;
    }
    if (stats.mean > 233) {
      setScanError('There is too much glare on the card. Tilt it away from the light and try again.');
      return;
    }
    setScanning(true);
    setFlash(true);
    setTimeout(() => setFlash(false), 240);
    setProgress(0);
    let samples = 0;
    let brightSamples = 0;
    let darkSamples = 0;
    let edgeSum = 0;
    const startedAt = Date.now();
    const duration = 5200;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const live = captureFrameStats();
      if (live) {
        samples += 1;
        edgeSum += live.edge;
        if (live.mean > 235) brightSamples += 1;
        if (live.mean < 20) darkSamples += 1;
      }
      const pct = Math.min(100, ((Date.now() - startedAt) / duration) * 100);
      setProgress(pct);
      if (pct >= 100) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setScanning(false);
        const avgEdge = samples > 0 ? edgeSum / samples : 0;
        if (samples < 3 || avgEdge < 4.2) {
          setScanError('This does not look like a card yet. Fill the frame with the card, hold it steady, and scan again.');
          return;
        }
        if (brightSamples >= Math.max(3, Math.floor(samples / 2)) || darkSamples >= Math.max(3, Math.floor(samples / 2))) {
          setScanError('The lighting kept changing. Hold the card flat under steady light and scan again.');
          return;
        }
        setScanError('');
        trackUserActivity('card_scan_capture', { step: nextStep === 'back' ? 'front' : 'back' });
        if (nextStep === 'back') setFrontOk(true);
        else setScanComplete(true);
      }
    }, 120);
  }

  function finishScan() {
    const trimmed = holderName.trim();
    const digits = last4.replace(/\D/g, '').slice(-4);
    if (digits.length !== 4) {
      setLast4Error('Enter the last 4 digits printed on the front of the card.');
      return;
    }
    if (trimmed.length < 2) {
      setLast4Error('Enter the name printed on the card so it can be saved with these digits.');
      return;
    }
    setLast4Error('');
    const finished: CardScanResult = {
      front: true,
      back: true,
      last4: digits,
      holderName: trimmed,
      scannedAt: new Date().toISOString(),
    };
    setResult(finished);
    stopCamera();
    onComplete(finished);
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
            <StepDot index={1} label="Front" state={step === 'front' ? 'active' : frontOk || scanComplete ? 'done' : 'idle'} />
            <div style={{ flex: 1, height: '1px', background: scanComplete ? '#1E7A4C' : '#DCE3EA' }} />
            <StepDot index={2} label="Back" state={scanComplete ? 'done' : step === 'back' ? 'active' : 'idle'} />
          </div>

          <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '19px', color: '#0A2044', margin: '0 0 8px' }}>
            {scanComplete ? 'Confirm your card details' : copy.title}
          </h2>
          <p style={{ fontSize: '13.5px', color: '#4A5568', lineHeight: 1.6, margin: '0 0 18px' }}>
            {scanComplete
              ? 'Both sides were captured. Check the details below and save them to your account.'
              : copy.body}
          </p>

          {!result && (
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
                    <div style={{ position: 'absolute', left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, #ffffff 50%, rgba(255,255,255,0) 100%)', boxShadow: '0 0 14px rgba(255, 255, 255, 0.85)', animation: 'ssb-scan-sweep 3.4s ease-in-out infinite', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '10px 14px', background: 'rgba(10, 32, 68, 0.85)', pointerEvents: 'none' }}>
                      <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11.5px', color: '#fff', margin: '0 0 6px', letterSpacing: '0.04em' }}>
                        Scanning {step === 'front' ? 'front' : 'back'} of card… {Math.round(progress)}%
                      </p>
                      <div style={{ height: '2px', background: 'rgba(255,255,255,0.25)' }}>
                        <div style={{ height: '100%', width: `${progress}%`, background: '#ffffff', transition: 'width 0.12s linear' }} />
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
                {scanError !== '' && (
                  <p role="alert" style={{ fontSize: '13px', color: '#DC2626', margin: '10px 0 0', fontWeight: 500, lineHeight: 1.6 }}>
                    {scanError}
                  </p>
                )}

                {frontOk && step === 'back' && !scanning && (
                  <p role="status" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11.5px', color: '#1E7A4C', margin: '10px 0 0', fontWeight: 600 }}>
                    Front side accepted.
                  </p>
                )}

                {scanComplete && (
                  <div style={{ marginTop: '14px', border: '1px solid #DCE3EA', background: '#F4F6F8', padding: '16px' }}>
                    <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4779C4', margin: '0 0 12px' }}>
                      Confirm the details to save
                    </p>
                    <label style={{ display: 'block', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B7280', marginBottom: '6px' }}>
                      Last 4 digits on the card
                    </label>
                    <input
                      value={last4}
                      onChange={e => { setLast4(e.target.value.replace(/\D/g, '').slice(0, 4)); setLast4Error(''); }}
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="0000"
                      aria-label="Last 4 digits on the card"
                      style={{ width: '100%', border: '1px solid #DCE3EA', padding: '11px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '16px', fontWeight: 600, letterSpacing: '0.2em', color: '#0A2044', background: '#fff', outline: 'none' }}
                    />
                    <label style={{ display: 'block', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B7280', margin: '12px 0 6px' }}>
                      Name printed on the card
                    </label>
                    <input
                      value={holderName}
                      onChange={e => { setHolderName(e.target.value); setLast4Error(''); }}
                      maxLength={60}
                      placeholder="Cardholder name"
                      aria-label="Name printed on the card"
                      style={{ width: '100%', border: '1px solid #DCE3EA', padding: '11px 12px', fontSize: '15px', color: '#0A2044', background: '#fff', outline: 'none' }}
                    />
                    {last4Error !== '' && (
                      <p role="alert" style={{ fontSize: '13px', color: '#DC2626', margin: '10px 0 0', fontWeight: 500, lineHeight: 1.6 }}>
                        {last4Error}
                      </p>
                    )}
                  </div>
                )}

                {scanComplete && (
                  <button
                    onClick={() => { if (scanning) return; finishScan(); }}
                    className="btn-primary"
                    style={{ padding: '13px', fontSize: '14.5px', marginTop: '12px' }}
                  >
                    Save card details
                  </button>
                )}

                <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#9CA3AF', margin: '10px 0 0', lineHeight: 1.6 }}>
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
                  Card saved: •••• {result.last4} for {result.holderName}
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
