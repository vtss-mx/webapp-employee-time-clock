import type { Detection, FaceDetector } from '@mediapipe/tasks-vision';
import { useEffect, useRef, useState } from 'react';
import { t, type MessageKey } from '../i18n/core';
import { localizedError } from '../i18n/lazy';
import { config } from '../utils/config';
import { actionMeasure, actionTarget, averageSample, confidentFaces, faceSample, moveProgress, yawRatio, type ActionMode, type FaceBaseline } from '../utils/facePose';

/**
 * Detección facial en el navegador (MediaPipe BlazeFace, WASM/CPU) para guiar al usuario
 * y capturar automáticamente. La validación definitiva siempre la hace el backend.
 */

export type FaceGuidance =
  | 'loading'
  | 'no_face'
  | 'multiple'
  | 'too_far'
  | 'too_close'
  | 'off_center'
  | 'look_straight'
  | 'too_dark'
  | 'too_bright'
  | 'move'
  | 'hold_still'
  | 'ready';

/** Texto de cada guía (el estado guarda el código; el texto se pide al dibujarse, en el idioma activo). */
const GUIDANCE_KEYS = {
  loading: 'face.guidance.loading',
  no_face: 'face.guidance.noFace',
  multiple: 'face.guidance.multiple',
  too_far: 'face.guidance.tooFar',
  too_close: 'face.guidance.tooClose',
  off_center: 'face.guidance.offCenter',
  look_straight: 'face.guidance.lookStraight',
  too_dark: 'face.guidance.tooDark',
  too_bright: 'face.guidance.tooBright',
  move: 'face.guidance.move',
  hold_still: 'face.guidance.holdStill',
  ready: 'face.guidance.ready',
} as const satisfies Record<FaceGuidance, MessageKey>;

export function guidanceMessage(guidance: FaceGuidance): string {
  return t(GUIDANCE_KEYS[guidance]);
}

/**
 * - frontal: rostro de frente (registro, primera fase de verificación y regreso al frente).
 * - action: un movimiento de la prueba de vida (girar, mirar arriba o abajo, acercarse; punto de
 *   vista de la persona) hasta el mínimo del servidor más el margen de la app (`utils/facePose`).
 */
export type DetectionMode = { kind: 'frontal' } | ActionMode;

let detectorPromise: Promise<FaceDetector> | null = null;

async function createDetector(): Promise<FaceDetector> {
  const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks(config.mediapipeWasmUrl);
  const make = (modelAssetPath: string) =>
    FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath, delegate: 'CPU' }, // CPU = mayor compatibilidad (iOS/Android)
      runningMode: 'VIDEO',
      minDetectionConfidence: 0.5,
    });
  try {
    return await make(config.faceModelUrl);
  } catch (error) {
    if (!config.faceModelFallbackEnabled) throw error;
    return make(config.faceModelFallbackUrl);
  }
}

/** Carga perezosa y compartida del detector (se reutiliza entre pantallas). */

export function loadFaceDetector(): Promise<FaceDetector> {
  if (!detectorPromise) {
    // Si el modelo no carga a tiempo (red lenta), la UI pasa a captura manual en vez de colgarse.
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(localizedError(() => t('face.detection.timeout'))), config.faceDetectorTimeoutMs),
    );
    detectorPromise = Promise.race([createDetector(), timeout]).catch((error) => {
      detectorPromise = null;
      throw error;
    });
  }
  return detectorPromise;
}

/**
 * El detector compartido para una pantalla. `failed`: no se pudo cargar (la pantalla ofrece la
 * captura manual; el texto que lo explica lo escribe quien lo muestra, en el idioma activo).
 */
export function useFaceDetector() {
  const [detector, setDetector] = useState<FaceDetector | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadFaceDetector()
      .then((d) => !cancelled && setDetector(d))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  return { detector, failed, loading: !detector && !failed };
}

// Márgenes más estrictos que el backend para que la captura enviada pase su validación.
const MAX_FRONTAL_YAW = 0.1;

let sampleCanvas: HTMLCanvasElement | null = null;

type Box = { originX: number; originY: number; width: number; height: number };

function faceLuminance(video: HTMLVideoElement, box: Box) {
  sampleCanvas ??= document.createElement('canvas');
  sampleCanvas.width = 24;
  sampleCanvas.height = 24;
  const ctx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return 128;
  ctx.drawImage(video, box.originX, box.originY, box.width, box.height, 0, 0, 24, 24);
  const { data } = ctx.getImageData(0, 0, 24, 24);
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  return sum / (data.length / 4);
}

/** Tamaño máximo del rostro en el cuadro; al acercarse se permite más (sin salirse del cuadro). */
const MAX_FACE_SIZE = 0.8;
const MAX_CLOSER_FACE_SIZE = 0.95;

/** Encuadre: distancia y centrado (al moverse se tolera más el descentrado). null si está bien. */
function framingProblem(box: Box, video: HTMLVideoElement, mode: DetectionMode): Exclude<FaceGuidance, 'hold_still'> | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const size = Math.max(box.width / vw, box.height / vh);
  if (size < 0.18) return 'too_far';
  const closer = mode.kind === 'action' && mode.action === 'MOVE_CLOSER';
  if (size > (closer ? MAX_CLOSER_FACE_SIZE : MAX_FACE_SIZE)) return 'too_close';
  const cx = (box.originX + box.width / 2) / vw;
  const cy = (box.originY + box.height / 2) / vh;
  const tolerance = mode.kind === 'action' ? 0.3 : 0.22;
  if (Math.abs(cx - 0.5) > tolerance || Math.abs(cy - 0.5) > 0.25) return 'off_center';
  return null;
}

