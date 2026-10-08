import { useCallback, useState } from 'react';
import { flashPacingService } from '../services/flashPacingService';
import type { FlashPace } from '../types';
import { config } from '../utils/config';
import { sha256Hex } from '../utils/digest';
import { sleep } from '../utils/waits';
import { useMountedRef } from './useMountedRef';

/** Lo que el reto dictó para el destello: la secuencia dictada por el servidor (`flash_pace`) y los colores de respaldo (`flash`). */
export interface FlashChallenge {
  flash_pace?: FlashPace | null;
  flash: string[];
}

/** Las capturas del destello para el envío (mismos nombres que el multipart): un cuadro por color y, si fue dictado, el comprobante. */
export interface FlashCaptures {
  flashImage?: Blob[];
  flashReceipt?: string;
}

/** Lo que la guía del destello entrega al flujo: el color a pintar a toda pantalla (null = nada) y cómo correr la secuencia. */
export interface ScreenFlash {
  color: string | null;
  run: (challenge: FlashChallenge, capture: () => Promise<Blob>) => Promise<FlashCaptures>;
}

type Painter = (hex: string) => Promise<Blob>;

/** El destello DICTADO: cada color por el canal, un cuadro, su huella y el siguiente; tras el último, el comprobante. */
async function dictated(token: string, paint: Painter): Promise<{ images: Blob[]; receipt: string }> {
  const images: Blob[] = [];
  let result = await flashPacingService.step(token);
  while (!result.done) {
    const frame = await paint(result.color.color);
    images.push(frame);
    result = await flashPacingService.step(result.color.token, await sha256Hex(frame));
  }
  return { images, receipt: result.receipt };
}

/** El destello en CLARO (respaldo sin canal o el modo de respaldo del reto): un cuadro por color, sin comprobante. */
async function open(colors: string[], paint: Painter): Promise<Blob[]> {
  const images: Blob[] = [];
  for (const hex of colors) images.push(await paint(hex));
  return images;
}

/** La secuencia completa: dictada por el canal si se puede; si no, o si falla a media secuencia, el respaldo en claro. */
async function collect(pace: FlashPace, colors: string[], paint: Painter): Promise<FlashCaptures> {
  if (flashPacingService.available) {
    try {
      const { images, receipt } = await dictated(pace.token, paint);
      return { flashImage: images, flashReceipt: receipt };
    } catch {
      /* el canal no está disponible o falló a media secuencia: se pinta el respaldo en claro */
    }
  }
  const backup = await flashPacingService.fallbackColors(pace.token).catch(() => colors);
  return { flashImage: await open(backup, paint) };
}

/**
 * Guía del destello dictado por el servidor (antifraude 2a; restaurada el 2026-10-08 como interruptor del ADMIN, apagado
 * por omisión): pinta cada color a toda pantalla (`FlashOverlay`, con `color`), captura un cuadro y lleva la secuencia
 * por el canal en vivo (`flashPacingService`), con el comprobante al final. Sin destello dictado por el reto devuelve
 * vacío (el camino por omisión no pinta nada). Degradación controlada (nunca tumba la captura): si el canal no está
 * disponible o falla a media secuencia, pide los colores de respaldo por HTTP y los pinta en claro (sin comprobante); si
 * tampoco responde, usa los que traía el reto. Cada color espera `config.faceFlashHoldMs` tras pintarse (latencia de la
 * cámara) antes de capturar: es el tope por color, bajo el límite de 3 destellos/s (WCAG 2.3.1). Al terminar (o al
 * desmontar) deja de pintar (`color = null`).
 */
export function useScreenFlash(): ScreenFlash {
  const [color, setColor] = useState<string | null>(null);
  const mounted = useMountedRef();

  const run = useCallback(
    async (challenge: FlashChallenge, capture: () => Promise<Blob>): Promise<FlashCaptures> => {
      if (!challenge.flash_pace && challenge.flash.length === 0) return {};
      const paint: Painter = async (hex) => {
        if (mounted.current) setColor(hex);
        await sleep(config.faceFlashHoldMs);
        return capture();
      };
      try {
        if (challenge.flash_pace) return await collect(challenge.flash_pace, challenge.flash, paint);
        return { flashImage: await open(challenge.flash, paint) };
      } finally {
        if (mounted.current) setColor(null);
      }
    },
    [mounted],
  );

  return { color, run };
}
