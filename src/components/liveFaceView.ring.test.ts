import { describe, expect, it } from 'vitest';
import { NO_LIVENESS, TWO_TURNS } from '../test/faceFlow';
import type { FaceChallenge } from '../types';
import { config } from '../utils/config';
import { captureDetail, capturePlan, captureProgress, detectorActive, enrollmentCapture, SCANNING_PHASES, type CapturePlan, type RingInput } from './liveFaceView';

/*
 * El anillo (decisión del dueño, 2026-10-06): un solo avance para todo el escaneo, contado en fotos.
 */
const BURST = { tile: 160, hold: 26, move: 10, fps: 10, quality: 0.85, margin: 1.6, max_bytes: 524288, min_frames: 6 };
const LIVE: FaceChallenge = { ...TWO_TURNS, burst: BURST };

const ring = (plan: CapturePlan | null, input: Partial<RingInput>) =>
  captureProgress({ phase: 'checking', plan, photos: 0, light: 0, step: 0, moveProgress: 0, ...input });

describe('capturePlan: cuántas fotos pide el escaneo', () => {
  it('verificación: las de frente, las ligeras del tramo quieto y los movimientos con sus recortes', () => {
    expect(capturePlan(LIVE, 3, false)).toEqual({ still: 3, light: 26, moves: 12, steps: 2 });
  });

  it('registro: las fotos válidas completas (las ligeras van a la par y no se cuentan dos veces)', () => {
    expect(capturePlan(LIVE, 32, true)).toEqual({ still: 32, light: 0, moves: 12, steps: 2 });
  });

  it('los colores del destello no cuentan en el anillo (corren tras llenarlo); sin ráfaga, solo una foto por movimiento', () => {
    expect(capturePlan({ ...LIVE, flash: ['#FF0000', '#00FF00'], flash_pace: { token: 't', total: 4, window_ms: 1500 } }, 3, false)).toEqual({ still: 3, light: 26, moves: 12, steps: 2 });
    expect(capturePlan({ ...LIVE, burst: null }, 3, false)).toEqual({ still: 3, light: 0, moves: 2, steps: 2 });
  });

  it('sin prueba de vida: solo las fotos de frente (aunque el reto traiga algo más)', () => {
    expect(capturePlan({ ...NO_LIVENESS, burst: BURST, flash: ['#FF0000'] }, 3, false)).toEqual({ still: 3, light: 0, moves: 0, steps: 0 });
  });

  it('las fotos del registro salen de la configuración (cuántas, su tamaño y su pausa)', () => {
    expect(enrollmentCapture()).toEqual({
      frontalFrames: config.enrollmentValidPhotos,
      frontalPhoto: { maxSide: config.enrollmentPhotoPx, gapMs: config.enrollmentPhotoGapMs },
    });
    expect(config.enrollmentValidPhotos).toBe(32);
  });
});

describe('captureProgress: el anillo avanza por todo el proceso', () => {
  const plan = capturePlan(LIVE, 3, false); // 3 + 26 + 12 = 41 fotos

  it('vacío mientras se alinea el rostro o si el reto aún no llega; completo al enviar', () => {
    expect(ring(plan, { phase: 'frontal', photos: 3 })).toBe(0);
    expect(ring(null, { photos: 3, light: 10 })).toBe(0);
    expect(ring(null, { phase: 'submitting' })).toBe(1);
  });

  it('frente: fotos completas y ligeras, cada una con su tope', () => {
    expect(ring(plan, { photos: 2, light: 9 })).toBeCloseTo(11 / 41);
    expect(ring(plan, { photos: 9, light: 99 })).toBeCloseTo(29 / 41);
    // Un reto que se vuelve a pedir conserva lo ya tomado (el bloqueo no lo borra).
    expect(ring(plan, { phase: 'blocked', photos: 3, light: 26 })).toBeCloseTo(29 / 41);
  });

  it('movimientos: sigue a la cabeza en el que va y cuenta los ya hechos al volver al frente', () => {
    expect(ring(plan, { phase: 'challenge', step: 0, moveProgress: 0.5 })).toBeCloseTo((29 + 3) / 41);
    expect(ring(plan, { phase: 'recenter', step: 1, moveProgress: 0.9 })).toBeCloseTo((29 + 6) / 41);
    expect(ring(plan, { phase: 'challenge', step: 1, moveProgress: 1 })).toBe(1);
    expect(ring(plan, { phase: 'challenge', step: 5, moveProgress: 1 })).toBe(1); // nunca pasa de lleno
  });

  it('un reto sin movimientos no divide entre cero', () => {
    const still = capturePlan(NO_LIVENESS, 3, false);
    expect(ring(still, { phase: 'challenge', step: 0, moveProgress: 0.5 })).toBe(1);
    expect(ring(still, { photos: 1 })).toBeCloseTo(1 / 3);
  });
});

describe('detectorActive y captureDetail: el registro revisa cada foto en vivo y cuenta solo las válidas', () => {
  it('el detector lee en las fases del escaneo y, en el registro, también mientras se toman las fotos', () => {
    expect([...SCANNING_PHASES]).toEqual(['frontal', 'challenge', 'recenter']);
    expect(detectorActive('frontal', false)).toBe(true);
    expect(detectorActive('recenter', true)).toBe(true);
    expect(detectorActive('checking', true)).toBe(true);
    expect(detectorActive('checking', false)).toBe(false);
    expect(detectorActive('submitting', true)).toBe(false);
  });

  it('la cuenta: «Capturas válidas: 75 %» en el registro, «Foto 2 de 3» en una verificación', () => {
    expect(captureDetail({ current: 24, total: 32 }, true)).toBe('Capturas válidas: 75 %');
    expect(captureDetail({ current: 0, total: 0 }, true)).toBe('Capturas válidas: 0 %'); // sin total aún: 0 % (no divide entre cero)
    expect(captureDetail({ current: 2, total: 3 }, false)).toBe('Foto 2 de 3');
    expect(captureDetail(null, true)).toBeNull();
  });
});
