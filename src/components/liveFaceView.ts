import { guidanceMessage, type DetectionMode, type FaceGuidance } from '../hooks/useFaceDetection';
import { isSteadyGuidance, type FrontalPhoto } from '../hooks/useFrontalCapture';
import { t } from '../i18n/core';
import type { FaceChallenge, LivenessAction } from '../types';
import { config } from '../utils/config';
import type { FaceBaseline } from '../utils/facePose';
import { formatRate } from '../utils/numbers';
import { guidanceTone, type Tone } from './FaceGuide';
import { currentStage, stageInfo, type Phase, type ScanStage } from './FaceScan';

/*
 * Reglas puras del escáner facial (LiveFaceFlow): qué se mide en cada fase y qué ve la persona
 * (mensaje sobre la cámara, tono, etapa, título e indicación). Los textos se escriben al llamarse, en
 * el idioma activo, a partir de la fase, la guía y el paso (nunca se guardan ya traducidos): el flujo
 * los pide en cada dibujo y un cambio de idioma a medio escaneo los traduce sin perder el paso.
 */

/**
 * Las fotos del registro facial (decisión del dueño, 2026-10-06: 32 fotos VÁLIDAS, contadas solo si pasan la revisión
 * en vivo), de la configuración: cuántas y cómo (`LiveFaceFlow` las recibe con `{...enrollmentCapture()}` y agrega la
 * revisión en vivo con lo que ve el detector). El servidor las vuelve a validar, elige las mejores como referencia y
 * descarta las demás.
 */
export function enrollmentCapture(): { frontalFrames: number; frontalPhoto: FrontalPhoto } {
  return { frontalFrames: config.enrollmentValidPhotos, frontalPhoto: { maxSide: config.enrollmentPhotoPx, gapMs: config.enrollmentPhotoGapMs } };
}

export interface FlowStatusInput {
  phase: Phase;
  guidance: FaceGuidance;
  blockedMessage?: string;
  instruction?: string | null;
  submittingMessage: string;
  detectorReady: boolean;
  detectorFailed: boolean;
  capture?: { current: number; total: number } | null;
  /** 0..1: cuánto se ha hecho el movimiento de la prueba de vida. */
  moveProgress?: number;
  /** Registro facial: la cuenta es de fotos válidas y la indicación sigue a la guía mientras se toman. */
  validPhotos?: boolean;
  /** Vuelta al frente tras el último movimiento (el registro termina centrado). */
  finalRecenter?: boolean;
  /**
   * El servidor rechazó la captura por un accesorio que la empresa bloquea: la insignia sobre el rostro es el aviso y la
   * indicación grande sigue siendo de colocación («Muestra tu rostro completo»), nunca el texto del servidor que pide
   * retirarlo (decisión del dueño, 2026-10-07).
   */
  blockedByAccessory?: boolean;
}

/** Movimientos del reto en orden. */
export function challengeActions(challenge: FaceChallenge | null): LivenessAction[] {
  return challenge?.actions ?? [];
}

/** Mínimos por omisión (los pisos del servidor) si el reto no los trae. */
function actionMinimum(challenge: FaceChallenge | null, action: LivenessAction): number {
  if (action === 'TURN_LEFT' || action === 'TURN_RIGHT') return challenge?.min_yaw_ratio ?? 0.2;
  if (action === 'MOVE_CLOSER') return challenge?.min_closer_scale ?? 1.25;
  return challenge?.min_pitch_delta ?? 0.08;
}

/**
 * Qué mide el detector: el movimiento pedido (contra el rostro en reposo de las frontales) o, en cualquier otra fase,
 * el rostro de frente. Mientras se toman las fotos y al volver al frente entre movimientos, el frente se mide también
 * contra el rostro en reposo (la cabeza no subió ni bajó); al alinearse por primera vez no hay reposo todavía.
 */
export function detectionMode(phase: Phase, challenge: FaceChallenge | null, action: LivenessAction | null, baseline: FaceBaseline | null): DetectionMode {
  if (phase === 'challenge' && action) return { kind: 'action', action, minimum: actionMinimum(challenge, action), baseline };
  return { kind: 'frontal', baseline: phase === 'checking' || phase === 'recenter' ? baseline : null };
}

/**
 * Las fotos de un escaneo (decisión del dueño, 2026-10-06: «por lo menos 36 fotos» y UN solo anillo para todo el proceso):
 * - `still`: fotos completas mientras la persona mira a la cámara (las 36 del registro facial o las frontales de una
 *   verificación);
 * - `light`: fotos ligeras de ese mismo tramo (los recortes de la ráfaga que pide el reto; en el registro se toman a la
 *   par de las 36 completas y no se cuentan dos veces);
 * - `moves`: lo de los movimientos del reto (una foto por movimiento más los recortes ligeros del primero), repartido
 *   entre `steps` movimientos (los cuatro del registro; de uno a tres en una verificación).
 */
