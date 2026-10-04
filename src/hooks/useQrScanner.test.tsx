import { act, renderHook } from '@testing-library/react';
import jsQR from 'jsqr';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { useQrScanner } from './useQrScanner';

// jsQR simulado: decide qué "se lee" en cada cuadro. La lectura real se valida en navegador.
vi.mock('jsqr', () => ({ default: vi.fn() }));
const decode = vi.mocked(jsQR);

const PIXELS = new Uint8ClampedArray(16);

function videoElement({ readyState = 4, width = 1920, height = 1080 } = {}): HTMLVideoElement {
  const video = document.createElement('video');
  Object.defineProperty(video, 'readyState', { value: readyState, configurable: true });
  Object.defineProperty(video, 'videoWidth', { value: width, configurable: true });
  Object.defineProperty(video, 'videoHeight', { value: height, configurable: true });
  return video;
}

let pendingFrame: FrameRequestCallback | null;
let clock: number;
let draw: Mock;
let canvases: HTMLCanvasElement[];
let context: boolean;

beforeEach(() => {
  pendingFrame = null;
  clock = 0;
  canvases = [];
  context = true;
  draw = vi.fn();
  decode.mockReset().mockReturnValue(null);
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      pendingFrame = callback;
      return 3;
    }),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    canvases.push(this);
    return context ? ({ drawImage: draw, getImageData: (_x: number, _y: number, width: number, height: number) => ({ data: PIXELS, width, height }) } as unknown as CanvasRenderingContext2D) : null;
  });
});
afterEach(() => vi.unstubAllGlobals());

/** Siguiente cuadro del video, `gap` ms después del anterior. */
const frame = (gap = 200) =>
  act(() => {
    clock += gap;
    pendingFrame?.(clock);
  });

const qr = (data: string) => ({ data }) as ReturnType<typeof jsQR>;

function renderScanner({ video = videoElement(), enabled = true, onDetect = vi.fn() }: { video?: HTMLVideoElement | null; enabled?: boolean; onDetect?: (content: string) => void } = {}) {
  const videoRef = { current: video };
  const view = renderHook((props: { enabled: boolean; onDetect: (content: string) => void }) => useQrScanner({ videoRef, ...props }), { initialProps: { enabled, onDetect } });
  return { ...view, onDetect };
}

describe('useQrScanner', () => {
  it('lee el código de un cuadro reducido (menos CPU en teléfonos) y lo entrega una sola vez', () => {
    const { onDetect } = renderScanner();
    frame();
    expect(onDetect).not.toHaveBeenCalled(); // aún sin código a la vista
    decode.mockReturnValue(qr('TCQR2:abc'));
    frame();
    expect([canvases[0]?.width, canvases[0]?.height]).toEqual([800, 450]);
    expect(draw).toHaveBeenLastCalledWith(expect.any(HTMLVideoElement), 0, 0, 800, 450);
    expect(decode).toHaveBeenLastCalledWith(PIXELS, 800, 450, { inversionAttempts: 'dontInvert' });
    expect(onDetect).toHaveBeenCalledExactlyOnceWith('TCQR2:abc');
    frame();
    frame();
    expect(decode).toHaveBeenCalledTimes(2); // leído: deja de analizar
    expect(onDetect).toHaveBeenCalledOnce();
  });

  it('un video pequeño no se agranda; un código vacío no cuenta', () => {
    decode.mockReturnValue(qr(''));
    const { onDetect } = renderScanner({ video: videoElement({ width: 640, height: 480 }) });
    frame();
    expect([canvases[0]?.width, canvases[0]?.height]).toEqual([640, 480]);
    expect(onDetect).not.toHaveBeenCalled();
  });

  it('analiza a intervalos, no en cada cuadro', () => {
    renderScanner();
    frame(100);
    expect(decode).not.toHaveBeenCalled();
    frame(100);
    expect(decode).toHaveBeenCalledOnce();
  });

  it('sin imagen en el video (o sin canvas) espera sin leer', () => {
    renderScanner({ video: null });
    frame();
    renderScanner({ video: videoElement({ readyState: 1 }) });
    frame();
    renderScanner({ video: videoElement({ width: 0 }) });
    frame();
    context = false;
    renderScanner();
    frame();
    expect(decode).not.toHaveBeenCalled();
  });

  it('usa el manejador más reciente y deja de leer al desactivarse o salir', () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender, unmount } = renderScanner({ onDetect: first });
    rerender({ enabled: true, onDetect: latest });
    decode.mockReturnValue(qr('TCQR2:xyz'));
    frame();
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledWith('TCQR2:xyz');

    rerender({ enabled: false, onDetect: latest });
    expect(cancelAnimationFrame).toHaveBeenCalledWith(3);
    unmount();
  });

  it('desactivado no abre el lector', () => {
    renderScanner({ enabled: false });
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });
});
