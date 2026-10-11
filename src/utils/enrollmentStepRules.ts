import { t } from '../i18n/core';
import { paths } from '../routes/paths';
import type { EnrollmentProgress, EnrollmentStepCode, EnrollmentStepState } from '../types';
import { formatDateTime } from './format';

/*
 * Reglas PURAS del registro de identidad dinámico (decisión del dueño del producto, 2026-10-08: el proceso es dinámico
 * y vive en UN solo módulo; el ADMIN decide, por empresa, cuáles pasos se piden y en qué orden; migración 0093).
 *
 * Aquí no se calcula ningún estado: solo se traduce lo que manda el servidor (`GET /enrollment/progress`) a lo que ve
 * la persona (etiqueta, aviso y botón de cada paso) y a dónde lleva cada paso. Los NOMBRES y las descripciones salen
 * del catálogo `enrollment_steps` (el backend los envía traducidos), nunca de los diccionarios. Un paso que esta
 * versión de la app no conoce se dibuja con su nombre del catálogo y sin acción: nunca rompe la pantalla.
 *
 * El mismo módulo tiene las reglas de la CONFIGURACIÓN del ADMIN (qué pasos se piden y en qué orden): son las dos
 * caras de la misma lista y compartir el módulo evita dos definiciones del mismo flujo (regla 6).
 */

/** Los pasos que esta versión sabe abrir (códigos de `catalog.enrollment_steps`). */
export const ENROLLMENT_STEP_CODES = ['OFFICIAL_ID', 'PROOF_OF_ADDRESS', 'INITIAL_PHOTO', 'FACE_CAPTURES', 'VOICE_VIDEO'] as const;

/**
 * El flujo por omisión de toda empresa (el mismo del backend, `DEFAULT_ENROLLMENT_STEPS`): exactamente lo que el
 * registro facial pedía antes de volverse configurable. Solo se usa como respaldo mientras carga la política.
 */
export const DEFAULT_ENROLLMENT_STEPS: readonly string[] = ['INITIAL_PHOTO', 'FACE_CAPTURES', 'VOICE_VIDEO'];

/** El paso que NUNCA se puede quitar: crea el registro que la empresa aprueba (el servidor lo exige). */
export const REQUIRED_ENROLLMENT_STEP = 'FACE_CAPTURES';

/** Los pasos que se cumplen subiendo un documento de identidad (su propia pantalla, sin cámara ni micrófono). */
export const DOCUMENT_STEPS: readonly string[] = ['OFFICIAL_ID', 'PROOF_OF_ADDRESS'];

const KNOWN: ReadonlySet<string> = new Set(ENROLLMENT_STEP_CODES);

/** ¿Esta versión de la app sabe dibujar y abrir este paso? (uno nuevo del backend llega como código desconocido). */
export function isEnrollmentStep(code: string | null): code is EnrollmentStepCode {
  return code !== null && KNOWN.has(code);
}

/** ¿El paso se cumple subiendo un documento? (su pantalla es un formulario, no la cámara). */
export function isDocumentStep(code: string): boolean {
  return DOCUMENT_STEPS.includes(code);
}

/** Los pasos que abren la cámara (y el micrófono en el video). */
export type CameraStepCode = 'INITIAL_PHOTO' | 'FACE_CAPTURES' | 'VOICE_VIDEO';

/**
 * ¿El paso abre la cámara o el micrófono? Solo esos se confirman ANTES de abrirse (lo que crea datos biométricos se
 * pregunta, regla 3); un paso de documentos lleva a su formulario, que confirma antes de subir el archivo.
 */
export function usesCamera(code: string): code is CameraStepCode {
  return code === 'INITIAL_PHOTO' || code === 'FACE_CAPTURES' || code === 'VOICE_VIDEO';
}