/** Guía del cuadro y, si el rostro está listo, lo que se mide de él (rostro en reposo). */
type Evaluation = { guidance: 'hold_still'; sample: FaceBaseline } | { guidance: Exclude<FaceGuidance, 'hold_still'> };

function evaluate(detections: Detection[], video: HTMLVideoElement, mode: DetectionMode): Evaluation {
  const boxes = confidentFaces(detections)
    .map((d) => ({ face: d, box: d.boundingBox }))
    .filter((d): d is { face: Detection; box: NonNullable<Detection['boundingBox']> } => d.box !== undefined);
  if (boxes.length === 0) return { guidance: 'no_face' };
  if (boxes.length > 1) return { guidance: 'multiple' };

  const { face, box } = boxes[0];
  const framing = framingProblem(box, video, mode);
  if (framing) return { guidance: framing };
  const sample = faceSample(face, box, video);

  if (mode.kind === 'action') {
    const measure = actionMeasure(face, video, mode);
    return measure !== null && measure >= actionTarget(mode) ? { guidance: 'hold_still', sample } : { guidance: 'move' };
  }
  const yaw = yawRatio(face, video);
  if (yaw !== null && Math.abs(yaw) > MAX_FRONTAL_YAW) return { guidance: 'look_straight' };

  const luminance = faceLuminance(video, box);
  if (luminance < 45) return { guidance: 'too_dark' };
  if (luminance > 220) return { guidance: 'too_bright' };
  return { guidance: 'hold_still', sample };
}

/**
 * Durante un movimiento el detector del navegador puede perder el rostro un instante (de perfil, muy
 * cerca o mirando hacia abajo): esas lecturas no reinician el avance mientras no sean más de estas
 * seguidas.
 */
const MOVE_MISSES_TOLERATED = 3;

/** Lo que el detector ve en un cuadro (null si aún no hay imagen o el detector falló en él). */
function readFrame(detector: FaceDetector, video: HTMLVideoElement | null, now: number, mode: DetectionMode): (Evaluation & { moved: number | null }) | null {
  if (!video || video.readyState < 2 || !video.videoWidth) return null;
  try {
    const { detections } = detector.detectForVideo(video, now);
    return { ...evaluate(detections, video, mode), moved: mode.kind === 'action' ? moveProgress(detections, video, mode) : null };
  } catch {
    return null;
  }
}

interface AutoCaptureOptions {
  detector: FaceDetector | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Solo analiza mientras la cámara está activa y no hay una verificación en curso. */
  enabled: boolean;
  mode?: DetectionMode;
  /** Frames consecutivos válidos antes de disparar onStable (~110 ms cada uno). */
  stableFrames?: number;
  /**
   * Se invoca una vez cuando hay un único rostro estable que cumple el modo, con el promedio de lo
   * medido en esos cuadros (de frente: el rostro en reposo contra el que se miden los movimientos).
   */
  onStable?: (sample?: FaceBaseline) => void | Promise<void>;
}

const FRONTAL: DetectionMode = { kind: 'frontal' };

/** Identidad del modo: el ciclo de detección se reinicia solo cuando cambia lo que se pide. */
function modeKey(mode: DetectionMode): string {
  if (mode.kind === 'frontal') return 'frontal';
  return `${mode.action}:${mode.minimum}:${mode.baseline?.pitch}:${mode.baseline?.width}`;
}

export function useFaceAutoCapture({
  detector,
  videoRef,
  enabled,
  mode = FRONTAL,
  stableFrames = 6,
  onStable,
}: AutoCaptureOptions) {
  const [guidance, setGuidance] = useState<FaceGuidance>('loading');
  /** 0..1: avance hacia la captura automática (rostro estable). Alimenta el anillo de progreso. */
  const [progress, setProgress] = useState(0);
  /** 0..1: cuánto se ha movido la cabeza respecto a lo que pide el reto (solo en un movimiento). */
  const [move, setMove] = useState(0);
  const onStableRef = useRef(onStable);
  onStableRef.current = onStable;
  const key = modeKey(mode);

  useEffect(() => {
    if (!enabled || !detector) return;
    let raf = 0;
    let last = 0;
    let stable = 0;
    let misses = 0;
    let fired = false;
    let samples: FaceBaseline[] = [];
    const moving = mode.kind === 'action';
    setGuidance(moving ? 'move' : 'no_face');
    setProgress(0);
    setMove(0);

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < config.faceDetectionIntervalMs || fired) return;
      last = now;
      const reading = readFrame(detector, videoRef.current, now, mode);
      if (!reading) return;
      const { moved } = reading;
      if (moved !== null) setMove((prev) => (Math.abs(prev - moved) < 0.02 ? prev : moved));

      // Movimiento: un rostro perdido un instante no borra lo avanzado (se conserva la guía anterior).
      if (moving && reading.guidance === 'no_face' && misses < MOVE_MISSES_TOLERATED) {
        misses++;
        return;
      }
      misses = 0;

      let next: FaceGuidance = reading.guidance;
      if (reading.guidance === 'hold_still') {
        stable++;
        samples.push(reading.sample);
        if (stable >= stableFrames && onStableRef.current) {
          fired = true;
          next = 'ready';
          void onStableRef.current(averageSample(samples));
        }
      } else {
        stable = 0;
        samples = [];
      }
      const ratio = Math.min(1, stable / stableFrames);
      setProgress((prev) => (prev === ratio ? prev : ratio));
      setGuidance((prev) => (prev === next ? prev : next));
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // `mode` se representa con su clave para no reiniciar el ciclo en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detector, enabled, videoRef, key, stableFrames]);

  return { guidance, progress, moveProgress: move };
}
