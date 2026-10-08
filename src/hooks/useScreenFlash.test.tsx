import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FlashCaptures, FlashChallenge } from './useScreenFlash';
import { useScreenFlash } from './useScreenFlash';
import { config } from '../utils/config';

/*
 * Guía del destello dictado por el servidor: pinta cada color, captura un cuadro y lleva la secuencia por el canal; y la
 * degradación controlada (respaldo en claro) que nunca tumba la captura. El canal (`flashPacingService`) se simula.
 */

const service = vi.hoisted(() => ({ available: true, step: vi.fn(), fallbackColors: vi.fn() }));
vi.mock('../services/flashPacingService', () => ({ flashPacingService: service }));
// La huella se simula (un microtask, no WebCrypto): así los temporizadores simulados no esperan al motor de cifrado.
vi.mock('../utils/digest', () => ({ sha256Hex: () => Promise.resolve('a'.repeat(64)) }));

const HOLD = config.faceFlashHoldMs;
const PACE = { token: 't0', total: 2, window_ms: 2000 };
/** Cada captura es un cuadro nuevo (como la cámara real). */
const capture = () => Promise.resolve(new Blob(['frame']));
const color = (step: number, total: number, hex: string, token: string) => ({ done: false, color: { step, total, color: hex, token, window_ms: 2000 } });

beforeEach(() => {
  vi.useFakeTimers();
  service.available = true;
  service.step.mockReset();
  service.fallbackColors.mockReset();
});
afterEach(() => vi.useRealTimers());

/** Corre `run` y deja avanzar el reloj hasta que termina (cada color espera `HOLD`). */
async function runFlash(challenge: FlashChallenge) {
  const { result } = renderHook(() => useScreenFlash());
  let done: Promise<FlashCaptures> = Promise.resolve({});
  act(() => {
    done = result.current.run(challenge, capture);
  });
  await act(() => vi.advanceTimersByTimeAsync(HOLD * 6));
  return { result, done: await done };
}

describe('useScreenFlash: destello dictado por el servidor', () => {
  it('pinta cada color, lo captura, responde su huella y entrega el comprobante del último', async () => {
    service.step.mockResolvedValueOnce(color(0, 2, '#FF0000', 't1')).mockResolvedValueOnce(color(1, 2, '#00FF00', 't2')).mockResolvedValueOnce({ done: true, receipt: 'rcpt-1' });
    const { result, done } = await runFlash({ flash_pace: PACE, flash: [] });
    expect(done.flashImage).toHaveLength(2);
    expect(done.flashReceipt).toBe('rcpt-1');
    expect(result.current.color).toBeNull(); // deja de pintar al terminar
    // El primer color se pide sin huella; cada siguiente con la huella (SHA-256) y el token del paso anterior.
    expect(service.step).toHaveBeenNthCalledWith(1, 't0');
    expect(service.step.mock.calls[1][0]).toBe('t1');
    expect(service.step.mock.calls[1][1]).toMatch(/^[0-9a-f]{64}$/);
  });

  it('si el canal falla a media secuencia, cae al respaldo en claro (sin comprobante)', async () => {
    service.step.mockResolvedValueOnce(color(0, 2, '#FF0000', 't1')).mockRejectedValueOnce(new Error('REALTIME_TIMEOUT'));
    service.fallbackColors.mockResolvedValueOnce(['#111111', '#222222']);
    const { done } = await runFlash({ flash_pace: PACE, flash: [] });
    expect(service.fallbackColors).toHaveBeenCalledWith('t0');
    expect(done.flashImage).toHaveLength(2);
    expect(done.flashReceipt).toBeUndefined();
  });

  it('sin canal en vivo pide los colores de respaldo por HTTP y los pinta en claro', async () => {
    service.available = false;
    service.fallbackColors.mockResolvedValueOnce(['#333333']);
    const { done } = await runFlash({ flash_pace: PACE, flash: [] });
    expect(service.step).not.toHaveBeenCalled();
    expect(done.flashImage).toHaveLength(1);
    expect(done.flashReceipt).toBeUndefined();
  });

  it('si el respaldo HTTP tampoco responde, usa los colores que ya traía el reto', async () => {
    service.available = false;
    service.fallbackColors.mockRejectedValueOnce(new Error('offline'));
    const { done } = await runFlash({ flash_pace: PACE, flash: ['#444444', '#555555'] });
    expect(done.flashImage).toHaveLength(2);
  });
});

describe('useScreenFlash: destello en claro y sin destello', () => {
  it('el reto trae los colores (sin dictado): pinta cada uno y captura un cuadro, sin comprobante', async () => {
    const { done } = await runFlash({ flash_pace: null, flash: ['#AAAAAA', '#BBBBBB', '#CCCCCC'] });
    expect(service.step).not.toHaveBeenCalled();
    expect(service.fallbackColors).not.toHaveBeenCalled();
    expect(done.flashImage).toHaveLength(3);
    expect(done.flashReceipt).toBeUndefined();
  });

  it('sin destello dictado por el reto no pinta nada ni captura (devuelve vacío)', async () => {
    const { result, done } = await runFlash({ flash_pace: null, flash: [] });
    expect(done).toEqual({});
    expect(result.current.color).toBeNull();
    expect(service.step).not.toHaveBeenCalled();
    expect(service.fallbackColors).not.toHaveBeenCalled();
  });
});

describe('useScreenFlash: salir a media secuencia no deja estado colgado', () => {
  it('al desmontarse deja de pintar y la secuencia termina sin tocar el estado', async () => {
    service.step.mockResolvedValueOnce(color(0, 2, '#FF0000', 't1')).mockResolvedValueOnce(color(1, 2, '#00FF00', 't2')).mockResolvedValueOnce({ done: true, receipt: 'r' });
    const { result, unmount } = renderHook(() => useScreenFlash());
    let done: Promise<FlashCaptures> = Promise.resolve({});
    act(() => {
      done = result.current.run({ flash_pace: PACE, flash: [] }, capture);
    });
    await act(() => vi.advanceTimersByTimeAsync(0)); // primer color pintado
    expect(result.current.color).toBe('#FF0000');
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(HOLD * 4)); // continúa sin tocar el estado desmontado
    await expect(done).resolves.toMatchObject({ flashReceipt: 'r' });
  });
});
