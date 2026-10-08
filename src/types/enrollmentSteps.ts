/**
 * Los tres pasos INDEPENDIENTES del registro facial del propio empleado (decisión del dueño del producto, 2026-10-07):
 * foto inicial, capturas con prueba de vida y video con preguntas. El orden lo exige el servidor; su estado llega de
 * `GET /enrollment/progress` (el índice lo dibuja tal cual, sin calcular nada).
 */
import type { FaceCheckResult, FaceStatus } from './index';

/** Paso 1: sin foto, con la foto vigente o con una vencida (hay que repetirla). */
export type PhotoStepStatus = 'pending' | 'done' | 'expired';
/** Paso 2: bloqueado (falta la foto vigente), por hacer o hecho. */
export type CaptureStepStatus = 'locked' | 'pending' | 'done';
/** Paso 3: no lo pide la política, bloqueado (faltan las capturas), por hacer (o a medias), intentos agotados o hecho. */
export type VoiceStepStatus = 'not_required' | 'locked' | 'pending' | 'exhausted' | 'done';

export interface EnrollmentProgress {
  face_status: FaceStatus;
  photo: { status: PhotoStepStatus; checked_at: string | null; expires_at: string | null };
  capture: { status: CaptureStepStatus; submitted_at: string | null };
  /** Respuestas aceptadas de las preguntas de la sesión y los intentos que quedan (null si no aplica). */
  voice: { status: VoiceStepStatus; answered: number; total: number; attempts_left: number | null };
}

/** La foto inicial aceptada y guardada (paso 1): la validación previa más cuándo se aceptó y hasta cuándo sirve. */
export interface EnrollmentPhotoResult extends FaceCheckResult {
  checked_at: string;
  expires_at: string;
}
