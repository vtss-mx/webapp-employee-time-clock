import { useCallback, useState } from 'react';
import { t } from '../i18n/core';
import { flashPacingService, sha256Hex } from '../services/flashPacingService';
import type { FaceChallenge } from '../types';
import type { FlashPace } from '../types/capture';
import { config } from '../utils/config';
import { sleep } from '../utils/waits';
import { useMountedRef } from './useMountedRef';

/** El destello se interrumpió: la pantalla dejó de verse (otra app, pantalla apagada) o se salió. */
export class FlashInterruptedError extends Error {
  constructor() {
    super();
    this.name = 'FlashInterruptedError';
    // El texto se lee en el idioma activo (como `localizedError`).
    Object.defineProperty(this, 'message', { get: () => t('face.flash.interrupted'), configurable: true, enumerable: false });
  }
}

/** Lo que dejó el destello: una captura por color (en orden) y, si lo dictó el servidor, su comprobante. */
export interface FlashTake {
  frames: Blob[];
  receipt?: string;
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
  /**
   * El destello de un reto, como lo pida: dictado por el servidor color por color (antifraude 2a) o con sus colores.
   * Sin canal en vivo, el de siempre con los colores de respaldo (el servidor solo lo anota). null si no se pudo
   * completar (cámara, pantalla oculta o sin colores): quien llama decide si pide otro reto.
   */
  play: (challenge: FaceChallenge, capture: () => Promise<Blob>) => Promise<FlashTake | null>;
}

interface Painting {
  color: string;
  index: number;
  total: number;
}

/**
 * Reto fotométrico ("destello de colores"): un rostro real frente a la pantalla refleja el color que
 * ella emite; un video inyectado o generado no conoce los colores (los elige el servidor en cada reto y, dictados,
 * los revela uno por uno: nadie puede preparar las capturas antes). Este hook solo pinta y captura; `FlashOverlay`
 * dibuja el color y el servidor lo mide. Cada color se ve al menos `faceFlashSettleMs` (≥ 340 ms): nunca más de 3
 * destellos por segundo (WCAG 2.3.1), también dictado (el siguiente llega después de capturar el anterior).
 */
export function useScreenFlash(): ScreenFlash {
  const [state, setState] = useState<Painting | null>(null);
  const mounted = useMountedRef();

  /** Pinta un color, espera a que la cámara lo vea y captura (lanza si la pantalla dejó de verse). */
  const shoot = useCallback(
    async (painting: Painting, capture: () => Promise<Blob>) => {
      setState(painting);
      await sleep(config.faceFlashSettleMs);
      if (!mounted.current || document.visibilityState === 'hidden') throw new FlashInterruptedError();
      return capture();
    },
    [mounted],
  );

  const run = useCallback(
    async (colors: string[], capture: () => Promise<Blob>) => {
      const frames: Blob[] = [];
      try {
        for (let index = 0; index < colors.length; index++) frames.push(await shoot({ color: colors[index], index, total: colors.length }, capture));
        return frames;
      } finally {
        setState(null);
      }
    },
    [shoot],
  );

  /** El destello dictado: cada color llega por el canal en vivo y se responde con la huella de su captura. */
  const paced = useCallback(
    async (pace: FlashPace, capture: () => Promise<Blob>): Promise<FlashTake> => {
      const frames: Blob[] = [];
      try {
        let step = await flashPacingService.step(pace.token);
        while (step.kind === 'color') {
          const frame = await shoot({ color: step.color, index: step.step, total: step.total }, capture);
          frames.push(frame);
          step = await flashPacingService.step(step.token, await sha256Hex(frame));
        }
        return { frames, receipt: step.receipt };
      } finally {
        setState(null);
      }
    },
    [shoot],
  );

  const play = useCallback(
    async (challenge: FaceChallenge, capture: () => Promise<Blob>): Promise<FlashTake | null> => {
      const pace = challenge.flash_pace;
      if (!pace) return run(challenge.flash, capture).then((frames) => ({ frames }), () => null);
      try {
        return await paced(pace, capture);
      } catch (error) {
        if (error instanceof FlashInterruptedError || !mounted.current) return null;
      }
      // Sin canal en vivo (o se cortó a la mitad): el destello de siempre, desde el principio.
      const colors = await flashPacingService.fallbackColors(pace.token).catch(() => null);
      return colors ? run(colors, capture).then((frames) => ({ frames }), () => null) : null;
    },
    [mounted, paced, run],
  );

  return { color: state?.color ?? null, index: state?.index ?? 0, total: state?.total ?? 0, run, play };
}
