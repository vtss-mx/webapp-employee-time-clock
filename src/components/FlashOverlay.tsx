import type { CSSProperties } from 'react';
import { config } from '../utils/config';

/**
 * Capa de color a toda pantalla del destello dictado por el servidor (antifraude 2a): pinta UN color sólido mientras
 * se captura su cuadro. Restaurada el 2026-10-08 como parte del interruptor del ADMIN (apagado por omisión): solo se
 * dibuja cuando el reto dictó un destello; sin color (`color = null`) no renderiza nada, así el flujo por omisión jamás
 * pinta un color.
 *
 * Es DECORATIVA (`aria-hidden`): el color no comunica nada a un lector de pantalla (la indicación va en el aviso en vivo
 * del visor). El cambio de color es INSTANTÁNEO —sin transición ni animación (AGENTS §visor «enterprise»: nada de
 * `transition`/`animation` en `.flash*`)—, lo que respeta `prefers-reduced-motion` por construcción: no hay movimiento
 * que reducir. La luminancia (`config.faceFlashLuminance`) atenúa el color para un aspecto sobrio sin cambiar su
 * cromaticidad, que es lo que mide el servidor.
 */
export function FlashOverlay({ color }: { color: string | null }) {
  if (!color) return null;
  return <div className="flash" aria-hidden style={{ '--flash-color': dim(color, config.faceFlashLuminance) } as CSSProperties} />;
}

/** `#RRGGBB` atenuado por la luminancia (0..1) a un `rgb(...)`; un color que no es `#RRGGBB` se usa tal cual. */
function dim(hex: string, luminance: number): string {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return hex;
  const channel = (part: string) => Math.round(parseInt(part, 16) * luminance);
  return `rgb(${channel(match[1])}, ${channel(match[2])}, ${channel(match[3])})`;
}
