import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../utils/config';
import { FlashInterruptedError, useScreenFlash } from './useScreenFlash';

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
