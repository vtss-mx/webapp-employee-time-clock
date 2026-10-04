import type { Detection, FaceDetector } from '@mediapipe/tasks-vision';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { face, videoElement } from '../test/faces';
import { useFaceAutoCapture, type DetectionMode } from './useFaceDetection';

/*
 * MediaPipe simulado: el detector real (WASM) se valida en navegador; aquí, la carga (local, respaldo
 * remoto, tiempo agotado) y cómo se convierte lo que detecta en la guía que ve la persona.
 */
const vision = vi.hoisted(() => ({ forVisionTasks: vi.fn(), createFromOptions: vi.fn() }));
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: vision.forVisionTasks },
  FaceDetector: { createFromOptions: vision.createFromOptions },
}));

const FILESET = { wasm: 'fileset' };
const DETECTOR = { detectForVideo: vi.fn() } as unknown as FaceDetector;

/** Módulo nuevo (sin el detector compartido de otra prueba) con su configuración. */
async function freshModule() {
  vi.resetModules();
  const module = await import('./useFaceDetection');
  const { config: freshConfig } = await import('../utils/config');
  return { ...module, config: freshConfig };
}

beforeEach(() => {
  vision.forVisionTasks.mockReset().mockResolvedValue(FILESET);
  vision.createFromOptions.mockReset().mockResolvedValue(DETECTOR);
});
afterEach(() => vi.useRealTimers());

describe('loadFaceDetector: carga del modelo', () => {
  it('carga el detector una sola vez (WASM y modelo locales, CPU, modo video) y lo comparte entre pantallas', async () => {
    const { loadFaceDetector, config: cfg } = await freshModule();
    const first = loadFaceDetector();
    expect(loadFaceDetector()).toBe(first);
    await expect(first).resolves.toBe(DETECTOR);
    expect(vision.forVisionTasks).toHaveBeenCalledWith(cfg.mediapipeWasmUrl);
    expect(vision.createFromOptions).toHaveBeenCalledExactlyOnceWith(FILESET, {
      baseOptions: { modelAssetPath: cfg.faceModelUrl, delegate: 'CPU' },
      runningMode: 'VIDEO',
      minDetectionConfidence: 0.5,
    });
  });

  it('si el modelo local no carga, usa el respaldo remoto', async () => {
    const { loadFaceDetector, config: cfg } = await freshModule();
    vision.createFromOptions.mockRejectedValueOnce(new Error('404 modelo'));
    await expect(loadFaceDetector()).resolves.toBe(DETECTOR);
    expect(vision.createFromOptions).toHaveBeenLastCalledWith(FILESET, expect.objectContaining({ baseOptions: { modelAssetPath: cfg.faceModelFallbackUrl, delegate: 'CPU' } }));
  });

  it('sin respaldo habilitado, la falla del modelo local se informa y el siguiente intento vuelve a cargar', async () => {
    const { loadFaceDetector, config: cfg } = await freshModule();
    Object.assign(cfg, { faceModelFallbackEnabled: false });
    vision.createFromOptions.mockRejectedValueOnce(new Error('404 modelo'));
    await expect(loadFaceDetector()).rejects.toThrow('404 modelo');
    expect(vision.createFromOptions).toHaveBeenCalledOnce();
    await expect(loadFaceDetector()).resolves.toBe(DETECTOR); // la falla no queda guardada
  });

  it('si no carga a tiempo (red lenta) se da por fallida para pasar a captura manual', async () => {
    vi.useFakeTimers();
    const { loadFaceDetector, config: cfg } = await freshModule();
    vision.createFromOptions.mockReturnValueOnce(new Promise(() => undefined));
    const loading = loadFaceDetector();
    const outcome = expect(loading).rejects.toThrow('Tiempo de carga del detector agotado');
    await vi.advanceTimersByTimeAsync(cfg.faceDetectorTimeoutMs);
    await outcome;
  });
});

