import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as pacing from '../services/flashPacingService';
import { NO_LIVENESS } from '../test/faceFlow';
import type { FaceChallenge } from '../types';
import { config } from '../utils/config';
import { FlashInterruptedError, useScreenFlash, type FlashTake } from './useScreenFlash';

/** Destello de colores: pinta cada color, espera a que la cámara lo vea y captura un cuadro. */
const settle = config.faceFlashSettleMs;
const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

let frames: Blob[];
const capture = vi.fn(() => {
  const blob = new Blob([`cuadro-${frames.length + 1}`]);
  frames.push(blob);
  return Promise.resolve(blob);
});

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
}

beforeEach(() => {
  vi.useFakeTimers();
  frames = [];
  capture.mockClear();
});
afterEach(() => {
  setVisibility('visible');
  vi.useRealTimers();
});

describe('useScreenFlash', () => {
  it('pinta cada color, espera lo configurado y captura uno por color, en orden; al terminar quita el color', async () => {
    const { result } = renderHook(() => useScreenFlash());
    expect(result.current).toMatchObject({ color: null, index: 0, total: 0 });
    let done: Promise<Blob[]> = Promise.resolve([]);
    act(() => {
      done = result.current.run(['#FF0000', '#00FF00', '#0000FF'], capture);
    });
    expect(result.current).toMatchObject({ color: '#FF0000', index: 0, total: 3 });
    await wait(settle - 1);
    expect(capture).not.toHaveBeenCalled(); // la cámara aún no ve el color
    await wait(1);
    expect(capture).toHaveBeenCalledOnce();
    expect(result.current).toMatchObject({ color: '#00FF00', index: 1, total: 3 });
    await wait(settle);
    expect(result.current.color).toBe('#0000FF');
    await wait(settle);
    await expect(done).resolves.toEqual(frames);
    expect(frames).toHaveLength(3);
    expect(result.current).toMatchObject({ color: null, index: 0, total: 0 });
  });

  it('si la pantalla deja de verse (otra app, pantalla apagada) se interrumpe sin capturar y quita el color', async () => {
    const { result } = renderHook(() => useScreenFlash());
    let done: Promise<Blob[]> = Promise.resolve([]);
    act(() => {
      done = result.current.run(['#FF0000', '#00FF00'], capture);
    });
    const outcome = expect(done).rejects.toBeInstanceOf(FlashInterruptedError);
    setVisibility('hidden');
    await wait(settle);
    await outcome;
    await expect(done).rejects.toThrow('El destello de colores se interrumpió'); // su texto, en el idioma activo
    expect(capture).not.toHaveBeenCalled();
    expect(result.current.color).toBeNull();
  });

  it('una falla de la cámara sube tal cual; al salir de la pantalla a medio destello se interrumpe', async () => {
    const { result, unmount } = renderHook(() => useScreenFlash());
    const broken = vi.fn(() => Promise.reject(new Error('sin imagen')));
    let done: Promise<Blob[]> = Promise.resolve([]);
    act(() => {
      done = result.current.run(['#FF0000'], broken);
    });
    const failed = expect(done).rejects.toThrow('sin imagen');
    await wait(settle);
    await failed;

    act(() => {
      done = result.current.run(['#FF0000'], capture);
    });
    const interrupted = expect(done).rejects.toBeInstanceOf(FlashInterruptedError);
    unmount();
    await wait(settle);
    await interrupted;
    expect(capture).not.toHaveBeenCalled();
  });
});