/** La pantalla de cada paso (rutas hijas de la pantalla `EMPLOYEE_ENROLL`); null si la app no lo conoce. */
export function enrollmentStepPath(code: string): string | null {
  if (!isEnrollmentStep(code)) return null;
  const screens: Record<EnrollmentStepCode, string> = {
    OFFICIAL_ID: paths.employee.enrollDocument('OFFICIAL_ID'),
    PROOF_OF_ADDRESS: paths.employee.enrollDocument('PROOF_OF_ADDRESS'),
    INITIAL_PHOTO: paths.employee.enrollPhoto,
    FACE_CAPTURES: paths.employee.enrollCapture,
    VOICE_VIDEO: paths.employee.enrollVoice,
  };
  return screens[code];
}

/** El paso del flujo con ese código (undefined si la empresa no lo pide). */
export function stepOf(progress: EnrollmentProgress, code: string): EnrollmentStepState | undefined {
  return progress.steps.find((step) => step.code === code);
}

/** Lo que necesita el índice para abrir un paso: el paso del flujo y su pantalla. */
export interface OpenableStep {
  step: EnrollmentStepState;
  path: string;
}

/**
 * El paso del flujo que abre el botón del índice, con su pantalla. El índice solo da botón a los pasos que dibuja
 * (`actionOf`: los del flujo que esta versión conoce), así que ambos existen siempre. Si alguna vez faltara uno sería un
 * fallo de la app, no una situación de la persona: se lanza con un código estable (el manejador global lo reporta al
 * ADMIN) en lugar de ignorar el toque sin avisar ni dejar en la pantalla una guarda que nunca se ejecuta.
 */
export function openableStep(progress: EnrollmentProgress, code: string): OpenableStep {
  const step = stepOf(progress, code);
  const path = enrollmentStepPath(code);
  if (step === undefined || path === null) throw new Error('ENROLLMENT_STEP_NOT_OPENABLE');
  return { step, path };
}

/**
 * ¿Un paso HECHO se puede repetir? La foto inicial, mientras su borrador siga vigente (`expires_at`); un documento,
 * siempre (subir otro lo reemplaza). Las capturas y el video no: ya están con la empresa.
 */
function repeatable(step: EnrollmentStepState): boolean {
  if (step.code === 'INITIAL_PHOTO') return step.expires_at !== null;
  return isDocumentStep(step.code);
}

// --------------------------------------------------------------------- el índice

/** Cómo se ve el estado: por hacer, hecho, bloqueado (falta otro paso) o algo que repetir (vencido, sin intentos). */
export type EnrollmentStepTone = 'pending' | 'done' | 'locked' | 'warn';

/** El botón de un paso: su texto (llave de `employee.enrollment.index.action`) y si es la acción principal. */
export type EnrollmentActionLabel = 'photo' | 'retakePhoto' | 'captures' | 'video' | 'resumeVideo' | 'document' | 'replaceDocument';

export interface EnrollmentStepAction {
  label: EnrollmentActionLabel;
  primary: boolean;
}

export interface EnrollmentStepView {
  code: string;
  /** Su lugar en el flujo de esta empresa (1 = el primero): lo decide el ADMIN, lo envía el servidor. */
  position: number;
  /** Esta versión de la app sabe abrirlo (uno desconocido se dibuja atenuado y sin acción). */
  known: boolean;
  tone: EnrollmentStepTone;
  /** El estado en pocas palabras («Pendiente», «Completado · 7 oct 2026, 10:15», «2 de 3 respondidas»). */
  badge: string;
  /** Qué hacer, qué falta o hasta cuándo sirve (null si no hace falta). */
  hint: string | null;
  action: EnrollmentStepAction | null;
}

/** La acción de cada paso conocido: al hacerlo y, si se puede repetir, al repetirlo. */
const ACTIONS: Record<EnrollmentStepCode, { open: EnrollmentActionLabel; again: EnrollmentActionLabel | null }> = {
  OFFICIAL_ID: { open: 'document', again: 'replaceDocument' },
  PROOF_OF_ADDRESS: { open: 'document', again: 'replaceDocument' },
  INITIAL_PHOTO: { open: 'photo', again: 'retakePhoto' },
  FACE_CAPTURES: { open: 'captures', again: null },
  VOICE_VIDEO: { open: 'video', again: null },
};

