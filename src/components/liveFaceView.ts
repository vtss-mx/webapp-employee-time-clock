import { FACE_GUIDANCE_MESSAGES, type DetectionMode, type FaceGuidance } from '../hooks/useFaceDetection';
import type { FaceChallenge, LivenessAction } from '../types';
import type { FaceBaseline } from '../utils/facePose';
import { guidanceTone, type Tone } from './FaceGuide';
import { currentStage, STAGE_INFO, type Phase, type ScanStage } from './FaceScan';

/*
 * Reglas puras del escáner facial (LiveFaceFlow): qué se mide en cada fase y qué ve la persona
 * (mensaje sobre la cámara, tono, etapa, título e indicación).
 */

/** Indicación del destello de colores (sobre el color y en el visor). */
export const FLASH_HINT = 'Mantén tu rostro frente a la pantalla';

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

/** Avance de la prueba de vida (0..1): el del movimiento en curso o, durante el destello, el de los colores. */
export function livenessProgress(phase: Phase, flash: { index: number; total: number }, moveProgress: number): number {
  return phase === 'flash' && flash.total ? (flash.index + 1) / flash.total : moveProgress;
}

const isSteady = (guidance: FaceGuidance) => guidance === 'hold_still' || guidance === 'ready';

/** Mensaje durante un movimiento: la instrucción, ánimo a medio camino o lo que impide medirlo. */
function challengeStatus(input: FlowStatusInput): { message: string; tone: Tone } {
  const { guidance } = input;
  if (isSteady(guidance)) return { message: '¡Bien! Mantén la posición...', tone: 'ok' };
  if (guidance !== 'move') return { message: FACE_GUIDANCE_MESSAGES[guidance], tone: 'idle' };
  // A medio movimiento se anima a terminarlo (el avance también se ve en la barra y en el anillo).
  if ((input.moveProgress ?? 0) >= 0.4) return { message: 'Un poco más...', tone: 'idle' };
  return { message: input.instruction ?? FACE_GUIDANCE_MESSAGES.move, tone: 'idle' };
}

/** Mensaje y tono del visor según la fase del flujo y la guía de detección en vivo. */
export function flowStatus(input: FlowStatusInput): { message: string; tone: Tone } {
  const { phase, guidance } = input;
  if (phase === 'checking') {
    const capture = input.capture;
    return { message: capture ? `Capturando ${capture.current} de ${capture.total}...` : 'Analizando...', tone: 'busy' };
  }
  if (phase === 'submitting') return { message: input.submittingMessage, tone: 'busy' };
  if (phase === 'blocked') return { message: input.blockedMessage ?? 'Intentemos de nuevo', tone: 'warn' };
  if (phase === 'flash') return { message: FLASH_HINT, tone: 'busy' };
  if (phase === 'recenter') {
    if (isSteady(guidance)) return { message: '¡Bien! Prepárate para el siguiente paso...', tone: 'ok' };
    return { message: 'Vuelve a mirar al frente', tone: 'idle' };
  }
  if (phase === 'challenge') return challengeStatus(input);
  if (input.detectorFailed) return { message: 'Detección automática no disponible. Usa "Capturar".', tone: guidanceTone(guidance) };
  return { message: FACE_GUIDANCE_MESSAGES[input.detectorReady ? guidance : 'loading'], tone: guidanceTone(guidance) };
}

/** Título e indicación de la etapa: el reto dice qué hacer y en qué paso va; un bloqueo, que se reintenta. */
export function introFor(input: { phase: Phase; stage: ScanStage; instruction?: string | null; submittingMessage: string; step?: { current: number; total: number } }): {
  title: string;
  text: string;
} {
  if (input.phase === 'blocked') return { title: 'Intentemos de nuevo', text: 'Corrige lo que se indica en la cámara; el escaneo se reanuda solo.' };
  if (input.stage === 'liveness') {
    const name = STAGE_INFO.liveness.name;
    if (input.phase === 'flash') return { title: `${name} · destello`, text: `${FLASH_HINT} mientras cambia de color.` };
    const { step } = input;
    const title = step && step.total > 1 ? `${name} · paso ${step.current} de ${step.total}` : name;
    if (input.phase === 'recenter') return { title, text: 'Vuelve a mirar al frente para el siguiente paso.' };
    return { title, text: input.instruction ?? STAGE_INFO.liveness.text };
  }
  if (input.stage === 'confirm') return { title: input.submittingMessage.replace(/\.+$/, ''), text: STAGE_INFO.confirm.text };
  return STAGE_INFO[input.stage];
}

const VIRTUAL_CAMERA_STATUS = { message: 'Cámara virtual no permitida: elige la cámara del dispositivo', tone: 'warn' as const };

export interface ScannerViewInput extends Omit<FlowStatusInput, 'instruction'> {
  /** 0..1: avance de la detección frontal (el movimiento usa `moveProgress`). */
  progress: number;
  challenge: FaceChallenge | null;
  /** Movimiento del reto en curso (0 = el primero). */
  step: number;
  virtualCamera: boolean;
}

/** Lo que muestra el visor según la fase, el reto y la cámara: mensaje, tono, etapa, anillo y título. */
export function scannerView(input: ScannerViewInput) {
  const actions = challengeActions(input.challenge);
  const instruction = input.challenge?.instructions?.[input.step] ?? input.challenge?.instruction;
  const stage = currentStage(input.phase, input.guidance);
  return {
    ...(input.virtualCamera ? VIRTUAL_CAMERA_STATUS : flowStatus({ ...input, instruction })),
    stage,
    ringProgress: stage === 'liveness' ? (input.moveProgress ?? 0) : input.progress,
    intro: introFor({ phase: input.phase, stage, instruction, submittingMessage: input.submittingMessage, step: { current: input.step + 1, total: Math.max(actions.length, 1) } }),
  };
}
