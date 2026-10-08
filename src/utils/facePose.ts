import type { Detection } from '@mediapipe/tasks-vision';
import type { LivenessAction } from '../types';
import { config } from './config';
import type { FaceBox } from './faceBurst';

/**
 * Pose de la cabeza con los puntos de MediaPipe (BlazeFace: ojo derecho, ojo izquierdo, punta de la
 * nariz, centro de la boca y orejas) con las MISMAS fórmulas que el servidor
 * (`app/facial_recognition/pose.py`), para que la guía en pantalla coincida con lo que se valida:
 *
 * - yaw_ratio: desplazamiento horizontal de la nariz respecto al punto medio de los ojos / distancia
 *   entre ojos, en la imagen original (sin espejo). Positivo = la persona gira hacia SU izquierda.
 * - roll_degrees: inclinación lateral (el ángulo de la línea de los ojos).
 * - pitch_ratio: posición vertical de la nariz entre la línea de los ojos (0) y la boca (1). Al mirar
 *   arriba la nariz sube en la imagen y el valor BAJA; al mirar abajo, sube.
 * - Acercarse: ancho del rostro / ancho de frente.
 *
 * Mirar arriba/abajo y acercarse se miden contra el rostro "en reposo" de la misma toma (las
 * frontales): así no importa la forma de cada rostro ni la altura de la cámara. Los dos detectores
 * (MediaPipe aquí, YuNet en el servidor) miden un poco distinto: la app exige un margen extra.
 */

/** Rostro en reposo de la toma (de frente): contra él se miden mirar arriba/abajo y acercarse. */
export interface FaceBaseline {
  /** pitch_ratio de frente (null si no se pudo medir). */
  pitch: number | null;
  /** Ancho del rostro en píxeles del video. */
  width: number;
  /** Caja del rostro en reposo (px del video): la zona que recorta la ráfaga del antifraude 2a. */
  box?: FaceBox;
}

/** Un movimiento del reto: qué se pide, el mínimo del servidor y el rostro en reposo. */
export interface ActionMode {
  kind: 'action';
  action: LivenessAction;
  minimum: number;
  baseline: FaceBaseline | null;
}

const isTurn = (action: LivenessAction) => action === 'TURN_LEFT' || action === 'TURN_RIGHT';
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

/** Rostros con la confianza mínima de la configuración. */
export function confidentFaces(detections: Detection[]): Detection[] {
  return detections.filter((d) => (d.categories?.[0]?.score ?? 0) >= config.faceDetectionMinScore);
}

/** Giro de la cabeza (misma métrica que el servidor); null sin ojos y nariz medibles. */
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

/** Inclinación lateral de la cabeza (grados, como `roll_degrees` del servidor: el ángulo de la línea de los ojos). */
export function rollDegrees(detection: Detection, video: HTMLVideoElement): number | null {
  const kp = detection.keypoints;
  if (!kp || kp.length < 2) return null;
  const [a, b] = [kp[0], kp[1]].sort((p, q) => p.x - q.x);
  const dx = (b.x - a.x) * video.videoWidth;
  return dx > 1 ? (Math.atan2((b.y - a.y) * video.videoHeight, dx) * 180) / Math.PI : null;
}

/** Posición vertical de la nariz entre ojos (0) y boca (1); null sin la boca o con ojos y boca encimados. */
export function pitchRatio(detection: Detection, video: HTMLVideoElement): number | null {
  const kp = detection.keypoints;
  if (!kp || kp.length < 4) return null;
  const h = video.videoHeight;
  const eyesY = ((kp[0].y + kp[1].y) / 2) * h;
  const span = kp[3].y * h - eyesY;
  return span > 1 ? (kp[2].y * h - eyesY) / span : null;
}

/** Lo que se guarda de un cuadro de frente (con la caja del rostro) para medir después. */
export function faceSample(detection: Detection, box: { originX: number; originY: number; width: number; height: number }, video: HTMLVideoElement): FaceBaseline {
  return { pitch: pitchRatio(detection, video), width: box.width, box: { x: box.originX, y: box.originY, width: box.width, height: box.height } };
}

/** Centro y tamaño del rostro en un cuadro (para medir su quietud). */
export interface FacePoint {
  cx: number;
  cy: number;
  size: number;
}

export function facePoint(box: { originX: number; originY: number; width: number; height: number }): FacePoint {
  return { cx: box.originX + box.width / 2, cy: box.originY + box.height / 2, size: Math.max(box.width, box.height) };
}

/**
 * Suavizado de la quietud del rostro (decisión del dueño, 2026-10-07: el rechazo por «movimiento no solicitado» saltaba
 * de más en el iPhone con la persona razonablemente quieta). El detector del navegador (BlazeFace) tiembla unos píxeles
 * entre cuadros; comparar solo con la lectura anterior marcaba «Mantente quieto» por un pico de ruido. Aquí el
 * desplazamiento (del centro, o el cambio de tamaño) se mide contra el PROMEDIO de una ventana corta de posiciones —un
 * pico aislado apenas mueve el promedio— y solo se marca «en movimiento» cuando supera el umbral durante varios cuadros
 * SEGUIDOS (histéresis). NO afloja la validez de posición ni de pose (centrado, dentro de la guía, de frente): solo mide
 * la quietud.
 */
export interface SteadyWindow {
  /** Posiciones recientes (la más nueva al final), a lo más `window` cuadros. */
  points: FacePoint[];
  /** Cuadros seguidos con el desplazamiento por encima del umbral (para la histéresis). */
  over: number;
}

export const steadyStart = (): SteadyWindow => ({ points: [], over: 0 });