const TONES: Record<EnrollmentStepState['status'], EnrollmentStepTone> = {
  done: 'done',
  pending: 'pending',
  blocked: 'locked',
  expired: 'warn',
  exhausted: 'warn',
};

/**
 * ¿El video ya tiene respuestas aceptadas? Solo ese paso trae `answered`/`total` (los demás, null). Es un predicado de
 * tipo: quien lo cumple tiene los dos números, así que nadie necesita un respaldo `?? 0` (sería código inalcanzable).
 */
const started = (step: EnrollmentStepState): step is EnrollmentStepState & { answered: number; total: number } => step.answered !== null && step.answered > 0 && step.total !== null;

/** El estado en pocas palabras. Se arma al dibujarse: sigue al idioma activo (regla 16, en caliente). */
function badgeOf(step: EnrollmentStepState): string {
  if (step.status === 'done') {
    return step.done_at ? t('employee.enrollment.index.state.done', { date: formatDateTime(step.done_at) }) : t('employee.enrollment.index.state.complete');
  }
  if (step.status === 'blocked') return t('employee.enrollment.index.state.locked');
  if (step.status === 'expired') return t('employee.enrollment.index.state.expired');
  if (step.status === 'exhausted') return t('employee.enrollment.index.state.exhausted');
  return started(step) ? t('employee.enrollment.index.state.answered', { answered: step.answered, total: step.total }) : t('employee.enrollment.index.state.pending');
}

/** Qué falta o hasta cuándo sirve lo hecho; `name` nombra el paso que bloquea (catálogo, ya traducido). */
function hintOf(step: EnrollmentStepState, known: boolean, name: (code: string | null) => string): string | null {
  if (!known) return t('employee.enrollment.index.hint.unknown');
  if (step.status === 'blocked') return t('employee.enrollment.index.hint.blocked', { step: name(step.blocked_by) });
  if (step.status === 'expired') return t('employee.enrollment.index.hint.expired');
  if (step.status === 'exhausted') return t('employee.enrollment.index.hint.exhausted');
  if (step.status === 'done' && step.expires_at) return t('employee.enrollment.index.hint.validUntil', { date: formatDateTime(step.expires_at) });
  return null;
}

/** El botón del paso: hacerlo (acción principal) o repetirlo (secundaria); null si ahora no se puede. */
function actionOf(step: EnrollmentStepState): EnrollmentStepAction | null {
  if (!isEnrollmentStep(step.code)) return null;
  const { open, again } = ACTIONS[step.code];
  if (step.status === 'pending' || step.status === 'expired') {
    return { label: step.code === 'VOICE_VIDEO' && started(step) ? 'resumeVideo' : open, primary: true };
  }
  return step.status === 'done' && again !== null && repeatable(step) ? { label: again, primary: false } : null;
}

/**
 * Los pasos del índice EN EL ORDEN que mandó el servidor (el que configuró el ADMIN), con su estado, su aviso y su
 * botón. Nada se calcula: un estado nuevo va primero al backend.
 */
export function enrollmentStepViews(progress: EnrollmentProgress, name: (code: string | null) => string): EnrollmentStepView[] {
  return progress.steps.map((step) => {
    const known = isEnrollmentStep(step.code);
    return { code: step.code, position: step.position, known, tone: known ? TONES[step.status] : 'locked', badge: badgeOf(step), hint: hintOf(step, known, name), action: actionOf(step) };
  });
}

// ------------------------------------------------- el indicador sobre el visor

/** Un paso del indicador: su código (su nombre sale del catálogo) y si el SERVIDOR lo da por hecho. */
export interface StepperStep {
  code: string;
  done: boolean;
}

/** Los pasos del indicador tal como los reporta el servidor (lo verde solo sale de ahí). */
export function stepperSteps(progress: EnrollmentProgress): StepperStep[] {
  return progress.steps.map((step) => ({ code: step.code, done: step.status === 'done' }));
}

