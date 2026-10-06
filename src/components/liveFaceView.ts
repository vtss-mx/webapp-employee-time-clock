import { guidanceMessage, type DetectionMode, type FaceGuidance } from '../hooks/useFaceDetection';
import type { FrontalPhoto } from '../hooks/useFrontalCapture';
import { t } from '../i18n/core';
import type { FaceChallenge, LivenessAction } from '../types';
import { config } from '../utils/config';
import type { FaceBaseline } from '../utils/facePose';
import { guidanceTone, type Tone } from './FaceGuide';
import { currentStage, stageInfo, type Phase, type ScanStage } from './FaceScan';

/*
 * Reglas puras del escáner facial (LiveFaceFlow): qué se mide en cada fase y qué ve la persona
 * (mensaje sobre la cámara, tono, etapa, título e indicación). Los textos se escriben al llamarse, en
 * el idioma activo, a partir de la fase, la guía y el paso (nunca se guardan ya traducidos): el flujo
 * los pide en cada dibujo y un cambio de idioma a medio escaneo los traduce sin perder el paso.
 */

/**
 * Las fotos del registro facial (decisión del dueño, 2026-10-06: «por lo menos 36»), de la configuración: cuántas y
 * cómo (`LiveFaceFlow` las recibe con `{...enrollmentCapture()}`). El servidor las analiza todas, elige las mejores como
 * referencia y descarta las demás.
 */
export function enrollmentCapture(): { frontalFrames: number; frontalPhoto: FrontalPhoto } {
  return { frontalFrames: config.enrollmentFrames, frontalPhoto: { maxSide: config.enrollmentPhotoPx, gapMs: config.enrollmentPhotoGapMs } };
}

/** Indicación del destello de colores (sobre el color y en el visor). */
export const flashHint = () => t('face.flash.hint');