describe('useScreenFlash: el destello de un reto (antifraude 2a)', () => {
  const PACED: FaceChallenge = { ...NO_LIVENESS, flash: [], flash_pace: { token: 't0', total: 2, window_ms: 2000 } };

  beforeEach(() => {
    vi.spyOn(pacing, 'sha256Hex').mockImplementation((blob: Blob) => blob.text());
  });
  afterEach(() => vi.restoreAllMocks());

  function play(challenge: FaceChallenge) {
    const { result, unmount } = renderHook(() => useScreenFlash());
    let done: Promise<FlashTake | null> = Promise.resolve(null);
    act(() => {
      done = result.current.play(challenge, capture);
    });
    return { result, done: () => done, unmount };
  }

  it('dictado: pinta cada color que revela el servidor, responde con la huella de su captura y guarda el comprobante', async () => {
    const step = vi.spyOn(pacing.flashPacingService, 'step');
    step
      .mockResolvedValueOnce({ kind: 'color', color: '#FF0000', token: 't1', step: 0, total: 2 })
      .mockResolvedValueOnce({ kind: 'color', color: '#00FFFF', token: 't2', step: 1, total: 2 })
      .mockResolvedValueOnce({ kind: 'done', receipt: 'comprobante' });
    const { result, done } = play(PACED);
    await wait(0);
    expect(result.current).toMatchObject({ color: '#FF0000', index: 0, total: 2 });
    await wait(settle);
    expect(result.current).toMatchObject({ color: '#00FFFF', index: 1, total: 2 });
    await wait(settle);
    await expect(done()).resolves.toEqual({ frames, receipt: 'comprobante' });
    expect(step.mock.calls).toEqual([['t0'], ['t1', 'cuadro-1'], ['t2', 'cuadro-2']]);
    expect(result.current.color).toBeNull();
  });

  it('sin canal en vivo usa los colores de siempre; si tampoco llegan, no hay destello', async () => {
    vi.spyOn(pacing.flashPacingService, 'step').mockRejectedValue(new Error('Canal en tiempo real no disponible'));
    const fallback = vi.spyOn(pacing.flashPacingService, 'fallbackColors').mockResolvedValueOnce(['#FF0000', '#0000FF']);
    const first = play(PACED);
    await wait(settle * 2);
    await expect(first.done()).resolves.toEqual({ frames });
    expect(fallback).toHaveBeenCalledWith('t0');
    fallback.mockRejectedValueOnce(new Error('sin red'));
    const second = play(PACED);
    await wait(0);
    await expect(second.done()).resolves.toBeNull();
    // Con los colores de respaldo, pero la cámara falla en el destello de siempre: no hay destello.
    fallback.mockResolvedValueOnce(['#FF0000']);
    const broken = renderHook(() => useScreenFlash());
    let failed: Promise<FlashTake | null> = Promise.resolve(null);
    act(() => {
      failed = broken.result.current.play(PACED, () => Promise.reject(new Error('sin imagen')));
    });
    await wait(settle);
    await expect(failed).resolves.toBeNull();
  });

  it('si la pantalla deja de verse a media secuencia no se usa el respaldo; los colores en el reto siguen como antes', async () => {
    vi.spyOn(pacing.flashPacingService, 'step').mockResolvedValue({ kind: 'color', color: '#FF0000', token: 't1', step: 0, total: 2 });
    const fallback = vi.spyOn(pacing.flashPacingService, 'fallbackColors');
    const hidden = play(PACED);
    setVisibility('hidden');
    await wait(settle);
    await expect(hidden.done()).resolves.toBeNull();
    expect(fallback).not.toHaveBeenCalled();
    setVisibility('visible');
    const leaving = play(PACED);
    leaving.unmount(); // se salió de la pantalla: la falla de la cámara ya no lleva al respaldo
    await wait(settle);
    await expect(leaving.done()).resolves.toBeNull();
    expect(fallback).not.toHaveBeenCalled();
    const fixed = play({ ...NO_LIVENESS, flash: ['#FF0000'] });
    await wait(settle);
    await expect(fixed.done()).resolves.toEqual({ frames: [frames[frames.length - 1]] });
    const broken = renderHook(() => useScreenFlash());
    let failed: Promise<FlashTake | null> = Promise.resolve(null);
    act(() => {
      failed = broken.result.current.play({ ...NO_LIVENESS, flash: ['#FF0000'] }, () => Promise.reject(new Error('sin imagen')));
    });
    await wait(settle);
    await expect(failed).resolves.toBeNull();
  });
});