/** Los pasos de un flujo YA terminado (la pantalla «En validación»: el servidor dejó el registro con la empresa).
 * Con la verificación por voz apagada el servidor NO pide el video (`flow()`): aquí se descuenta igual. */
export function completedSteps(codes: readonly string[], voiceVerification = true): StepperStep[] {
  return codes.filter((code) => voiceVerification || code !== 'VOICE_VIDEO').map((code) => ({ code, done: true }));
}

// -------------------------------------------- la pantalla de un paso (su candado)

/** Por qué no se puede abrir un paso ahora (su pantalla lo explica con su vacío). */
export type EnrollmentStepBlock = 'unknown' | 'disabled' | 'blocked' | 'done' | 'exhausted';

export interface EnrollmentStepGate {
  reason: EnrollmentStepBlock;
  /** El paso que debe hacerse antes (solo con `blocked`); su nombre sale del catálogo. */
  step: string | null;
}

/**
 * Si la pantalla de un paso se abre cuando no toca (un enlace guardado, recargar, la empresa cambió su flujo), dice
 * qué pasa en lugar de abrir la cámara para que el servidor responda 409. Null = se puede abrir.
 */
export function enrollmentStepBlock(code: string, progress: EnrollmentProgress): EnrollmentStepGate | null {
  if (!isEnrollmentStep(code)) return { reason: 'unknown', step: null };
  const step = stepOf(progress, code);
  if (step === undefined) return { reason: 'disabled', step: null };
  if (step.status === 'exhausted') return { reason: 'exhausted', step: null };
  if (step.status === 'blocked') return { reason: 'blocked', step: step.blocked_by };
  return step.status === 'done' && !repeatable(step) ? { reason: 'done', step: null } : null;
}

// ------------------------------------- la configuración del ADMIN (qué pasos y en qué orden)

/** Una fila de la configuración del flujo: el paso, si se pide, su lugar y si se puede mover o apagar. */
export interface EnrollmentFlowRow {
  code: string;
  /** Su lugar en el flujo (1 = el primero) o null si la empresa no lo pide. */
  position: number | null;
  enabled: boolean;
  /** No se puede apagar: es el registro que la empresa aprueba (422 `INVALID_ENROLLMENT_STEPS`). */
  locked: boolean;
  canUp: boolean;
  canDown: boolean;
}

/**
 * Las filas que ve el ADMIN: primero los pasos que la empresa pide, EN SU ORDEN, y después los que no pide (en el
 * orden del catálogo). Un código que la empresa pide y el catálogo ya no trae (otra versión del backend) también
 * aparece: nada se oculta.
 */
export function enrollmentFlowRows(codes: readonly string[], catalogCodes: readonly string[]): EnrollmentFlowRow[] {
  const enabled = codes.filter((code, index) => codes.indexOf(code) === index);
  const locked = (code: string) => code === REQUIRED_ENROLLMENT_STEP;
  const on = enabled.map((code, index) => ({ code, position: index + 1, enabled: true, locked: locked(code), canUp: index > 0, canDown: index < enabled.length - 1 }));
  const off = catalogCodes.filter((code) => !enabled.includes(code)).map((code) => ({ code, position: null, enabled: false, locked: locked(code), canUp: false, canDown: false }));
  return [...on, ...off];
}

/** Pedir un paso (se agrega al FINAL del flujo) o dejar de pedirlo (sale de la lista). */
export function toggleEnrollmentStep(codes: readonly string[], code: string, on: boolean): string[] {
  if (!on) return codes.filter((current) => current !== code);
  return codes.includes(code) ? [...codes] : [...codes, code];
}

/** Mover un paso un lugar arriba (`-1`) o abajo (`+1`); fuera de la lista, la lista no cambia. */
export function moveEnrollmentStep(codes: readonly string[], code: string, delta: -1 | 1): string[] {
  const from = codes.indexOf(code);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= codes.length) return [...codes];
  const moved = [...codes];
  moved[from] = moved[to];
  moved[to] = code;
  return moved;
}