export interface FlowStatusInput {
  phase: Phase;
  guidance: FaceGuidance;
  blockedMessage?: string;
  instruction?: string | null;
  submittingMessage: string;
  detectorReady: boolean;
  detectorFailed: boolean;
  capture?: { current: number; total: number } | null;
  /** 0..1: cuánto se ha hecho el movimiento de la prueba de vida (o los colores del destello). */
  moveProgress?: number;
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
 * Qué mide el detector: el movimiento pedido (contra el rostro en reposo de las frontales) o, en
 * cualquier otra fase, el rostro de frente.
 */
export function detectionMode(phase: Phase, challenge: FaceChallenge | null, action: LivenessAction | null, baseline: FaceBaseline | null): DetectionMode {
  if (phase !== 'challenge' || !action) return { kind: 'frontal' };
  return { kind: 'action', action, minimum: actionMinimum(challenge, action), baseline };
}

/**
 * Las fotos de un escaneo (decisión del dueño, 2026-10-06: «por lo menos 36 fotos» y UN solo anillo para todo el proceso):
 * - `still`: fotos completas mientras la persona mira a la cámara (las 36 del registro facial o las frontales de una
 *   verificación);
 * - `light`: fotos ligeras de ese mismo tramo (los recortes de la ráfaga que pide el reto; en el registro se toman a la
 *   par de las 36 completas y no se cuentan dos veces);
 * - `flash`: una por color del destello;
 * - `moves`: lo de los movimientos del reto (una foto por movimiento más los recortes ligeros del primero), repartido
 *   entre `steps` movimientos.
 */
export interface CapturePlan {
  still: number;
  light: number;
  flash: number;
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
    flash: live ? challenge.flash.length || (challenge.flash_pace?.total ?? 0) : 0,
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
  flash: { index: number; total: number };
  /** Movimiento en curso (0 = el primero) y cuánto lleva hecho (0..1). */
  step: number;
  moveProgress: number;
}

const AFTER_STILL: ReadonlySet<Phase> = new Set(['flash', 'challenge', 'recenter', 'submitting']);
const AFTER_FLASH: ReadonlySet<Phase> = new Set(['challenge', 'recenter', 'submitting']);

/**
 * Avance del anillo de 36 marcas (0..1): las fotos tomadas contra las del plan, en orden (frente, destello,
 * movimientos), así el anillo avanza sin pausas por todo el proceso y se completa al tomar la última. Durante un
 * movimiento sigue a la cabeza (si la persona regresa, el anillo también: es la indicación de que falta girar). Al
 * enviar queda completo (la marca ✓).
 */
export function captureProgress({ phase, plan, photos, light, flash, step, moveProgress }: RingInput): number {
  if (phase === 'submitting') return 1;
  if (!plan || phase === 'frontal') return 0;
  const still = AFTER_STILL.has(phase) ? plan.still + plan.light : Math.min(photos, plan.still) + Math.min(light, plan.light);
  const colors = AFTER_FLASH.has(phase) ? plan.flash : phase === 'flash' ? Math.min(flash.index, plan.flash) : 0;
  const current = phase === 'challenge' ? moveProgress : 0;
  const moved = AFTER_FLASH.has(phase) && plan.steps ? (Math.min(plan.steps, step + current) / plan.steps) * plan.moves : 0;
  return Math.min(1, (still + colors + moved) / (plan.still + plan.light + plan.flash + plan.moves));
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

/** Avance de la prueba de vida (0..1): el del movimiento en curso o, durante el destello, el de los colores. */
export function livenessProgress(phase: Phase, flash: { index: number; total: number }, moveProgress: number): number {
  return phase === 'flash' && flash.total ? (flash.index + 1) / flash.total : moveProgress;
}

const isSteady = (guidance: FaceGuidance) => guidance === 'hold_still' || guidance === 'ready';

/** Mensaje durante un movimiento: la instrucción, ánimo a medio camino o lo que impide medirlo. */
function challengeStatus(input: FlowStatusInput): { message: string; tone: Tone } {
  const { guidance } = input;
  if (isSteady(guidance)) return { message: t('face.flow.holdPosition'), tone: 'ok' };
  if (guidance !== 'move') return { message: guidanceMessage(guidance), tone: 'idle' };
  // A medio movimiento se anima a terminarlo (el avance también se ve en la barra y en el anillo).
  if ((input.moveProgress ?? 0) >= 0.4) return { message: t('face.flow.almost'), tone: 'idle' };
  return { message: input.instruction ?? guidanceMessage('move'), tone: 'idle' };
}

/**
 * Mensaje y tono del visor según la fase del flujo y la guía de detección en vivo. Mientras se toman las fotos la
 * indicación no cambia («Mantente quieto»: un texto que cambiara con cada foto parpadearía); la cuenta va aparte
 * (`captureDetail`).
 */
export function flowStatus(input: FlowStatusInput): { message: string; tone: Tone } {
  const { phase, guidance } = input;
  if (phase === 'checking') return { message: input.capture ? guidanceMessage('hold_still') : t('face.flow.analyzing'), tone: 'busy' };
  if (phase === 'submitting') return { message: input.submittingMessage, tone: 'busy' };
  if (phase === 'blocked') return { message: input.blockedMessage ?? t('face.flow.retry'), tone: 'warn' };
  if (phase === 'flash') return { message: flashHint(), tone: 'busy' };
  if (phase === 'recenter') {
    if (isSteady(guidance)) return { message: t('face.flow.nextStepReady'), tone: 'ok' };
    return { message: t('face.flow.lookFront'), tone: 'idle' };
  }
  if (phase === 'challenge') return challengeStatus(input);
  if (input.detectorFailed) return { message: t('face.flow.manualOnly'), tone: guidanceTone(guidance) };
  return { message: guidanceMessage(input.detectorReady ? guidance : 'loading'), tone: guidanceTone(guidance) };
}

/**
 * Título, indicación y rótulo de la etapa: el reto dice qué hacer y en qué paso va; un bloqueo, que se reintenta. El
 * rótulo (`label`) es lo único que se ve arriba en un teléfono: el nombre de la etapa (o el paso de la prueba de vida),
 * porque la indicación grande ya va bajo el círculo y no se repite.
 */
export function introFor(input: { phase: Phase; stage: ScanStage; instruction?: string | null; submittingMessage: string; step?: { current: number; total: number } }): {
  title: string;
  text: string;
  label: string;
} {
  if (input.phase === 'blocked') return { title: t('face.flow.retry'), text: t('face.flow.blockedText'), label: t('face.flow.retry') };
  if (input.stage === 'liveness') {
    const liveness = stageInfo('liveness');
    if (input.phase === 'flash') {
      const title = t('face.flow.flashTitle', { name: liveness.name });
      return { title, text: t('face.flow.flashText'), label: title };
    }
    const { step } = input;
    const title = step && step.total > 1 ? t('face.flow.stepTitle', { name: liveness.name, current: step.current, total: step.total }) : liveness.name;
    if (input.phase === 'recenter') return { title, text: t('face.flow.recenterText'), label: title };
    return { title, text: input.instruction ?? liveness.text, label: title };
  }
  if (input.stage === 'confirm') return { title: input.submittingMessage.replace(/(?:\.+|…)$/u, ''), text: stageInfo('confirm').text, label: stageInfo('confirm').name };
  const { title, text, name } = stageInfo(input.stage);
  return { title, text, label: name };
}

const virtualCameraStatus = () => ({ message: t('face.flow.virtualCamera'), tone: 'warn' as const });

/** La cuenta de las fotos bajo la indicación («Foto 12 de 36») mientras se toman; null fuera de la toma. */
export function captureDetail(capture: { current: number; total: number } | null | undefined): string | null {
  return capture ? t('face.flow.photo', { current: capture.current, total: capture.total }) : null;
}

export interface ScannerViewInput extends Omit<FlowStatusInput, 'instruction'> {
  challenge: FaceChallenge | null;
  /** Movimiento del reto en curso (0 = el primero). */
  step: number;
  virtualCamera: boolean;
}

/** Lo que muestra el visor según la fase, el reto y la cámara: mensaje, tono, la cuenta de las fotos, etapa y título (el
 * anillo de las fotos lo da `captureProgress`). */
export function scannerView(input: ScannerViewInput) {
  const actions = challengeActions(input.challenge);
  const instruction = input.challenge?.instructions?.[input.step] ?? input.challenge?.instruction;
  const stage = currentStage(input.phase, input.guidance);
  return {
    ...(input.virtualCamera ? virtualCameraStatus() : flowStatus({ ...input, instruction })),
    detail: captureDetail(input.capture),
    stage,
    intro: introFor({ phase: input.phase, stage, instruction, submittingMessage: input.submittingMessage, step: { current: input.step + 1, total: Math.max(actions.length, 1) } }),
  };
}