export interface CapturePlan {
  still: number;
  light: number;
  moves: number;
  steps: number;
}

/** El plan de fotos según el reto (sin prueba de vida, solo las fotos de frente). `fullStill`: registro facial. */
export function capturePlan(challenge: FaceChallenge, frontalFrames: number, fullStill: boolean): CapturePlan {
  const live = challenge.liveness_required;
  const burst = live ? challenge.burst : null;
  const steps = live ? challenge.actions.length : 0;
  return {
    still: frontalFrames,
    light: burst && !fullStill ? burst.hold : 0,
    moves: steps ? steps + (burst?.move ?? 0) : 0,
    steps,
  };
}

export interface RingInput {
  phase: Phase;
  /** null: el reto aún no llega (no se sabe cuántas fotos serán: el anillo espera). */
  plan: CapturePlan | null;
  /** Fotos completas tomadas en este escaneo y fotos ligeras del tramo quieto. */
  photos: number;
  light: number;
  /** Movimiento en curso (0 = el primero; igual a los movimientos del plan en la vuelta final al frente) y cuánto lleva hecho (0..1). */
  step: number;
  moveProgress: number;
}

const AFTER_STILL: ReadonlySet<Phase> = new Set(['challenge', 'recenter', 'submitting']);

/**
 * Avance del anillo (0..1): las fotos tomadas contra las del plan, en orden (frente, movimientos), así el anillo avanza
 * sin pausas por todo el proceso y se completa al tomar la última. Durante un movimiento sigue a la cabeza (si la
 * persona regresa, el anillo también: es la indicación de que falta girar). Al enviar queda completo.
 */
export function captureProgress({ phase, plan, photos, light, step, moveProgress }: RingInput): number {
  if (phase === 'submitting') return 1;
  if (!plan || phase === 'frontal') return 0;
  const still = AFTER_STILL.has(phase) ? plan.still + plan.light : Math.min(photos, plan.still) + Math.min(light, plan.light);
  const current = phase === 'challenge' ? moveProgress : 0;
  const moved = AFTER_STILL.has(phase) && plan.steps ? (Math.min(plan.steps, step + current) / plan.steps) * plan.moves : 0;
  return Math.min(1, (still + moved) / (plan.still + plan.light + plan.moves));
}

/** El avance del anillo de un escaneo con el reto que ya se conoce (null: aún no llega). `fullStill`: registro facial. */
export function scanProgress({
  challenge,
  frontalFrames,
  fullStill,
  ...input
}: Omit<RingInput, 'plan'> & { challenge: FaceChallenge | null; frontalFrames: number; fullStill: boolean }): number {
  return captureProgress({ ...input, plan: challenge ? capturePlan(challenge, frontalFrames, fullStill) : null });
}

const isSteady = isSteadyGuidance;

/** Mensaje durante un movimiento: la instrucción, ánimo a medio camino o lo que impide medirlo. */
function challengeStatus(input: FlowStatusInput): { message: string; tone: Tone } {
  const { guidance } = input;
  if (isSteady(guidance)) return { message: t('face.flow.holdPosition'), tone: 'ok' };
  if (guidance !== 'move') return { message: guidanceMessage(guidance), tone: 'idle' };
  // A medio movimiento se anima a terminarlo (el avance también se ve en la barra y en el anillo).
  if ((input.moveProgress ?? 0) >= 0.4) return { message: t('face.flow.almost'), tone: 'idle' };
  return { message: input.instruction ?? guidanceMessage('move'), tone: 'idle' };
}

/** Guías que no dicen qué corregir (aún no hay rostro que medir): al volver al frente se pide centrarse. */
const UNSPECIFIC: ReadonlySet<FaceGuidance> = new Set(['move', 'no_face', 'loading']);

/**
 * Tono del BORDE de la guía DURANTE la toma de fotos del registro (decisión del dueño, 2026-10-07: «marca en rojo si no
 * está enfocada correctamente y en verde cuando esté enfocada… usa los bordes»): con el cuadro VÁLIDO (nítido/enfocado +
 * dentro de la guía + de frente + con luz + quieto) → verde; con un rostro que todavía no sirve (borroso, fuera de
 * posición, en movimiento) → rojo (`bad`), en lugar del ámbar de los demás flujos; sin rostro aún, neutro.
 */
export function captureTone(guidance: FaceGuidance): Tone {
  if (isSteady(guidance)) return 'ok';
  return guidance === 'no_face' || guidance === 'loading' ? 'idle' : 'bad';
}

