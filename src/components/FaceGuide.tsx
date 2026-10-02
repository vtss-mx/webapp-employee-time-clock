import { Ban, Glasses, HardHat, ScanFace, ShieldCheck } from 'lucide-react';
import type { FaceGuidance } from '../hooks/useFaceDetection';
import { ACCESSORY_LABELS, type AccessoryKind } from '../utils/faceErrors';

export type Tone = 'idle' | 'warn' | 'ok' | 'busy';

export function guidanceTone(guidance: FaceGuidance): Tone {
  if (guidance === 'hold_still' || guidance === 'ready') return 'ok';
  if (guidance === 'no_face' || guidance === 'loading') return 'idle';
  return 'warn';
}

/**
 * Escáner facial: óvalo guía con anillo de progreso (se llena mientras el rostro se mantiene
 * estable), línea de escaneo, esquinas de enfoque y mensaje de estado animado.
 */
export function FaceGuide({ tone, message, progress = 0 }: { tone: Tone; message: string; progress?: number }) {
  const pct = tone === 'busy' ? 100 : Math.round(progress * 100);
  return (
    <>
      <div className={`face-scan face-scan--${tone}`} aria-hidden>
        <div className="face-scan__window">
          <span className="face-scan__line" />
          <span className="face-scan__grid" />
        </div>
        <svg className="face-scan__ring" viewBox="0 0 300 400" preserveAspectRatio="none">
          <ellipse className="face-scan__track" cx="150" cy="200" rx="146" ry="196" pathLength={100} />
          <ellipse
            className="face-scan__progress"
            cx="150"
            cy="200"
            rx="146"
            ry="196"
            pathLength={100}
            style={{ strokeDashoffset: 100 - pct }}
          />
        </svg>
        <i className="face-scan__corner" />
        <i className="face-scan__corner" />
        <i className="face-scan__corner" />
        <i className="face-scan__corner" />
      </div>
      <div key={message} className={`camera__message camera__message--${tone}`} role="status" aria-live="polite">
        {tone === 'ok' ? <ShieldCheck size={18} /> : <ScanFace size={18} />}
        {message}
      </div>
    </>
  );
}

const ACCESSORY_ICONS: Record<AccessoryKind, typeof Glasses> = { GLASSES: Glasses, HEADWEAR: HardHat, MASK: Ban };

/** Tarjeta animada sobre la cámara con los accesorios que deben retirarse. */
export function AccessoryAlert({ items }: { items: AccessoryKind[] }) {
  if (items.length === 0) return null;
  return (
    <div className="accessory-alert" aria-hidden>
      {items.map((a) => {
        const Icon = ACCESSORY_ICONS[a];
        const label = ACCESSORY_LABELS[a];
        return (
          <span key={a}>
            <span>
              <Icon size={30} />
            </span>
            {label}
          </span>
        );
      })}
    </div>
  );
}

/** Visor para lectura de QR. */
export function QrGuide({ message, tone = 'idle' }: { message: string; tone?: Tone }) {
  return (
    <>
      <div className={`qr-guide qr-guide--${tone}`} aria-hidden>
        <i className="qr-guide__corner" />
        <i className="qr-guide__corner" />
        <i className="qr-guide__corner" />
        <i className="qr-guide__corner" />
        <i className="qr-guide__line" />
      </div>
      <div key={message} className={`camera__message camera__message--${tone}`} role="status" aria-live="polite">
        {message}
      </div>
    </>
  );
}
