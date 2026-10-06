import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextVideoFrame } from './videoFrames';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Un video con `requestVideoFrameCallback` simulado: la prueba entrega el cuadro nuevo cuando quiere. */
function video() {
  const frame: { deliver: () => void } = { deliver: () => undefined };
  const element = {
    requestVideoFrameCallback: vi.fn((callback: () => void) => {
      frame.deliver = callback;
      return 9;
    }),
    cancelVideoFrameCallback: vi.fn(),
  };
  return { element: element as unknown as HTMLVideoElement, frame, raw: element };
}

describe('nextVideoFrame: un cuadro NUEVO del video antes de la siguiente foto', () => {
  it('sin video o sin requestVideoFrameCallback no espera (la pausa entre fotos da el ritmo)', async () => {
    await expect(nextVideoFrame(null, 500)).resolves.toBeUndefined();
    await expect(nextVideoFrame({} as HTMLVideoElement, 500)).resolves.toBeUndefined();
  });

  it('se resuelve con el cuadro nuevo y ya no espera el tope', async () => {
    const { element, frame, raw } = video();
    let resolved = false;
    const waiting = nextVideoFrame(element, 500).then(() => (resolved = true));
    await vi.advanceTimersByTimeAsync(10);
    expect(resolved).toBe(false);
    frame.deliver();
    await waiting;
    expect(resolved).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(raw.cancelVideoFrameCallback).not.toHaveBeenCalled();
  });

  it('una cámara congelada no la deja colgada: al agotarse el tope sigue y deja de esperar el cuadro', async () => {
    const { element, raw } = video();
    const waiting = nextVideoFrame(element, 300);
    await vi.advanceTimersByTimeAsync(300);
    await expect(waiting).resolves.toBeUndefined();
    expect(raw.cancelVideoFrameCallback).toHaveBeenCalledWith(9);
  });
});