/**
 * Agrega la posición nueva a la ventana y decide si el rostro se MUEVE de verdad: el desplazamiento del centro, o el
 * cambio de tamaño, respecto al promedio de la ventana (en partes del tamaño del rostro) debe superar `maxShift` durante
 * `graceFrames` cuadros seguidos. `window` cuadros de promedio. Con la ventana vacía (el primer cuadro de frente, o justo
 * tras salirse de la guía) no hay con qué comparar: quieto.
 */
export function steadyStep(state: SteadyWindow, point: FacePoint, opts: { window: number; maxShift: number; graceFrames: number }): { state: SteadyWindow; moving: boolean } {
  let shift = 0;
  if (state.points.length > 0) {
    const n = state.points.length;
    const avg = state.points.reduce((a, p) => ({ cx: a.cx + p.cx / n, cy: a.cy + p.cy / n, size: a.size + p.size / n }), { cx: 0, cy: 0, size: 0 });
    const base = Math.max(1, avg.size);
    shift = Math.max(Math.hypot(point.cx - avg.cx, point.cy - avg.cy), Math.abs(point.size - avg.size)) / base;
  }
  const over = shift > opts.maxShift ? state.over + 1 : 0;
  const points = [...state.points, point].slice(-opts.window);
  return { state: { points, over }, moving: over >= opts.graceFrames };
}

/**
 * Veredicto de un cuadro de frente YA bien colocado (`hold_still`): ¿sirve, o el rostro se MUEVE (quietud suavizada) o
 * está BORROSO (nitidez)? Regla pura extraída del ciclo de detección (`useFaceAutoCapture`) para no acumular condiciones
 * allí. La quietud y la nitidez solo se evalúan de frente (`!moving`): en un movimiento del reto el movimiento es lo
 * pedido y la nitidez no se exige. Devuelve también la ventana de quietud actualizada (sin tocar la que entra).
 */
export function holdStillGuidance(
  box: { originX: number; originY: number; width: number; height: number } | null,
  moving: boolean,
  quality: ((box: { originX: number; originY: number; width: number; height: number }) => boolean | null) | undefined,
  steady: SteadyWindow,
  opts: { window: number; maxShift: number; graceFrames: number },
): { guidance: 'hold_still' | 'moving' | 'blurry'; steady: SteadyWindow } {
  const jitter = !moving && box ? steadyStep(steady, facePoint(box), opts) : null;
  const nextSteady = jitter ? jitter.state : steady;
  const sharp = !moving && box ? quality?.(box) : undefined;
  if (jitter?.moving) return { guidance: 'moving', steady: nextSteady };
  if (sharp === false) return { guidance: 'blurry', steady: nextSteady };
  return { guidance: 'hold_still', steady: nextSteady };
}

/** Promedio de los cuadros estables de frente (undefined si no hubo ninguno). */
export function averageSample(samples: FaceBaseline[]): FaceBaseline | undefined {
  if (samples.length === 0) return undefined;
  const pitches = samples.map((s) => s.pitch).filter((p): p is number => p !== null);
  const boxes = samples.map((s) => s.box).filter((b): b is FaceBox => b !== undefined);
  const box = boxes.length
    ? { x: mean(boxes.map((b) => b.x)), y: mean(boxes.map((b) => b.y)), width: mean(boxes.map((b) => b.width)), height: mean(boxes.map((b) => b.height)) }
    : undefined;
  return { pitch: pitches.length ? mean(pitches) : null, width: mean(samples.map((s) => s.width)), ...(box ? { box } : {}) };
}

/** Cambio del pitch respecto al de frente en el sentido pedido (arriba = baja el valor). */
function pitchMeasure(detection: Detection, video: HTMLVideoElement, mode: ActionMode): number | null {
  const pitch = pitchRatio(detection, video);
  const base = mode.baseline?.pitch;
  if (pitch === null || base == null) return null;
  return mode.action === 'LOOK_UP' ? base - pitch : pitch - base;
}

/**
 * Cuánto se movió la persona en el sentido del movimiento (como `step_measure` del servidor; mayor =
 * más claro). null si no se puede medir (sin puntos, sin caja o sin el rostro en reposo).
 */
export function actionMeasure(detection: Detection, video: HTMLVideoElement, mode: ActionMode): number | null {
  if (isTurn(mode.action)) {
    const yaw = yawRatio(detection, video);
    return yaw === null ? null : mode.action === 'TURN_LEFT' ? yaw : -yaw;
  }
  if (mode.action !== 'MOVE_CLOSER') return pitchMeasure(detection, video, mode);
  const width = detection.boundingBox?.width;
  const base = mode.baseline?.width;
  return width && base ? width / base : null;
}

/** Lo que exige la app: el mínimo del servidor más su margen (la captura lo supera con holgura). */
export function actionTarget(mode: ActionMode): number {
  if (isTurn(mode.action)) return mode.minimum + config.faceTurnMargin;
  if (mode.action === 'MOVE_CLOSER') return mode.minimum + config.faceCloserMargin;
  return mode.minimum + config.facePitchMargin;
}

/** 0..1 hacia lo que exige el movimiento (acercarse: lo que crece el rostro sobre su tamaño de frente). */
export function actionProgress(measure: number, mode: ActionMode): number {
  const target = actionTarget(mode);
  const ratio = mode.action === 'MOVE_CLOSER' ? (measure - 1) / (target - 1) : measure / target;
  return Math.max(0, Math.min(1, ratio));
}

/**
 * Avance del movimiento (0..1): alimenta la barra y el anillo para que la persona sepa cuánto le
 * falta. null si no hay un único rostro que medir.
 */
export function moveProgress(detections: Detection[], video: HTMLVideoElement, mode: ActionMode): number | null {
  const faces = confidentFaces(detections);
  if (faces.length !== 1) return null;
  const measure = actionMeasure(faces[0], video, mode);
  return measure === null ? null : actionProgress(measure, mode);
}