/**
 * Mensaje y tono mientras se toman las fotos del registro (decisión del dueño, 2026-10-07): con el rostro válido,
 * «Mantente quieto» en VERDE; si no, la indicación dice qué corregir y el borde de la guía pasa a ROJO. Un cuadro
 * inválido no cuenta, no toma foto y no reinicia nada.
 */
function photosStatus(guidance: FaceGuidance): { message: string; tone: Tone } {
  if (isSteady(guidance)) return { message: guidanceMessage('hold_still'), tone: 'ok' };
  return { message: guidanceMessage(guidance), tone: captureTone(guidance) };
}

/** De vuelta al frente entre movimientos (y al final del registro): «Centra tu rostro» o la corrección precisa. */
function recenterStatus(input: FlowStatusInput): { message: string; tone: Tone } {
  const { guidance } = input;
  if (isSteady(guidance)) return { message: t(input.finalRecenter ? 'face.flow.centered' : 'face.flow.nextStepReady'), tone: 'ok' };
  if (UNSPECIFIC.has(guidance)) return { message: t('face.flow.lookFront'), tone: 'idle' };
  return { message: guidanceMessage(guidance), tone: guidanceTone(guidance) };
}

/**
 * Mensaje y tono del visor según la fase del flujo y la guía de detección en vivo. En una verificación la indicación
 * no cambia mientras se toman las fotos («Mantente quieto»: un texto que cambiara con cada foto parpadearía); en el
 * registro sigue a la guía (solo las fotos válidas cuentan); la cuenta va aparte (`captureDetail`).
 */
export function flowStatus(input: FlowStatusInput): { message: string; tone: Tone } {
  const { phase, guidance } = input;
  if (phase === 'checking') {
    if (!input.capture) return { message: t('face.flow.analyzing'), tone: 'busy' };
    return input.validPhotos ? photosStatus(guidance) : { message: guidanceMessage('hold_still'), tone: 'busy' };
  }
  if (phase === 'submitting') return { message: input.submittingMessage, tone: 'busy' };
  if (phase === 'blocked') {
    if (input.blockedByAccessory) return { message: guidanceMessage('cut_off'), tone: 'warn' };
    return { message: input.blockedMessage ?? t('face.flow.retry'), tone: 'warn' };
  }
  if (phase === 'recenter') return recenterStatus(input);
  if (phase === 'challenge') return challengeStatus(input);
  if (input.detectorFailed) return { message: t('face.flow.manualOnly'), tone: guidanceTone(guidance) };
  // Al alinear el rostro del registro (incluida la foto inicial manual), el borde ya va en rojo/verde (decisión del dueño,
  // 2026-10-07); en una verificación sigue el ámbar de siempre.
  const tone = input.validPhotos ? captureTone(guidance) : guidanceTone(guidance);
  return { message: guidanceMessage(input.detectorReady ? guidance : 'loading'), tone };
}

/**
 * Título, indicación y rótulo de la etapa: el reto dice qué hacer y en qué paso va; un bloqueo, que se reintenta. El
 * rótulo (`label`) es lo único que se ve arriba en un teléfono: el nombre de la etapa (o el paso de la prueba de vida),
 * porque la indicación grande ya va bajo el círculo y no se repite.
 */
export function introFor(input: {
  phase: Phase;
  stage: ScanStage;
  instruction?: string | null;
  submittingMessage: string;
  step?: { current: number; total: number };
  finalRecenter?: boolean;
}): {
  title: string;
  text: string;
  label: string;
} {
  if (input.phase === 'blocked') return { title: t('face.flow.retry'), text: t('face.flow.blockedText'), label: t('face.flow.retry') };
  if (input.stage === 'liveness') {
    const liveness = stageInfo('liveness');
    const { step } = input;
    const title = step && step.total > 1 ? t('face.flow.stepTitle', { name: liveness.name, current: step.current, total: step.total }) : liveness.name;
    if (input.phase === 'recenter') return { title, text: t(input.finalRecenter ? 'face.flow.recenterEndText' : 'face.flow.recenterText'), label: title };
    return { title, text: input.instruction ?? liveness.text, label: title };
  }
  if (input.stage === 'confirm') return { title: input.submittingMessage.replace(/(?:\.+|…)$/u, ''), text: stageInfo('confirm').text, label: stageInfo('confirm').name };
  const { title, text, name } = stageInfo(input.stage);
  return { title, text, label: name };
}

const virtualCameraStatus = () => ({ message: t('face.flow.virtualCamera'), tone: 'warn' as const });

/**
 * La cuenta de las fotos bajo la indicación mientras se toman; null fuera de la toma. En el registro facial cuenta solo
 * las VÁLIDAS y se muestra en PORCENTAJE («Capturas válidas: 75 %», decisión del dueño, 2026-10-08: «los de las fotos
 * manéjalo en %»): el avance es más claro que «24/32». En una verificación sigue siendo «Foto 2 de 3» (son pocas).
 */