describe('useFaceDetector', () => {
  it('pasa de "cargando" al detector listo', async () => {
    const { useFaceDetector } = await freshModule();
    const { result } = renderHook(() => useFaceDetector());
    expect(result.current).toEqual({ detector: null, error: null, loading: true });
    await waitFor(() => expect(result.current).toEqual({ detector: DETECTOR, error: null, loading: false }));
  });

  it('si no carga, lo informa para ofrecer la captura manual', async () => {
    const { useFaceDetector } = await freshModule();
    vision.forVisionTasks.mockRejectedValue(new Error('sin red'));
    const { result } = renderHook(() => useFaceDetector());
    await waitFor(() => expect(result.current.error).toBe('No se pudo cargar la detección facial automática'));
    expect(result.current.loading).toBe(false);
  });

  it('al salir antes de que cargue (o falle) no actualiza una pantalla que ya no está', async () => {
    const { useFaceDetector, loadFaceDetector } = await freshModule();
    let fail: (error: Error) => void = () => undefined;
    vision.forVisionTasks.mockReturnValueOnce(new Promise((_, reject) => (fail = reject)));
    const failing = renderHook(() => useFaceDetector());
    failing.unmount();
    await act(() => Promise.resolve().then(() => fail(new Error('sin red'))));
    expect(failing.result.current).toEqual({ detector: null, error: null, loading: true });

    const loaded = renderHook(() => useFaceDetector());
    loaded.unmount();
    await act(() => loadFaceDetector());
    expect(loaded.result.current).toEqual({ detector: null, error: null, loading: true });
  });
});

// --- Lectura del rostro -------------------------------------------------------------------------

const LEFT: DetectionMode = { kind: 'action', action: 'TURN_LEFT', minimum: 0.2, baseline: null };
const RIGHT: DetectionMode = { ...LEFT, action: 'TURN_RIGHT' };

