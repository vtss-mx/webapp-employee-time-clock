/**
 * El registro de identidad del empleado: los pasos que pide SU empresa, en SU orden (decisión del dueño del producto,
 * 2026-10-08: «el proceso de registro facial debe ser DINÁMICO y un SOLO módulo; el ADMIN decide, POR EMPRESA, cuáles
 * pasos se piden y en qué orden»; migración 0093). Antes el flujo estaba fijo en el código (foto → capturas → video) y
 * los documentos de identidad vivían en otra pantalla del empleado («Mis documentos», retirada el mismo día).
 *
 * La app NO calcula nada: recorre `steps` en el orden que llegó, usa `code` para elegir el componente del paso y
 * `status` para saber si lo pide, lo bloquea o lo marca como hecho. Los NOMBRES y las descripciones de cada paso salen
 * del catálogo `enrollment_steps` (traducidos por el backend), nunca de los diccionarios de la app.
 */
import type { FaceCheckResult, FaceStatus } from './index';

/** Los pasos que esta versión de la app sabe dibujar (códigos de `catalog.enrollment_steps`). */
export type EnrollmentStepCode = 'OFFICIAL_ID' | 'PROOF_OF_ADDRESS' | 'INITIAL_PHOTO' | 'FACE_CAPTURES' | 'VOICE_VIDEO';

/**
 * Estado de un paso según el SERVIDOR: hecho, por hacer, bloqueado (falta otro paso: `blocked_by`), vencido (hay que
 * repetirlo) o sin intentos (el video agotó los suyos). `pending` y `expired` significan «hazlo ahora».
 */
export type EnrollmentStepStatus = 'done' | 'pending' | 'blocked' | 'expired' | 'exhausted';

/**
 * UN paso del flujo. La forma es GENÉRICA: todos los campos llegan siempre y los que no aplican a ese paso vienen en
 * `null` (o vacíos), así un paso nuevo, otro orden u otro subconjunto no cambian el contrato. `code` y `blocked_by` son
 * `string` a propósito: un código que esta versión no conoce se dibuja con su nombre del catálogo y sin acción, nunca
 * rompe la pantalla.
 */
export interface EnrollmentStepState {
  code: string;
  /** Su lugar en el flujo de esta empresa (1 = el primero), en el orden que configuró el ADMIN. */
  position: number;
  status: EnrollmentStepStatus;
  /** Qué paso debe hacerse antes (solo cuando no se puede hacer ahora). */
  blocked_by: string | null;
  /** Cuándo quedó hecho (la foto aceptada, las capturas enviadas, el documento subido); null si aún no. */
  done_at: string | null;
  /** Hasta cuándo sirve lo hecho (solo la foto inicial: su borrador vence). */
  expires_at: string | null;
  /** Avance dentro del paso (solo el video): respuestas aceptadas, preguntas de la sesión e intentos que quedan. */
  answered: number | null;
  total: number | null;
  attempts_left: number | null;
  /** Solo los pasos de documentos: los tipos (`employee_document_types`) que lo satisfacen y el documento vigente. */
  document_types: string[];
  document_id: number | null;
}

export interface EnrollmentProgress {
  face_status: FaceStatus;
  /** Todos los pasos del flujo están hechos (el registro ya está con la empresa). */
  complete: boolean;
  /** El paso que toca ahora (null si ya no falta ninguno): el primero de `steps` con `pending` o `expired`. */
  current: string | null;
  /** Los pasos que pide la empresa, EN SU ORDEN (uno a cinco). */
  steps: EnrollmentStepState[];
}

/** La foto inicial aceptada y guardada: la validación previa más cuándo se aceptó y hasta cuándo sirve. */
export interface EnrollmentPhotoResult extends FaceCheckResult {
  checked_at: string;
  expires_at: string;
}
