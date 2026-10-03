import { CheckCircle2, PauseCircle, RefreshCw, Smartphone, TriangleAlert } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import type { DynamicQrPhase } from '../hooks/useDynamicQr';
import type { DynamicQr } from '../types';
import { Button } from './ui/Button';
import { Skeleton } from './ui/Skeleton';

interface DynamicQrCodeProps {
  qr: DynamicQr | null;
  phase: DynamicQrPhase;
  /** Vigencia restante (1 → 0): el anillo se va vaciando. */
  progress: number;
  remaining: number;
  alt: string;
  onRenew: () => void;
  /** Tocar el código (p. ej. ampliarlo). */
  onOpen?: () => void;
  large?: boolean;
}

/** Últimos segundos: el anillo cambia de color para avisar que viene otro código. */
const ENDING_SECONDS = 5;

/** Lo que se ve SOBRE el código cuando no está vigente (usado, reemplazado, en pausa, error). */
function Overlay({ phase, onRenew }: { phase: DynamicQrPhase; onRenew: () => void }) {
  const views: Partial<Record<DynamicQrPhase, { icon: ReactNode; title: string; text?: string; action?: string }>> = {
    used: { icon: <CheckCircle2 size={44} />, title: '¡Listo!', text: 'Código usado. Generando uno nuevo…' },
    replaced: {
      icon: <Smartphone size={40} />,
      title: 'Este código se reemplazó',
      text: 'Se generó otro en otro dispositivo o tu empresa lo invalidó.',
      action: 'Mostrar un código nuevo',
    },
    paused: { icon: <PauseCircle size={40} />, title: 'En pausa', text: 'Venció mientras no lo veías.', action: 'Mostrar código' },
    error: { icon: <TriangleAlert size={40} />, title: 'No se pudo generar tu código', action: 'Reintentar' },
  };
  const view = views[phase];
  if (!view) return null;
  return (
    <div className={`dynamic-qr__overlay dynamic-qr__overlay--${phase}`} role="status">
      <span className="dynamic-qr__overlay-icon" aria-hidden>
        {view.icon}
      </span>
      <strong>{view.title}</strong>
      {view.text && <span className="small">{view.text}</span>}
      {view.action && (
        <Button size="sm" variant="primary" icon={<RefreshCw size={16} />} onClick={onRenew}>
          {view.action}
        </Button>
      )}
    </div>
  );
}

/**
 * Código QR dinámico: la imagen dentro de un anillo que se vacía con su vigencia (cambia de color en
 * los últimos segundos) y, encima, el estado cuando deja de servir. Al llegar uno nuevo, el código
 * entra con una animación (la `key` es su id).
 */
export function DynamicQrCode({ qr, phase, progress, remaining, alt, onRenew, onOpen, large = false }: DynamicQrCodeProps) {
  const ending = phase === 'ready' && remaining <= ENDING_SECONDS;
  const style = { '--qr-progress': progress } as CSSProperties;
  const classes = ['dynamic-qr', `dynamic-qr--${phase}`, ending && 'is-ending', large && 'dynamic-qr--large'].filter(Boolean).join(' ');
  const image = qr && <img key={qr.id} src={qr.image_base64} alt={alt} className="dynamic-qr__image" />;
  return (
    <div className={classes} style={style}>
      <div className="dynamic-qr__frame">
        {!qr && phase === 'loading' && <Skeleton width="100%" height="100%" radius={14} />}
        {image &&
          (onOpen ? (
            <button type="button" className="dynamic-qr__button" onClick={onOpen} aria-label="Ampliar código QR">
              {image}
            </button>
          ) : (
            image
          ))}
        <Overlay phase={phase} onRenew={onRenew} />
      </div>
    </div>
  );
}
