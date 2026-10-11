import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../utils/config';
import { evaluateDocFrame, measureDocFrame, frameShift, type DocCheck } from '../utils/docQuality';
import { useDocumentScan } from './useDocumentScan';

// La medición y el veredicto reales viven en docQuality (con sus pruebas); aquí se controla el bucle.
vi.mock('../utils/docQuality', () => ({
  docGuideRegion: vi.fn(() => ({ x: 0, y: 0, width: 100, height: 60 })),
  measureDocFrame: vi.fn(),
  evaluateDocFrame: vi.fn(),
  frameShift: vi.fn(),
}));
const measure = vi.mocked(measureDocFrame);
const check = vi.mocked(evaluateDocFrame);
const shift = vi.mocked(frameShift);

function videoElement({ readyState = 4, width = 1280, height = 720 } = {}): HTMLVideoElement {
  const video = document.createElement('video');
  Object.defineProperty(video, 'readyState', { value: readyState, configurable: true });
  Object.defineProperty(video, 'videoWidth', { value: width, configurable: true });
  Object.defineProperty(video, 'videoHeight', { value: height, configurable: true });
  return video;
}

let pendingFrame: FrameRequestCallback | null;
let clock: number;

beforeEach(() => {
  pendingFrame = null;
  clock = 0;
  measure.mockReset().mockReturnValue({ quality: {} as never, gray: new Float32Array(4) });
  check.mockReset().mockReturnValue('ok');
  shift.mockReset().mockReturnValue(0);
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      pendingFrame = callback;
      return 7;
    }),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

/** Siguiente cuadro, `gap` ms después del anterior. */
const frame = (gap = 130) =>
  act(() => {
    clock += gap;
    pendingFrame?.(clock);
  });

function renderScan({ video = videoElement(), enabled = true, onAutoCapture = vi.fn() }: { video?: HTMLVideoElement | null; enabled?: boolean; onAutoCapture?: () => void } = {}) {
  const videoRef = { current: video };
  const view = renderHook((props: { enabled: boolean }) => useDocumentScan({ videoRef, onAutoCapture, ...props }), { initialProps: { enabled } });
  return { ...view, onAutoCapture };
}

describe('useDocumentScan: escáner de documento en vivo', () => {
  it('desactivado no abre el bucle', () => {
    renderScan({ enabled: false });
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('analiza a intervalos, no en cada cuadro', () => {
    renderScan();
    frame(100);
    expect(measure).not.toHaveBeenCalled();
    frame(100); // ya pasaron 200 ms desde el último procesado
    expect(measure).toHaveBeenCalledOnce();
  });

  it('sin imagen en el video no mide', () => {
    renderScan({ video: videoElement({ readyState: 1 }) });
    frame();
    renderScan({ video: null });
    frame();
    renderScan({ video: videoElement({ width: 0 }) });
    frame();
    expect(measure).not.toHaveBeenCalled();
  });

  it('un lienzo bloqueado (medición null) no rompe: sigue buscando', () => {
    measure.mockReturnValue(null);
    const { result } = renderScan();
    frame();
    expect(result.current.guidance).toBe('searching');
    expect(result.current.acceptable).toBe(false);
  });

  it('documento bien encuadrado y quieto: toma la foto sola UNA vez tras los cuadros estables', () => {
    const { result, onAutoCapture } = renderScan();
    for (let i = 0; i < config.docScanStableFrames - 1; i++) frame();
    expect(result.current.guidance).toBe('holdStill');
    expect(result.current.acceptable).toBe(true);
    expect(onAutoCapture).not.toHaveBeenCalled();
    frame(); // el cuadro estable número N
    expect(result.current.guidance).toBe('capturing');
    expect(onAutoCapture).toHaveBeenCalledOnce();
    const measured = measure.mock.calls.length;
    frame();
    frame();
    expect(measure).toHaveBeenCalledTimes(measured); // ya disparó: deja de medir
    expect(onAutoCapture).toHaveBeenCalledOnce();
  });

  it('un cuadro que sirve pero se mueve pide «Mantén firme» y no dispara', () => {
    shift.mockReturnValue(100); // supera docScanMaxShift
    const { result, onAutoCapture } = renderScan();
    for (let i = 0; i < config.docScanStableFrames + 2; i++) frame();
    expect(result.current.guidance).toBe('holdStill');
    expect(result.current.acceptable).toBe(true);
    expect(onAutoCapture).not.toHaveBeenCalled();
  });

  it('un cuadro borroso también pide «Mantén firme», pero sin servir', () => {
    check.mockReturnValue('blurry');
    const { result } = renderScan();
    frame();
    expect(result.current.guidance).toBe('holdStill');
    expect(result.current.acceptable).toBe(false);
  });

  it.each(['searching', 'tooFar', 'tooDark', 'tooBright', 'glare', 'straighten'] as const)('muestra la indicación «%s» tal cual', (code: DocCheck) => {
    check.mockReturnValue(code);
    const { result } = renderScan();
    frame();
    frame(); // dos cuadros iguales: la segunda no vuelve a cambiar el estado
    expect(result.current.guidance).toBe(code);
    expect(result.current.acceptable).toBe(false);
  });

  it('sin un cuadro válido, tras la espera habilita el obturador manual', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const { result } = renderScan();
      expect(result.current.stalled).toBe(false);
      act(() => {
        vi.advanceTimersByTime(config.docScanManualFallbackMs);
      });
      expect(result.current.stalled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('al desactivarse o salir deja de analizar', () => {
    const { rerender, unmount } = renderScan();
    frame();
    rerender({ enabled: false });
    expect(cancelAnimationFrame).toHaveBeenCalledWith(7);
    unmount();
  });
});
