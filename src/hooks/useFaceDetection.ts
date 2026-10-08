import type { Detection, FaceDetector } from '@mediapipe/tasks-vision';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { guideTarget } from '../components/faceGuideShape';
import { t, type MessageKey } from '../i18n/core';
import { localizedError } from '../i18n/lazy';
import { config } from '../utils/config';
import type { FaceBox } from '../utils/faceBurst';
import {
  actionMeasure,
  actionTarget,
  averageSample,
  confidentFaces,
  faceSample,
  holdStillGuidance,
  moveProgress,
  pitchRatio,
  rollDegrees,
  steadyStart,
  yawRatio,
  type ActionMode,
  type FaceBaseline,
  type SteadyWindow,
} from '../utils/facePose';

/**
 * Detección facial en el navegador (MediaPipe BlazeFace, WASM/CPU) para guiar al usuario
 * y capturar automáticamente. La validación definitiva siempre la hace el backend.
 */

export type FaceGuidance =
  | 'loading'
  | 'no_face'
  | 'multiple'
  | 'cut_off'
  | 'too_far'
  | 'too_close'
  | 'off_center'
  | 'look_straight'
  | 'too_dark'
  | 'too_bright'
  | 'moving'
  | 'blurry'
  | 'move'
  | 'hold_still'
  | 'ready';

/**
 * Texto de cada guía (el estado guarda el código; el texto se pide al dibujarse, en el idioma activo). Un rostro que se
 * mueve recibe la misma indicación que uno bien colocado («Mantente quieto»): es lo que debe hacer; el tono dice si ya
 * sirve.
 */
const GUIDANCE_KEYS = {
  loading: 'face.guidance.loading',
  no_face: 'face.guidance.noFace',
  multiple: 'face.guidance.multiple',
  cut_off: 'face.guidance.cutOff',
  too_far: 'face.guidance.tooFar',
  too_close: 'face.guidance.tooClose',
  off_center: 'face.guidance.offCenter',
  look_straight: 'face.guidance.lookStraight',
  too_dark: 'face.guidance.tooDark',
  too_bright: 'face.guidance.tooBright',
  moving: 'face.guidance.holdStill',
  // Cuadro borroso (poca nitidez por el Laplaciano): «Mantente quieto» (quedarse quieto deja que la cámara enfoque); el
  // aviso visual es el borde ROJO de la guía (decisión del dueño, 2026-10-07), no una frase nueva.
  blurry: 'face.guidance.holdStill',
  move: 'face.guidance.move',
  hold_still: 'face.guidance.holdStill',
  ready: 'face.guidance.ready',
} as const satisfies Record<FaceGuidance, MessageKey>;

export function guidanceMessage(guidance: FaceGuidance): string {
  return t(GUIDANCE_KEYS[guidance]);
}

/**
 * - frontal: rostro de frente (registro, primera fase de verificación y regreso al frente). Con el rostro en reposo
 *   (`baseline`, el de las frontales de la misma toma) se exige además que la cabeza no haya subido ni bajado respecto
 *   a él: las fotos del registro y la vuelta al frente entre movimientos se miden contra el mismo rostro.
 * - action: un movimiento de la prueba de vida (girar, mirar arriba o abajo, acercarse; punto de
 *   vista de la persona) hasta el mínimo del servidor más el margen de la app (`utils/facePose`).
 */
export type DetectionMode = { kind: 'frontal'; baseline?: FaceBaseline | null } | ActionMode;

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

/*
 * Encuadre contra la guía (decisión del dueño, 2026-10-07: lo que se dibuja es lo que se exige). Durante un movimiento
 * de la prueba de vida la cabeza sale del contorno a propósito: el centrado tolera el doble y, al acercarse, el rostro
 * puede crecer más de lo que cabe en la guía (hasta lo que pide el servidor, `FACE_LIVENESS_MAX_CLOSER_SCALE`).
 */
const ACTION_CENTER_ROOM = 2;
const CLOSER_FILL_ROOM = 1.3;
/** Lo que el rostro puede asomar fuera del cuadro de la cámara (parte de su propio tamaño) antes de verse cortado. */
const CUT_OFF_ROOM = 0.02;

/** El rostro asoma fuera del cuadro de la cámara: no está completo (el servidor lo rechaza con FACE_CUT_OFF). */
function cutOff(box: Box, video: HTMLVideoElement): boolean {
  const roomX = box.width * CUT_OFF_ROOM;
  const roomY = box.height * CUT_OFF_ROOM;
  return box.originX < -roomX || box.originY < -roomY || box.originX + box.width > video.videoWidth + roomX || box.originY + box.height > video.videoHeight + roomY;
}

