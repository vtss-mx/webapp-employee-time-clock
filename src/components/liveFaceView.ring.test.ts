import { describe, expect, it } from 'vitest';
import { NO_LIVENESS, TWO_TURNS } from '../test/faceFlow';
import type { FaceChallenge } from '../types';
import { config } from '../utils/config';
import { capturePlan, captureProgress, enrollmentCapture, type CapturePlan, type RingInput } from './liveFaceView';

/*
 * El anillo de 36 marcas (decisión del dueño, 2026-10-06): un solo avance para todo el escaneo, contado en fotos.
 */
const BURST = { tile: 160, hold: 26, move: 10, fps: 10, quality: 0.85, margin: 1.6, max_bytes: 524288, min_frames: 6 };
const LIVE: FaceChallenge = { ...TWO_TURNS, flash: ['#FF0000', '#00FF00', '#0000FF'], burst: BURST };

const ring = (plan: CapturePlan | null, input: Partial<RingInput>) =>
  captureProgress({ phase: 'checking', plan, photos: 0, light: 0, flash: { index: 0, total: 0 }, step: 0, moveProgress: 0, ...input });

describe('capturePlan: cuántas fotos pide el escaneo', () => {
  it('verificación: las de frente, las ligeras del tramo quieto, una por color y los movimientos con sus recortes', () => {
    expect(capturePlan(LIVE, 3, false)).toEqual({ still: 3, light: 26, flash: 3, moves: 12, steps: 2 });
  });

  it('registro: las 36 completas (las ligeras van a la par y no se cuentan dos veces)', () => {
    expect(capturePlan(LIVE, 36, true)).toEqual({ still: 36, light: 0, flash: 3, moves: 12, steps: 2 });
  });

  it('destello dictado por el servidor (sin colores en el reto), sin destello y sin ráfaga', () => {
    const paced = { ...LIVE, flash: [], flash_pace: { token: 't', total: 4, window_ms: 1500 } };
    expect(capturePlan(paced, 3, false).flash).toBe(4);
    expect(capturePlan({ ...LIVE, flash: [], burst: null }, 3, false)).toEqual({ still: 3, light: 0, flash: 0, moves: 2, steps: 2 });
  });

  it('sin prueba de vida: solo las fotos de frente (aunque el reto traiga algo más)', () => {
    expect(capturePlan({ ...NO_LIVENESS, burst: BURST, flash: ['#FF0000'] }, 3, false)).toEqual({ still: 3, light: 0, flash: 0, moves: 0, steps: 0 });
  });

  it('las fotos del registro salen de la configuración (cuántas, su tamaño y su pausa)', () => {
    expect(enrollmentCapture()).toEqual({
      frontalFrames: config.enrollmentFrames,
      frontalPhoto: { maxSide: config.enrollmentPhotoPx, gapMs: config.enrollmentPhotoGapMs },
    });
    expect(config.enrollmentFrames).toBe(36);
  });
});

describe('captureProgress: el anillo avanza por todo el proceso', () => {
  const plan = capturePlan(LIVE, 3, false); // 3 + 26 + 3 + 12 = 44 fotos

  it('vacío mientras se alinea el rostro o si el reto aún no llega; completo al enviar', () => {
    expect(ring(plan, { phase: 'frontal', photos: 3 })).toBe(0);
    expect(ring(null, { photos: 3, light: 10 })).toBe(0);
    expect(ring(null, { phase: 'submitting' })).toBe(1);
  });

  it('frente: fotos completas y ligeras, cada una con su tope', () => {
    expect(ring(plan, { photos: 2, light: 9 })).toBeCloseTo(11 / 44);
    expect(ring(plan, { photos: 9, light: 99 })).toBeCloseTo(29 / 44);
    // Un reto que se vuelve a pedir conserva lo ya tomado (el bloqueo no lo borra).
    expect(ring(plan, { phase: 'blocked', photos: 3, light: 26 })).toBeCloseTo(29 / 44);
  });

  it('destello: cada color capturado suma una foto', () => {
    expect(ring(plan, { phase: 'flash', flash: { index: 2, total: 3 } })).toBeCloseTo(31 / 44);
    expect(ring(plan, { phase: 'flash', flash: { index: 9, total: 3 } })).toBeCloseTo(32 / 44);
  });

  it('movimientos: sigue a la cabeza en el que va y cuenta los ya hechos al volver al frente', () => {
    expect(ring(plan, { phase: 'challenge', step: 0, moveProgress: 0.5 })).toBeCloseTo((32 + 3) / 44);
    expect(ring(plan, { phase: 'recenter', step: 1, moveProgress: 0.9 })).toBeCloseTo((32 + 6) / 44);
    expect(ring(plan, { phase: 'challenge', step: 1, moveProgress: 1 })).toBe(1);
    expect(ring(plan, { phase: 'challenge', step: 5, moveProgress: 1 })).toBe(1); // nunca pasa de lleno
  });

  it('un reto sin movimientos no divide entre cero', () => {
    const still = capturePlan(NO_LIVENESS, 3, false);
    expect(ring(still, { phase: 'challenge', step: 0, moveProgress: 0.5 })).toBe(1);
    expect(ring(still, { photos: 1 })).toBeCloseTo(1 / 3);
  });
});
