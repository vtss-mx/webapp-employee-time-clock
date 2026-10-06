import { useId, type CSSProperties } from 'react';
import type { FaceGuidance } from '../hooks/useFaceDetection';
import { actionTarget, type ActionMode } from '../utils/facePose';
import { AccessoryAlert } from './FaceGuide';
import type { Phase } from './FaceScan';

/*
 * Señales delicadas sobre el anillo para cada movimiento de la prueba de vida (sin insignias pesadas): un dibujo del mismo
 * tamaño y lugar que el anillo del visor (`--face-d`, `--face-cy` de `.camera`, unidades de contenedor) con
 *  - girar y mirar arriba/abajo: un arco resaltado junto al anillo, del lado del movimiento, y una punta fina que se
 *    desliza hacia ese lado;
 *  - acercarse: ondas finas que salen del anillo hacia afuera (el rostro debe crecer) mientras el círculo "respira".
 * La indicación escrita (en vivo para lectores de pantalla) la da el mensaje bajo el círculo; esto es solo apoyo
 * visual. Todo es CSS (transformaciones y opacidad) y "reducir movimiento" lo deja quieto.
 */

/** Hacia dónde va el movimiento: el lado del anillo que se resalta. */
type CueSide = 'left' | 'right' | 'up' | 'down';

/*
 * El arco y la punta se dibujan del lado derecho (a las 3 en punto) y el CSS gira el dibujo hacia el lado pedido. El arco
 * va ±30° por FUERA del anillo, con un aire fino (radio 52.2 en el cuadro de 100; el del `ProgressRing` es 48.4): el
 * avance verde no cambia de color. La punta va DENTRO del círculo, junto al borde: nunca se sale del visor.
 */
const ARC = 'M95.21 23.9A52.2 52.2 0 0 1 95.21 76.1';
const CHEVRON = 'M87.6 45.6L91.2 50L87.6 54.4';

/** Girar o mirar arriba/abajo: arco resaltado y punta hacia ese lado. */
function DirectionCue({ side }: { side: CueSide }) {
  // Id propio del degradado (dentro de `url(#…)` solo letras, números, - y _).
  const fade = `cue-${useId().replace(/[^\w-]/g, '')}`;
  return (
    <div className={`ring-cue ring-cue--${side}`} aria-hidden>
      <svg className="ring-cue__svg" viewBox="0 0 100 100">
        <defs>
          <linearGradient id={fade} gradientUnits="userSpaceOnUse" x1="0" y1="24" x2="0" y2="76">
            <stop offset="0" className="ring-cue__edge" />
            <stop offset="0.5" className="ring-cue__core" />
            <stop offset="1" className="ring-cue__edge" />
          </linearGradient>
        </defs>
        <path className="ring-cue__arc" d={ARC} stroke={`url(#${fade})`} />
        <g className="ring-cue__pointer">
          <path className="ring-cue__halo" d={CHEVRON} />
          <path className="ring-cue__chevron" d={CHEVRON} />
        </g>
      </svg>
    </div>
  );
}

/** Acercarse: ondas finas que salen del anillo hasta el tamaño al que debe crecer el rostro (con tope en el CSS). */
function CloserCue({ scale }: { scale: number }) {
  return (
    <div className="ring-cue ring-cue--closer" style={{ '--closer-scale': scale } as CSSProperties} aria-hidden>
      <svg className="ring-cue__svg" viewBox="0 0 100 100">
        <circle className="ring-cue__ripple" cx="50" cy="50" r="48.4" />
        <circle className="ring-cue__ripple ring-cue__ripple--late" cx="50" cy="50" r="48.4" />
      </svg>
    </div>
  );
}

/**
 * Señal del movimiento pedido. `mirrored`: cámara frontal con espejo (la izquierda de la persona se
 * ve a la izquierda de la pantalla); sin espejo, al revés.
 */
export function ActionCue({ mode, mirrored }: { mode: ActionMode; mirrored: boolean }) {
  switch (mode.action) {
    case 'TURN_LEFT':
    case 'TURN_RIGHT':
      return <DirectionCue side={(mode.action === 'TURN_LEFT') === mirrored ? 'left' : 'right'} />;
    case 'LOOK_UP':
    case 'LOOK_DOWN':
      return <DirectionCue side={mode.action === 'LOOK_UP' ? 'up' : 'down'} />;
    default:
      return <CloserCue scale={actionTarget(mode)} />;
  }
}

interface ScannerHintsProps {
  phase: Phase;
  guidance: FaceGuidance;
  /** Movimiento en curso (solo mientras se pide; null al volver al frente o fuera del reto). */
  mode: ActionMode | null;
  mirrored: boolean;
  /** Accesorios a retirar (bloqueo por accesorios). */
  accessories: string[];
}

/** Indicaciones sobre el rostro: la señal del movimiento (reto) o los accesorios a retirar (bloqueo). */
export function ScannerHints({ phase, guidance, mode, mirrored, accessories }: ScannerHintsProps) {
  if (phase === 'blocked') return <AccessoryAlert items={accessories} />;
  if (mode && guidance !== 'hold_still' && guidance !== 'ready') return <ActionCue mode={mode} mirrored={mirrored} />;
  return null;
}
