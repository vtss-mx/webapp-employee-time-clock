import type { Detection, FaceDetector } from '@mediapipe/tasks-vision';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { config } from '../utils/config';
import { turnProgress, useFaceAutoCapture, yawRatio, type DetectionMode } from './useFaceDetection';

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

const VIDEO_SIZE = { width: 640, height: 480 };

function videoElement({ readyState = 4, width = VIDEO_SIZE.width, height = VIDEO_SIZE.height } = {}): HTMLVideoElement {
  const video = document.createElement('video');
  Object.defineProperty(video, 'readyState', { value: readyState, configurable: true });
  Object.defineProperty(video, 'videoWidth', { value: width, configurable: true });
  Object.defineProperty(video, 'videoHeight', { value: height, configurable: true });
  return video;
}

interface FaceSpec {
  score?: number;
  /** Centro de la caja en proporción del video y su tamaño en píxeles. */
  cx?: number;
  cy?: number;
  size?: number;
  /** Nariz respecto al punto medio de los ojos (proporción del ancho): positivo = gira a su izquierda. */
  nose?: number;
  eyeGap?: number;
  box?: boolean;
}

/** Rostro como lo entrega BlazeFace: caja en píxeles y puntos (ojos y nariz) normalizados. */
function face({ score = 0.95, cx = 0.5, cy = 0.5, size = 200, nose = 0, eyeGap = 0.1, box = true }: FaceSpec = {}): Detection {
  const x = cx * VIDEO_SIZE.width - size / 2;
  const y = cy * VIDEO_SIZE.height - size / 2;
  return {
    categories: [{ score, index: 0, categoryName: 'face', displayName: '' }],
    boundingBox: box ? { originX: x, originY: y, width: size, height: size, angle: 0 } : undefined,
    // Ojos en desorden (derecho primero): la métrica los ordena por posición.
    keypoints: [
      { x: cx + eyeGap / 2, y: 0.45 },
      { x: cx - eyeGap / 2, y: 0.45 },
      { x: cx + nose, y: 0.55 },
    ],
  };
}

describe('yawRatio y turnProgress (misma métrica que el backend)', () => {
  const video = videoElement();

  it('giro respecto a la distancia entre ojos; sin puntos suficientes o con ojos encimados no se mide', () => {
    expect(yawRatio(face(), video)).toBe(0);
    expect(yawRatio(face({ nose: 0.03 }), video)).toBeCloseTo(0.3);
    expect(yawRatio({ ...face(), keypoints: face().keypoints.slice(0, 2) }, video)).toBeNull();
    expect(yawRatio(face({ eyeGap: 0 }), video)).toBeNull();
  });

  it('avance del giro hacia el lado pedido (0..1); null fuera del reto o sin un único rostro medible', () => {
    const left: DetectionMode = { kind: 'turn', direction: 'TURN_LEFT', minYawRatio: 0.2 };
    const right: DetectionMode = { kind: 'turn', direction: 'TURN_RIGHT', minYawRatio: 0.2 };
    const target = 0.2 + config.faceTurnMargin;
    expect(turnProgress([face({ nose: 0.01 })], video, left)).toBeCloseTo(0.1 / target);
    expect(turnProgress([face({ nose: 0.05 })], video, left)).toBe(1);
    expect(turnProgress([face({ nose: 0.01 })], video, right)).toBe(0);
    expect(turnProgress([face({ nose: -0.01 })], video, right)).toBeCloseTo(0.1 / target);
    expect(turnProgress([face()], video, { kind: 'frontal' })).toBeNull();
    expect(turnProgress([face(), face()], video, left)).toBeNull();
    expect(turnProgress([face({ score: 0.2 })], video, left)).toBeNull();
    expect(turnProgress([{ ...face(), categories: [] }], video, left)).toBeNull();
    expect(turnProgress([face({ eyeGap: 0 })], video, left)).toBeNull();
  });
});

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

  function renderCapture(options: { mode?: DetectionMode; stableFrames?: number; onStable?: () => void; enabled?: boolean; video?: HTMLVideoElement | null } = {}) {
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
    expect(result.current).toEqual({ guidance: 'loading', progress: 0, turnProgress: 0 });
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
    const left: DetectionMode = { kind: 'turn', direction: 'TURN_LEFT', minYawRatio: 0.2 };
    const right: DetectionMode = { kind: 'turn', direction: 'TURN_RIGHT', minYawRatio: 0.2 };
    expect(guidanceFor([face()], left)).toBe('turn');
    expect(guidanceFor([face({ nose: 0.05 })], left)).toBe('hold_still');
    expect(guidanceFor([face({ nose: 0.05 })], right)).toBe('turn');
    expect(guidanceFor([face({ nose: -0.05 })], right)).toBe('hold_still');
    expect(guidanceFor([face({ cx: 0.75, nose: 0.05 })], left)).toBe('hold_still'); // al girar se tolera más el descentrado
    expect(guidanceFor([face({ eyeGap: 0 })], left)).toBe('turn');
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
    const mode: DetectionMode = { kind: 'turn', direction: 'TURN_LEFT', minYawRatio: 0.2 };
    detections = [face({ nose: 0.01 })];
    const { result } = renderCapture({ mode, stableFrames: 3 });
    expect(result.current.guidance).toBe('turn');
    frame();
    const halfway = result.current.turnProgress;
    expect(halfway).toBeGreaterThan(0.3);
    detections = [face({ nose: 0.0102 })]; // diferencia mínima: no se redibuja
    frame();
    expect(result.current.turnProgress).toBe(halfway);
    detections = [];
    frame();
    frame();
    frame();
    expect(result.current).toMatchObject({ guidance: 'turn', turnProgress: halfway });
    frame(); // la cuarta seguida sí cuenta
    expect(result.current.guidance).toBe('no_face');
  });

  it('cambiar de reto reinicia la lectura con la nueva indicación', () => {
    detections = [face({ nose: 0.05 })];
    const videoRef = { current: videoElement() };
    const detector = { detectForVideo: detect } as unknown as FaceDetector;
    const { result, rerender } = renderHook(({ mode }: { mode: DetectionMode }) => useFaceAutoCapture({ detector, videoRef, enabled: true, mode }), {
      initialProps: { mode: { kind: 'turn', direction: 'TURN_LEFT', minYawRatio: 0.2 } as DetectionMode },
    });
    frame();
    expect(result.current.guidance).toBe('hold_still');
    rerender({ mode: { kind: 'turn', direction: 'TURN_RIGHT', minYawRatio: 0.2 } });
    expect(result.current).toMatchObject({ guidance: 'turn', progress: 0, turnProgress: 0 });
    frame();
    expect(result.current.guidance).toBe('turn');
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