export function captureDetail(capture: { current: number; total: number } | null | undefined, validOnly = false): string | null {
  if (!capture) return null;
  if (validOnly) {
    const percent = capture.total > 0 ? Math.round((capture.current / capture.total) * 100) : 0;
    return t('face.flow.validPhotos', { percent: formatRate(percent, 0) });
  }
  return t('face.flow.photo', { current: capture.current, total: capture.total });
}

export interface ScannerViewInput extends Omit<FlowStatusInput, 'instruction' | 'finalRecenter'> {
  challenge: FaceChallenge | null;
  /** Movimiento del reto en curso (0 = el primero; igual al total en la vuelta final al frente del registro). */
  step: number;
  virtualCamera: boolean;
}

/** Lo que muestra el visor según la fase, el reto y la cámara: mensaje, tono, la cuenta de las fotos, etapa y título (el
 * anillo de las fotos lo da `captureProgress`). */
export function scannerView(input: ScannerViewInput) {
  const actions = challengeActions(input.challenge);
  const instruction = input.challenge?.instructions?.[input.step] ?? input.challenge?.instruction;
  const stage = currentStage(input.phase, input.guidance);
  const finalRecenter = input.phase === 'recenter' && actions.length > 0 && input.step >= actions.length;
  const total = Math.max(actions.length, 1);
  return {
    ...(input.virtualCamera ? virtualCameraStatus() : flowStatus({ ...input, instruction, finalRecenter })),
    detail: captureDetail(input.capture, input.validPhotos),
    stage,
    intro: introFor({
      phase: input.phase,
      stage,
      instruction,
      submittingMessage: input.submittingMessage,
      step: { current: Math.min(input.step + 1, total), total },
      finalRecenter,
    }),
  };
}

/** Fases en que la cámara busca el rostro (frontal, movimiento o regreso al frente). */
export const SCANNING_PHASES: ReadonlySet<Phase> = new Set<Phase>(['frontal', 'challenge', 'recenter']);

/**
 * ¿El detector lee el rostro en esta fase? En las del escaneo siempre; en el registro también mientras se toman las fotos
 * (`checking`, sin disparar nada): cada foto cuenta solo si en ese instante el rostro sigue completo, centrado y de frente.
 */
export function detectorActive(phase: Phase, enrollment: boolean): boolean {
  return SCANNING_PHASES.has(phase) || (enrollment && phase === 'checking');
}

/** Opciones de la auto-captura según la fase (reglas puras, para que `LiveFaceFlow` no acumule condiciones). */
export interface AutoCaptureFlags {
  /** El detector dispara y mide (cámara lista, fase de detección, no virtual). */
  enabled: boolean;
  /** Cuántos cuadros estables seguidos exige antes de capturar (más al alinear por primera vez). */
  stableFrames: number;
  /** Lee de continuo sin disparar (mientras se toman las fotos del registro). */
  continuous: boolean;
  /** Evalúa la nitidez del cuadro (solo el registro, al alinear y al tomar). */
  quality: boolean;
}
export function autoCaptureFlags(phase: Phase, enrollment: boolean, cameraReady: boolean, detecting: boolean, virtualCamera: boolean): AutoCaptureFlags {
  return {
    enabled: cameraReady && detecting && !virtualCamera,
    stableFrames: phase === 'frontal' ? 6 : 3,
    continuous: phase === 'checking',
    quality: enrollment && (phase === 'frontal' || phase === 'checking'),
  };
}

/** La vigilancia de accesorios en vivo corre solo en el registro, con la cámara lista (no virtual), al alinear o al tomar. */
export function accessoryWatchEnabled(enrollment: boolean, cameraReady: boolean, virtualCamera: boolean, phase: Phase): boolean {
  return enrollment && cameraReady && !virtualCamera && (phase === 'frontal' || phase === 'checking');
}

/** El obturador de la foto inicial manual se habilita con la cámara lista (no virtual), en la fase frontal y con el cuadro válido (o sin detector, de respaldo). */
export function shutterEnabled(cameraReady: boolean, virtualCamera: boolean, phase: Phase, detectorFailed: boolean, steady: boolean): boolean {
  return cameraReady && !virtualCamera && phase === 'frontal' && (detectorFailed || steady);
}

/** El disparo manual de respaldo se deshabilita sin cámara lista, fuera del escaneo o con cámara virtual. */
export function manualCaptureDisabled(cameraReady: boolean, scanning: boolean, virtualCamera: boolean): boolean {
  return !cameraReady || !scanning || virtualCamera;
}
