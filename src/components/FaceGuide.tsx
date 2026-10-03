import { ScanFace, ShieldCheck } from 'lucide-react';
import { useCatalogs } from '../hooks/useCatalogs';
import type { FaceGuidance } from '../hooks/useFaceDetection';
import { accessoryIcon } from './accessories';

export type Tone = 'idle' | 'warn' | 'ok' | 'busy';

/**
 * Contorno del óvalo guía que empieza ARRIBA y avanza en sentido horario. No se rota la figura
 * para que el progreso arranque arriba: una elipse alta rotada 90° se vuelve ancha y el anillo
 * dejaría de coincidir con la guía.
 */
const OVAL = 'M150 4 A146 196 0 1 1 150 396 A146 196 0 1 1 150 4';

export function guidanceTone(guidance: FaceGuidance): Tone {
  if (guidance === 'hold_still' || guidance === 'ready') return 'ok';
  if (guidance === 'no_face' || guidance === 'loading') return 'idle';
  return 'warn';
}

interface FaceGuideProps {
  tone: Tone;
  message: string;
  progress?: number;
  /** Etapa del flujo: cambia el aspecto (malla al escanear, anillo exterior al confirmar...). */
  stage?: string;
}

/**
 * Escáner facial: óvalo guía con anillo de progreso (se llena mientras el rostro se mantiene
 * estable o mientras gira en la prueba de vida), malla y línea de escaneo, anillo exterior en
 * movimiento al escanear y confirmar, esquinas de enfoque y mensaje de estado animado.
 */
export function FaceGuide({ tone, message, progress = 0, stage }: FaceGuideProps) {
  const pct = tone === 'busy' ? 100 : Math.round(progress * 100);
  return (
    <>
      <div className={`face-scan face-scan--${tone} ${stage ? `face-scan--${stage}` : ''}`} aria-hidden>
        <svg className="face-scan__orbit" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="48" pathLength={100} />
        </svg>
        <div className="face-scan__window">
          <span className="face-scan__line" />
          <span className="face-scan__grid" />
        </div>
        <svg className="face-scan__ring" viewBox="0 0 300 400" preserveAspectRatio="none">
          <path className="face-scan__track" d={OVAL} pathLength={100} />
          <path className="face-scan__progress" d={OVAL} pathLength={100} style={{ strokeDashoffset: 100 - pct }} />
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

/** Tarjeta animada sobre la cámara con los accesorios (códigos del catálogo) que deben retirarse. */
export function AccessoryAlert({ items }: { items: string[] }) {
  const { nameOf } = useCatalogs();
  if (items.length === 0) return null;
  return (
    <div className="accessory-alert" aria-hidden>
      {items.map((code) => {
        const Icon = accessoryIcon(code);
        return (
          <span key={code}>
            <span>
              <Icon size={30} />
            </span>
            {nameOf('accessories', code)}
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
