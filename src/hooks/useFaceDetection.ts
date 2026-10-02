import type { Detection, FaceDetector } from '@mediapipe/tasks-vision';
import { useEffect, useRef, useState } from 'react';
import { config } from '../utils/config';

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
  | 'turn'
  | 'hold_still'
  | 'ready';

export const FACE_GUIDANCE_MESSAGES: Record<FaceGuidance, string> = {
  loading: 'Preparando detección facial...',
  no_face: 'Coloca tu rostro frente a la cámara',
  multiple: 'Solo debe aparecer una persona frente a la cámara',
  too_far: 'Acércate un poco más a la cámara',
  too_close: 'Aléjate un poco de la cámara',
  off_center: 'Centra tu rostro dentro de la guía',
  look_straight: 'Mira directamente a la cámara',
  too_dark: 'Hay poca luz. Busca un lugar más iluminado',
  too_bright: 'Hay demasiada luz. Evita la luz directa',
  turn: 'Gira la cabeza como se indica',
  hold_still: 'Rostro detectado. Mantente quieto...',
  ready: 'Rostro detectado',
};

/**
 * - frontal: rostro de frente (registro y primera fase de verificación).
 * - turn: prueba de vida; la cabeza debe girar hacia `direction` (punto de vista de la persona).
 */
export type DetectionMode =
  | { kind: 'frontal' }
  | { kind: 'turn'; direction: 'TURN_LEFT' | 'TURN_RIGHT'; minYawRatio: number };

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
      setTimeout(() => reject(new Error('Tiempo de carga del detector agotado')), config.faceDetectorTimeoutMs),
    );
    detectorPromise = Promise.race([createDetector(), timeout]).catch((error) => {
      detectorPromise = null;
      throw error;
    });
  }
  return detectorPromise;
}

export function useFaceDetector() {
  const [detector, setDetector] = useState<FaceDetector | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadFaceDetector()
      .then((d) => !cancelled && setDetector(d))
      .catch(() => !cancelled && setError('No se pudo cargar la detección facial automática'));
    return () => {
      cancelled = true;
    };
  }, []);

  return { detector, error, loading: !detector && !error };
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

/**
 * Misma métrica que el backend: desplazamiento horizontal de la nariz respecto al punto
 * medio de los ojos / distancia entre ojos, en la imagen original (sin espejo).
 * Positivo = la persona gira hacia SU izquierda.
 */
export function yawRatio(detection: Detection, video: HTMLVideoElement): number | null {
  const kp = detection.keypoints;
  if (!kp || kp.length < 3) return null;
  const w = video.videoWidth;
  const h = video.videoHeight;
  const [a, b] = [kp[0], kp[1]].sort((p, q) => p.x - q.x);
  const midX = ((a.x + b.x) / 2) * w;
  const dist = Math.hypot((b.x - a.x) * w, (b.y - a.y) * h);
  return dist > 1 ? (kp[2].x * w - midX) / dist : null;
}

function evaluate(detections: Detection[], video: HTMLVideoElement, mode: DetectionMode): FaceGuidance {
  const boxes = detections
    .filter((d) => (d.categories?.[0]?.score ?? 0) >= config.faceDetectionMinScore)
    .map((d) => ({ face: d, box: d.boundingBox }))
    .filter((d): d is { face: Detection; box: NonNullable<Detection['boundingBox']> } => d.box !== undefined);
  if (boxes.length === 0) return 'no_face';
  if (boxes.length > 1) return 'multiple';

  const { face, box } = boxes[0];
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const size = Math.max(box.width / vw, box.height / vh);
  if (size < 0.18) return 'too_far';
  if (size > 0.8) return 'too_close';

  const cx = (box.originX + box.width / 2) / vw;
  const cy = (box.originY + box.height / 2) / vh;
  const tolerance = mode.kind === 'turn' ? 0.3 : 0.22;
  if (Math.abs(cx - 0.5) > tolerance || Math.abs(cy - 0.5) > 0.25) return 'off_center';

  const yaw = yawRatio(face, video);
  if (mode.kind === 'frontal') {
    if (yaw !== null && Math.abs(yaw) > MAX_FRONTAL_YAW) return 'look_straight';
  } else {
    const sign = mode.direction === 'TURN_LEFT' ? 1 : -1;
    if (yaw === null || sign * yaw < mode.minYawRatio + config.faceTurnMargin) return 'turn';
    return 'hold_still';
  }

  const luminance = faceLuminance(video, box);
  if (luminance < 45) return 'too_dark';
  if (luminance > 220) return 'too_bright';
  return 'hold_still';
}

interface AutoCaptureOptions {
  detector: FaceDetector | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Solo analiza mientras la cámara está activa y no hay una verificación en curso. */
  enabled: boolean;
  mode?: DetectionMode;
  /** Frames consecutivos válidos antes de disparar onStable (~110 ms cada uno). */
  stableFrames?: number;
  /** Se invoca una vez cuando hay un único rostro estable que cumple el modo. */
  onStable?: () => void | Promise<void>;
}

const FRONTAL: DetectionMode = { kind: 'frontal' };

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
  const onStableRef = useRef(onStable);
  onStableRef.current = onStable;
  const modeKey = mode.kind === 'frontal' ? 'frontal' : `${mode.direction}:${mode.minYawRatio}`;

  useEffect(() => {
    if (!enabled || !detector) return;
    let raf = 0;
    let last = 0;
    let stable = 0;
    let fired = false;
    setGuidance(mode.kind === 'turn' ? 'turn' : 'no_face');
    setProgress(0);

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < config.faceDetectionIntervalMs || fired) return;
      last = now;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !video.videoWidth) return;

      let next: FaceGuidance;
      try {
        next = evaluate(detector.detectForVideo(video, now).detections, video, mode);
      } catch {
        return;
      }

      if (next === 'hold_still') {
        stable++;
        if (stable >= stableFrames && onStableRef.current) {
          fired = true;
          next = 'ready';
          void onStableRef.current();
        }
      } else {
        stable = 0;
      }
      const ratio = Math.min(1, stable / stableFrames);
      setProgress((prev) => (prev === ratio ? prev : ratio));
      setGuidance((prev) => (prev === next ? prev : next));
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // `mode` se representa con modeKey para no reiniciar el ciclo en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detector, enabled, videoRef, modeKey, stableFrames]);

  return { guidance, progress };
}