/** Encuadre contra la guía: distancia (cuánto llena la caja objetivo) y centrado. null si está bien. */
function framingProblem(box: Box, target: FaceBox, mode: DetectionMode): Exclude<FaceGuidance, 'hold_still'> | null {
  const fill = box.width / target.width;
  if (fill < config.faceGuideMinFill) return 'too_far';
  const closer = mode.kind === 'action' && mode.action === 'MOVE_CLOSER';
  if (fill > config.faceGuideMaxFill * (closer ? CLOSER_FILL_ROOM : 1)) return 'too_close';
  const tolerance = config.faceCenterTolerance * (mode.kind === 'action' ? ACTION_CENTER_ROOM : 1);
  const dx = Math.abs(box.originX + box.width / 2 - (target.x + target.width / 2)) / target.width;
  const dy = Math.abs(box.originY + box.height / 2 - (target.y + target.height / 2)) / target.height;
  if (dx > tolerance || dy > tolerance) return 'off_center';
  return null;
}

/**
 * De frente, estricto (decisión del dueño, 2026-10-07: mirar hacia abajo NO es válido): giro, inclinación y cabeceo
 * dentro de su margen, más estrecho que el del servidor (`FACE_MAX_YAW_RATIO` 0.15, `FACE_MAX_ROLL_DEGREES` 15 y el
 * pitch 0.20-0.85 de `pipeline.py`) porque MediaPipe y YuNet miden distinto y una foto que la app acepta debe pasar
 * siempre allá. Con el rostro en reposo, además, la cabeza no subió ni bajó respecto a él (`faceFrontalPitchDrift`,
 * menor que el cambio que el servidor da por «mirar abajo», `FACE_LIVENESS_MIN_PITCH_DELTA`). Sin puntos medibles no
 * se exige (el servidor sigue revisando).
 */
function notFrontal(face: Detection, video: HTMLVideoElement, baseline: FaceBaseline | null | undefined): boolean {
  const yaw = yawRatio(face, video);
  if (yaw !== null && Math.abs(yaw) > config.faceFrontalMaxYaw) return true;
  const roll = rollDegrees(face, video);
  if (roll !== null && Math.abs(roll) > config.faceFrontalMaxRollDegrees) return true;
  const pitch = pitchRatio(face, video);
  if (pitch === null) return false;
  if (pitch < config.faceFrontalPitchMin || pitch > config.faceFrontalPitchMax) return true;
  return baseline?.pitch != null && Math.abs(pitch - baseline.pitch) > config.faceFrontalPitchDrift;
}

/**
 * Guía del cuadro y, si el rostro está listo, lo que se mide de él (rostro en reposo). Un cuadro «hold_still» pasó la
 * posición, la pose y la luz; la QUIETUD (suavizada, contra el ruido del detector) y la NITIDEZ (`quality`) se deciden en
 * el bucle, donde viven la ventana de posiciones y la medición de nitidez.
 */
type Evaluation = { guidance: 'hold_still'; sample: FaceBaseline } | { guidance: Exclude<FaceGuidance, 'hold_still'> };

