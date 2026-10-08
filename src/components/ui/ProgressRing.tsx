import { useId, type CSSProperties } from 'react';

/** Grados de una vuelta: el trazo del anillo se mide en grados (`pathLength`), así el avance es un ángulo. */
const TURN = 360;

interface ProgressRingProps {
  /** Avance 0..1 (se acota): el arco llega a él al instante. */
  value: number;
  /** Grosor del trazo en unidades del dibujo (el anillo mide 100 × 100: crece con el círculo que rodea). */
  thickness?: number;
  /** Texto para lectores de pantalla; sin él, el anillo es decorativo (lo explica el texto que lo acompaña). */
  label?: string;
  className?: string;
}

/** El avance acotado a 0..1 (un valor fuera de rango o no numérico nunca da un arco inválido). */
export function ringValue(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

/**
 * Anillo de avance (componente propio, regla 12): una pista fina con `--ring-track` y un arco con puntas redondas del
 * color `--ring-from` → `--ring-to` (hoy un solo color; tokens del tema que cada pantalla personaliza). Empieza arriba y
 * avanza en el sentido del reloj.
 *
 * Decisión del dueño del producto (2026-10-06, «algo más enterprise»): estados fijos. El avance solo cambia el
 * `stroke-dashoffset` del arco y se ve AL INSTANTE: sin transiciones, sin luces en la punta ni brillos. Nada se vuelve
 * a dibujar en React por cuadro.
 */
export function ProgressRing({ value, thickness = 1.2, label, className }: ProgressRingProps) {
  // `useId` puede traer caracteres que no sirven dentro de `url(#…)`: se dejan solo letras, números, - y _.
  const id = `ring-${useId().replace(/[^\w-]/g, '')}`;
  const ratio = ringValue(value);
  // Una unidad libre por fuera: el suavizado del borde cabe en el dibujo.
  const radius = 49 - thickness / 2;
  const arc = { strokeDashoffset: TURN - ratio * TURN } as CSSProperties;
  const classes = ['progress-ring', ratio > 0 && 'progress-ring--started', className].filter(Boolean).join(' ');
  return (
    <svg
      className={classes}
      viewBox="0 0 100 100"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-value={Math.round(ratio * 100)}
    >
      <defs>
        <linearGradient id={`${id}-fill`} gradientUnits="userSpaceOnUse" x1="18" y1="0" x2="82" y2="100">
          <stop offset="0" className="progress-ring__from" />
          <stop offset="1" className="progress-ring__to" />
        </linearGradient>
      </defs>
      <circle className="progress-ring__track" cx="50" cy="50" r={radius} strokeWidth={thickness} />
      <g transform="rotate(-90 50 50)">
        <circle
          className="progress-ring__arc"
          cx="50"
          cy="50"
          r={radius}
          pathLength={TURN}
          strokeWidth={thickness}
          stroke={`url(#${id}-fill)`}
          style={arc}
        />
      </g>
    </svg>
  );
}
