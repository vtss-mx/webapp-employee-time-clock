import { ArrowLeft, ArrowRight, ChevronsDown, ChevronsUp, ZoomIn } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { FaceGuidance } from '../hooks/useFaceDetection';
import { actionTarget, type ActionMode } from '../utils/facePose';
import { AccessoryAlert } from './FaceGuide';
import type { Phase } from './FaceScan';

/*
 * Señales sobre la cámara para cada movimiento de la prueba de vida. Todas se dimensionan con el óvalo
 * real del visor (`--oval-w` y `--arrow-size` de `.camera`, unidades de contenedor) y quedan fuera del
 * rostro; su animación se apaga con "reducir movimiento".
 */

/** Flecha lateral que indica hacia dónde girar (fuera del rostro). */
function TurnArrow({ pointsLeft }: { pointsLeft: boolean }) {
  const style = { ['--nudge' as string]: pointsLeft ? '-16px' : '16px', ['--side' as string]: pointsLeft ? '-1' : '1' };
  return (
    <div className="turn-arrow" style={style} aria-hidden>
      {pointsLeft ? <ArrowLeft size={44} /> : <ArrowRight size={44} />}
    </div>
  );
}

/** Mirar arriba o abajo: doble flecha que sube o baja, junto al óvalo (como la del giro). */
function TiltCue({ up }: { up: boolean }) {
  return (
    <div className={`turn-arrow tilt-cue tilt-cue--${up ? 'up' : 'down'}`} aria-hidden>
      {up ? <ChevronsUp size={44} /> : <ChevronsDown size={44} />}
    </div>
  );
}

/** Acercarse: un óvalo mayor marca hasta dónde debe crecer el rostro, con una lupa que late. */
function CloserCue({ scale }: { scale: number }) {
  return (
    <div className="closer-cue" style={{ '--closer-scale': scale } as CSSProperties} aria-hidden>
      <span className="closer-cue__target" />
      <span className="turn-arrow closer-cue__badge">
        <ZoomIn size={26} />
      </span>
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
      return <TurnArrow pointsLeft={(mode.action === 'TURN_LEFT') === mirrored} />;
    case 'LOOK_UP':
    case 'LOOK_DOWN':
      return <TiltCue up={mode.action === 'LOOK_UP'} />;
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
