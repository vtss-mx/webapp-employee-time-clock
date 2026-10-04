import { useCallback, useState } from 'react';
import { config } from '../utils/config';
import { sleep } from '../utils/waits';
import { useMountedRef } from './useMountedRef';

/** El destello se interrumpió: la pantalla dejó de verse (otra app, pantalla apagada) o se salió. */
export class FlashInterruptedError extends Error {
  constructor() {
    super('El destello de colores se interrumpió');
    this.name = 'FlashInterruptedError';
  }
}

export interface ScreenFlash {
  /** Color que se pinta ahora ('#RRGGBB'); null = sin destello. */
  color: string | null;
  /** Color en curso (0 = el primero) y cuántos son. */
  index: number;
  total: number;
  /**
   * Pinta cada color a pantalla completa, espera `config.faceFlashSettleMs` (la cámara ya ve el color
   * y el balance de blancos aún no lo compensa) y captura un cuadro. Devuelve una captura por color,
   * en orden. Lanza si la cámara falla o la pantalla deja de verse: esa captura ya no reflejaría el
   * color pintado.
   */
  run: (colors: string[], capture: () => Promise<Blob>) => Promise<Blob[]>;
}

/**
 * Reto fotométrico ("destello de colores"): un rostro real frente a la pantalla refleja el color que
 * ella emite; un video inyectado o generado no conoce los colores (los elige el servidor en cada reto).
 * Este hook solo pinta y captura; `FlashOverlay` dibuja el color y el servidor lo mide.
 */
export function useScreenFlash(): ScreenFlash {
  const [state, setState] = useState<{ colors: string[]; index: number } | null>(null);
  const mounted = useMountedRef();

  const run = useCallback(
    async (colors: string[], capture: () => Promise<Blob>) => {
      const frames: Blob[] = [];
      try {
        for (let index = 0; index < colors.length; index++) {
          setState({ colors, index });
          await sleep(config.faceFlashSettleMs);
          if (!mounted.current || document.visibilityState === 'hidden') throw new FlashInterruptedError();
          frames.push(await capture());
        }
        return frames;
      } finally {
        setState(null);
      }
    },
    [mounted],
  );

  return { color: state ? state.colors[state.index] : null, index: state?.index ?? 0, total: state?.colors.length ?? 0, run };
}
