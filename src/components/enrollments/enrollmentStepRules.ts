import { t } from '../../i18n/core';
import { paths } from '../../routes/paths';
import type { EnrollmentProgress } from '../../types';
import { formatDateTime } from '../../utils/format';

/*
 * Reglas puras del índice del registro facial (decisión del dueño del producto, 2026-10-07: tres opciones
 * independientes, cada una retomable). Solo traducen lo que manda el servidor (`GET /enrollment/progress`) a lo que ve la
 * persona: estado, aviso y botón de cada paso. Ningún estado se calcula aquí: el orden lo exige el servidor.
 */

export type EnrollmentStepKey = 'photo' | 'captures' | 'video';

/** Cómo se ve el estado: por hacer, hecho, bloqueado (falta el anterior) o algo que repetir (vencida, agotados). */
export type EnrollmentStepTone = 'pending' | 'done' | 'locked' | 'warn';

/** La pantalla de cada paso (las rutas hijas de la pantalla `EMPLOYEE_ENROLL`). */
export const ENROLLMENT_STEP_PATHS: Record<EnrollmentStepKey, string> = {
  photo: paths.employee.enrollPhoto,
  captures: paths.employee.enrollCapture,
  video: paths.employee.enrollVoice,
};

/** El botón de un paso: su texto (llave de `employee.enrollment.index.action`) y si es el principal (lleva a su pantalla). */
export interface EnrollmentStepAction {
  label: 'photo' | 'retakePhoto' | 'captures' | 'video' | 'resumeVideo';
  primary: boolean;
}

export interface EnrollmentStepView {
  key: EnrollmentStepKey;
  tone: EnrollmentStepTone;
  /** El estado en pocas palabras («Pendiente», «Completado · 7 oct 2026, 10:15», «2 de 3 respondidas»). */
  badge: string;
  /** Qué hacer o hasta cuándo (null si no hace falta). */
  hint: string | null;
  action: EnrollmentStepAction | null;
}

function photoView({ photo, capture }: EnrollmentProgress): EnrollmentStepView {
  const take = { label: 'photo', primary: true } as const;
  if (photo.status === 'pending') return { key: 'photo', tone: 'pending', badge: t('employee.enrollment.index.state.pending'), hint: null, action: take };
  if (photo.status === 'expired') return { key: 'photo', tone: 'warn', badge: t('employee.enrollment.index.state.expired'), hint: t('employee.enrollment.index.hint.expired'), action: take };
  const done = { key: 'photo', tone: 'done', badge: t('employee.enrollment.index.state.done', { date: formatDateTime(photo.checked_at) }) } as const;
  // Ya usada en las capturas: no se repite (repetirla obligaría a repetir las capturas).
  if (capture.status === 'done') return { ...done, hint: null, action: null };
  return { ...done, hint: t('employee.enrollment.index.hint.validUntil', { date: formatDateTime(photo.expires_at) }), action: { label: 'retakePhoto', primary: false } };
}

function captureView({ capture }: EnrollmentProgress): EnrollmentStepView {
  if (capture.status === 'locked') return { key: 'captures', tone: 'locked', badge: t('employee.enrollment.index.state.locked'), hint: t('employee.enrollment.index.hint.needsPhoto'), action: null };
  if (capture.status === 'done') return { key: 'captures', tone: 'done', badge: t('employee.enrollment.index.state.done', { date: formatDateTime(capture.submitted_at) }), hint: null, action: null };
  return { key: 'captures', tone: 'pending', badge: t('employee.enrollment.index.state.pending'), hint: null, action: { label: 'captures', primary: true } };
}

function videoView({ voice }: EnrollmentProgress): EnrollmentStepView {
  if (voice.status === 'locked') return { key: 'video', tone: 'locked', badge: t('employee.enrollment.index.state.locked'), hint: t('employee.enrollment.index.hint.needsCaptures'), action: null };
  if (voice.status === 'exhausted') return { key: 'video', tone: 'warn', badge: t('employee.enrollment.index.state.exhausted'), hint: t('employee.enrollment.index.hint.exhausted'), action: null };
  if (voice.status === 'done') return { key: 'video', tone: 'done', badge: t('employee.enrollment.index.state.complete'), hint: null, action: null };
  const started = voice.answered > 0;
  return {
    key: 'video',
    tone: 'pending',
    badge: started ? t('employee.enrollment.index.state.answered', { answered: voice.answered, total: voice.total }) : t('employee.enrollment.index.state.pending'),
    hint: null,
    action: { label: started ? 'resumeVideo' : 'video', primary: true },
  };
}

/** Los pasos del índice en orden; el del video solo si la política de la empresa lo pide. */
export function enrollmentStepViews(progress: EnrollmentProgress): EnrollmentStepView[] {
  const views = [photoView(progress), captureView(progress)];
  return progress.voice.status === 'not_required' ? views : [...views, videoView(progress)];
}

/** Por qué no se puede abrir un paso ahora (su pantalla lo explica con su vacío); null si se puede. */
export type EnrollmentStepBlock = 'photoUsed' | 'needsPhoto' | 'capturesDone' | 'needsCaptures' | 'exhausted' | 'noVideo';

/**
 * Si la pantalla de un paso se abre fuera de orden (un enlace guardado, recargar la página), dice qué falta en lugar de
 * abrir la cámara para que el servidor responda 409. La foto inicial no se repite una vez usada en las capturas.
 */
export function enrollmentStepBlock(step: EnrollmentStepKey, { capture, voice }: EnrollmentProgress): EnrollmentStepBlock | null {
  if (step === 'photo') return capture.status === 'done' ? 'photoUsed' : null;
  if (step === 'captures') return capture.status === 'locked' ? 'needsPhoto' : capture.status === 'done' ? 'capturesDone' : null;
  if (voice.status === 'pending') return null;
  if (voice.status === 'exhausted') return 'exhausted';
  return voice.status === 'not_required' ? 'noVideo' : 'needsCaptures';
}