describe('useFaceAutoCapture: guía en vivo y captura automática', () => {
  let detections: Detection[];
  let detect: Mock;
  let pendingFrame: FrameRequestCallback | null;
  let clock: number;
  let luminance: number;
  let context: boolean;

  beforeEach(() => {
    detections = [];
    clock = 0;
    luminance = 128;
    context = true;
    pendingFrame = null;
    detect = vi.fn(() => ({ detections }));
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        pendingFrame = callback;
        return 7;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    // Muestra de 24×24 de la cara para medir la luz (gris uniforme con esa luminancia).
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() =>
      context
        ? ({ drawImage: vi.fn(), getImageData: () => ({ data: new Uint8ClampedArray(24 * 24 * 4).fill(luminance) }) } as unknown as CanvasRenderingContext2D)
        : null,
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  /** Siguiente cuadro del video, `gap` ms después del anterior. */
  const frame = (gap = 120) =>
    act(() => {
      clock += gap;
      pendingFrame?.(clock);
    });

  function renderCapture(options: { mode?: DetectionMode; stableFrames?: number; onStable?: (sample?: unknown) => void; enabled?: boolean; video?: HTMLVideoElement | null } = {}) {
    const videoRef = { current: options.video === undefined ? videoElement() : options.video };
    const detector = { detectForVideo: detect } as unknown as FaceDetector;
    return renderHook(
      ({ enabled }) => useFaceAutoCapture({ detector, videoRef, enabled, mode: options.mode, stableFrames: options.stableFrames, onStable: options.onStable }),
      { initialProps: { enabled: options.enabled ?? true } },
    );
  }

  /** Guía que resulta de ver solo estos rostros. */
  function guidanceFor(found: Detection[], mode?: DetectionMode) {
    detections = found;
    const { result, unmount } = renderCapture({ mode });
    frame();
    const value = result.current.guidance;
    unmount();
    return value;
  }

  it('sin detector o deshabilitada (cámara apagada, verificación en curso) no analiza', () => {
    const { result } = renderHook(() => useFaceAutoCapture({ detector: null, videoRef: { current: videoElement() }, enabled: true }));
    expect(result.current).toEqual({ guidance: 'loading', progress: 0, moveProgress: 0 });
    renderCapture({ enabled: false });
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('cada problema del encuadre tiene su indicación', () => {
    expect(guidanceFor([])).toBe('no_face');
    expect(guidanceFor([face({ score: 0.3 })])).toBe('no_face'); // poco seguro: no cuenta
    expect(guidanceFor([{ ...face(), categories: [] }])).toBe('no_face');
    expect(guidanceFor([face({ box: false })])).toBe('no_face');
    expect(guidanceFor([face(), face({ cx: 0.3 })])).toBe('multiple');
    expect(guidanceFor([face({ size: 60 })])).toBe('too_far');
    expect(guidanceFor([face({ size: 420 })])).toBe('too_close');
    expect(guidanceFor([face({ cx: 0.2 })])).toBe('off_center');
    expect(guidanceFor([face({ cy: 0.2 })])).toBe('off_center');
    expect(guidanceFor([face({ nose: 0.03 })])).toBe('look_straight');
    luminance = 30;
    expect(guidanceFor([face()])).toBe('too_dark');
    luminance = 240;
    expect(guidanceFor([face()])).toBe('too_bright');
    luminance = 128;
    expect(guidanceFor([face()])).toBe('hold_still');
    expect(guidanceFor([{ ...face(), keypoints: [] }])).toBe('hold_still'); // sin puntos no se exige el frente
    context = false; // sin canvas no se mide la luz: no se bloquea
    expect(guidanceFor([face()])).toBe('hold_still');
  });

  it('prueba de vida: pide girar hasta superar el mínimo (con margen) hacia el lado del reto', () => {
    expect(guidanceFor([face()], LEFT)).toBe('move');
    expect(guidanceFor([face({ nose: 0.05 })], LEFT)).toBe('hold_still');
    expect(guidanceFor([face({ nose: 0.05 })], RIGHT)).toBe('move');
    expect(guidanceFor([face({ nose: -0.05 })], RIGHT)).toBe('hold_still');
    expect(guidanceFor([face({ cx: 0.75, nose: 0.05 })], LEFT)).toBe('hold_still'); // al moverse se tolera más el descentrado
    expect(guidanceFor([face({ eyeGap: 0 })], LEFT)).toBe('move');
    expect(guidanceFor([face({ size: 420, nose: 0.05 })], LEFT)).toBe('too_close'); // girando no se permite acercarse de más
  });

  it('mirar arriba o abajo: la nariz sube o baja respecto al rostro en reposo (más el margen)', () => {
    const baseline = { pitch: 0.5, width: 200 };
    const up: DetectionMode = { kind: 'action', action: 'LOOK_UP', minimum: 0.08, baseline };
    const down: DetectionMode = { ...up, action: 'LOOK_DOWN' };
    expect(guidanceFor([face()], up)).toBe('move');
    expect(guidanceFor([face({ pitch: 0.43 })], up)).toBe('move'); // 0.07: no llega al mínimo con margen (0.10)
    expect(guidanceFor([face({ pitch: 0.38 })], up)).toBe('hold_still');
    expect(guidanceFor([face({ pitch: 0.38 })], down)).toBe('move');
    expect(guidanceFor([face({ pitch: 0.62 })], down)).toBe('hold_still');
    expect(guidanceFor([face({ pitch: 0.38, noMouth: true })], up)).toBe('move'); // sin la boca no se mide
    expect(guidanceFor([face({ pitch: 0.38 })], { ...up, baseline: null })).toBe('move'); // sin rostro en reposo tampoco
  });

  it('acercarse: el rostro crece respecto al de frente (más el margen) y puede llenar más el cuadro', () => {
    const closer: DetectionMode = { kind: 'action', action: 'MOVE_CLOSER', minimum: 1.25, baseline: { pitch: 0.5, width: 200 } };
    expect(guidanceFor([face()], closer)).toBe('move');
    expect(guidanceFor([face({ size: 255 })], closer)).toBe('move'); // 1.275: no llega a 1.30
    expect(guidanceFor([face({ size: 270 })], closer)).toBe('hold_still');
    expect(guidanceFor([face({ size: 420 })], closer)).toBe('hold_still'); // de frente sería "aléjate"
    expect(guidanceFor([face({ size: 470 })], closer)).toBe('too_close'); // ya no cabe en el cuadro
    expect(guidanceFor([face({ size: 270 })], { ...closer, baseline: null })).toBe('move');
  });

  it('el avance del movimiento alimenta el anillo (0..1)', () => {
    detections = [face({ size: 230 })];
    const closer: DetectionMode = { kind: 'action', action: 'MOVE_CLOSER', minimum: 1.25, baseline: { pitch: 0.5, width: 200 } };
    const { result } = renderCapture({ mode: closer });
    frame();
    expect(result.current.moveProgress).toBeCloseTo(0.5);
    detections = [face(), face({ cx: 0.3 })]; // dos rostros: no se mide, se conserva lo avanzado
    frame();
    expect(result.current).toMatchObject({ guidance: 'multiple', moveProgress: expect.closeTo(0.5) as number });
  });

  it('al quedar estable de frente entrega el rostro en reposo (promedio de los cuadros estables)', () => {
    const onStable = vi.fn();
    detections = [face({ size: 190, pitch: 0.48 })];
    const { result } = renderCapture({ stableFrames: 2, onStable });
    frame();
    detections = [face({ size: 210, pitch: 0.52 })];
    frame();
    expect(result.current.guidance).toBe('ready');
    expect(onStable).toHaveBeenCalledExactlyOnceWith({ pitch: expect.closeTo(0.5) as number, width: 200 });
  });

  it('rostro estable: el avance llega a 1 y la captura se dispara una sola vez', () => {
    detections = [face()];
    const onStable = vi.fn();
    const { result, unmount } = renderCapture({ stableFrames: 3, onStable });
    expect(result.current.guidance).toBe('no_face');
    frame();
    expect(result.current).toMatchObject({ guidance: 'hold_still', progress: 1 / 3 });
    frame(50); // antes del intervalo de detección no se analiza
    expect(detect).toHaveBeenCalledOnce();
    frame();
    frame();
    expect(result.current).toMatchObject({ guidance: 'ready', progress: 1 });
    expect(onStable).toHaveBeenCalledOnce();
    frame();
    frame();
    expect(onStable).toHaveBeenCalledOnce(); // ya disparada: no se repite
    expect(detect).toHaveBeenCalledTimes(3);
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(7);
  });

  it('si el rostro se mueve, el avance vuelve a empezar; sin onStable solo guía', () => {
    detections = [face()];
    const { result } = renderCapture({ stableFrames: 2 });
    frame();
    expect(result.current.progress).toBe(0.5);
    detections = [face({ size: 60 })];
    frame();
    expect(result.current).toMatchObject({ guidance: 'too_far', progress: 0 });
    detections = [face()];
    frame();
    frame();
    frame();
    expect(result.current).toMatchObject({ guidance: 'hold_still', progress: 1 }); // nada que disparar
  });

  it('durante el giro, perder el rostro un instante no borra lo avanzado (hasta 3 lecturas seguidas)', () => {
    detections = [face({ nose: 0.01 })];
    const { result } = renderCapture({ mode: LEFT, stableFrames: 3 });
    expect(result.current.guidance).toBe('move');
    frame();
    const halfway = result.current.moveProgress;
    expect(halfway).toBeGreaterThan(0.3);
    detections = [face({ nose: 0.0102 })]; // diferencia mínima: no se redibuja
    frame();
    expect(result.current.moveProgress).toBe(halfway);
    detections = [];
    frame();
    frame();
    frame();
    expect(result.current).toMatchObject({ guidance: 'move', moveProgress: halfway });
    frame(); // la cuarta seguida sí cuenta
    expect(result.current.guidance).toBe('no_face');
  });

  it('cambiar de reto reinicia la lectura con la nueva indicación', () => {
    detections = [face({ nose: 0.05 })];
    const videoRef = { current: videoElement() };
    const detector = { detectForVideo: detect } as unknown as FaceDetector;
    const { result, rerender } = renderHook(({ mode }: { mode: DetectionMode }) => useFaceAutoCapture({ detector, videoRef, enabled: true, mode }), {
      initialProps: { mode: LEFT },
    });
    frame();
    expect(result.current.guidance).toBe('hold_still');
    rerender({ mode: { ...LEFT } }); // el mismo movimiento (otro objeto): no se reinicia
    expect(result.current.guidance).toBe('hold_still');
    rerender({ mode: RIGHT });
    expect(result.current).toMatchObject({ guidance: 'move', progress: 0, moveProgress: 0 });
    frame();
    expect(result.current.guidance).toBe('move');
  });

  it('sin imagen en el video o si el detector falla en un cuadro, espera al siguiente', () => {
    detections = [face()];
    const { result } = renderCapture({ video: null });
    frame();
    expect(detect).not.toHaveBeenCalled();
    renderCapture({ video: videoElement({ readyState: 1 }) });
    frame();
    renderCapture({ video: videoElement({ width: 0 }) });
    frame();
    expect(detect).not.toHaveBeenCalled();

    detect.mockImplementationOnce(() => {
      throw new Error('WASM ocupado');
    });
    const { result: flaky } = renderCapture();
    frame();
    expect(flaky.current.guidance).toBe('no_face');
    frame();
    expect(flaky.current.guidance).toBe('hold_still');
    expect(result.current.guidance).toBe('no_face');
  });
});