function evaluate(detections: Detection[], video: HTMLVideoElement, mode: DetectionMode, target: FaceBox): Evaluation {
  const boxes = confidentFaces(detections)
    .map((d) => ({ face: d, box: d.boundingBox }))
    .filter((d): d is { face: Detection; box: NonNullable<Detection['boundingBox']> } => d.box !== undefined);
  if (boxes.length === 0) return { guidance: 'no_face' };
  if (boxes.length > 1) return { guidance: 'multiple' };

  const { face, box } = boxes[0];
  if (cutOff(box, video)) return { guidance: 'cut_off' };
  const framing = framingProblem(box, target, mode);
  if (framing) return { guidance: framing };
  const sample = faceSample(face, box, video);

  if (mode.kind === 'action') {
    const measure = actionMeasure(face, video, mode);
    return measure !== null && measure >= actionTarget(mode) ? { guidance: 'hold_still', sample } : { guidance: 'move' };
  }
  if (notFrontal(face, video, mode.baseline)) return { guidance: 'look_straight' };

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

/** La caja del único rostro de la lectura (para medir si se movió en la siguiente). */
function boxOf(detections: Detection[]): Box | null {
  const faces = confidentFaces(detections);
  return faces.length === 1 ? (faces[0].boundingBox ?? null) : null;
}

/** La guía en píxeles del video: de la geometría de la página si ya la hay, si no la del círculo inscrito. */
function targetOf(video: HTMLVideoElement, guide: HTMLElement | null): FaceBox {
  return guideTarget(video, guide ? video.getBoundingClientRect() : null, guide?.getBoundingClientRect() ?? null);
}

/** Lo que el detector ve en un cuadro (null si aún no hay imagen o el detector falló en él). */
function readFrame(detector: FaceDetector, video: HTMLVideoElement | null, guide: HTMLElement | null, now: number, mode: DetectionMode): (Evaluation & { moved: number | null; box: Box | null }) | null {
  if (!video || video.readyState < 2 || !video.videoWidth) return null;
  try {
    const { detections } = detector.detectForVideo(video, now);
    return {
      ...evaluate(detections, video, mode, targetOf(video, guide)),
      moved: mode.kind === 'action' ? moveProgress(detections, video, mode) : null,
      box: boxOf(detections),
    };
  } catch {
    return null;
  }
}

interface AutoCaptureOptions {
  detector: FaceDetector | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  /** El círculo de la guía (`FaceGuide`): el encuadre se mide contra lo que se dibuja. Sin él, el círculo inscrito. */
  guideRef?: RefObject<HTMLElement | null>;
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
  /**
   * Seguir leyendo cuadros sin disparar `onStable` (mientras se toman las fotos del registro, decisión del dueño,
   * 2026-10-06: cada foto cuenta solo si en ese instante el rostro sigue completo, centrado y de frente).
   */
  continuous?: boolean;
  /**
   * Nitidez del cuadro (decisión del dueño, 2026-10-07: «marca en rojo si no está enfocada»): con un rostro de frente
   * bien colocado y quieto, decide si está ENFOCADO (varianza del Laplaciano sobre su caja). `false` → guía `blurry`
   * (borde rojo, el cuadro no cuenta); `true`/`null` (no se pudo medir) → cuenta. Sin él no se evalúa la nitidez (una
   * verificación). Se lee de una referencia (no reinicia el ciclo).
   */
  quality?: (box: { originX: number; originY: number; width: number; height: number }) => boolean | null;
}

const FRONTAL: DetectionMode = { kind: 'frontal' };

/** Identidad del modo: el ciclo de detección se reinicia solo cuando cambia lo que se pide. */
function modeKey(mode: DetectionMode): string {
  if (mode.kind === 'frontal') return `frontal:${mode.baseline?.pitch ?? ''}`;
  return `${mode.action}:${mode.minimum}:${mode.baseline?.pitch}:${mode.baseline?.width}`;
}

export function useFaceAutoCapture({
  detector,
  videoRef,
  guideRef,
  enabled,
  mode = FRONTAL,
  stableFrames = 6,
  onStable,
  continuous = false,
  quality,
}: AutoCaptureOptions) {
  const [guidance, setGuidance] = useState<FaceGuidance>('loading');
  /** 0..1: avance hacia la captura automática (rostro estable). Alimenta el anillo de progreso. */
  const [progress, setProgress] = useState(0);
  /** 0..1: cuánto se ha movido la cabeza respecto a lo que pide el reto (solo en un movimiento). */
  const [move, setMove] = useState(0);
  const onStableRef = useRef(onStable);
  onStableRef.current = onStable;
  // La nitidez se lee de una referencia: cambiar de fase (del encuadre a las fotos) no reinicia el ciclo de detección.
  const qualityRef = useRef(quality);
  qualityRef.current = quality;
  const key = modeKey(mode);

  useEffect(() => {
    if (!enabled || !detector) return;
    const steadyOpts = { window: config.faceSteadyWindow, maxShift: config.faceSteadyMaxShift, graceFrames: config.faceSteadyGraceFrames };
    let raf = 0;
    let last = 0;
    let stable = 0;
    let misses = 0;
    let fired = false;
    let samples: FaceBaseline[] = [];
    // Ventana de posiciones para suavizar la quietud (contra el ruido del detector). Solo se usa de frente.
    let steady: SteadyWindow = steadyStart();
    const moving = mode.kind === 'action';
    setGuidance(moving ? 'move' : 'no_face');
    setProgress(0);
    setMove(0);

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < config.faceDetectionIntervalMs || fired) return;
      last = now;
      const reading = readFrame(detector, videoRef.current, guideRef?.current ?? null, now, mode);
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
        // De frente, antes de contar el cuadro: ¿se MUEVE (quietud suavizada, no un pico de ruido) o está BORROSO? En un
        // movimiento del reto no aplica (`holdStillGuidance`: el movimiento es lo pedido y la nitidez no se exige).
        const verdict = holdStillGuidance(reading.box, moving, qualityRef.current, steady, steadyOpts);
        steady = verdict.steady;
        next = verdict.guidance;
        if (next === 'hold_still') {
          stable++;
          samples.push(reading.sample);
          if (stable >= stableFrames && onStableRef.current && !continuous) {
            fired = true;
            next = 'ready';
            void onStableRef.current(averageSample(samples));
          }
        } else {
          stable = 0;
          samples = [];
        }
      } else {
        stable = 0;
        samples = [];
        steady = steadyStart();
      }
      const ratio = Math.min(1, stable / stableFrames);
      setProgress((prev) => (prev === ratio ? prev : ratio));
      setGuidance((prev) => (prev === next ? prev : next));
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // `mode` se representa con su clave para no reiniciar el ciclo en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detector, enabled, videoRef, guideRef, key, stableFrames, continuous]);

  return { guidance, progress, moveProgress: move };
}
