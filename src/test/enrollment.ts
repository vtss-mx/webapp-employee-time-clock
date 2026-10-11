import type { EnrollmentProgress, EnrollmentStepState, EnrollmentStepStatus } from '../types';

/*
 * El registro de identidad como lo manda `GET /enrollment/progress` desde la migración 0093 (decisión del dueño del
 * producto, 2026-10-08: el flujo es DINÁMICO; el ADMIN decide, por empresa, cuáles pasos se piden y en qué orden).
 * `step` arma un paso con la forma genérica del contrato (todos los campos llegan; los que no aplican, en null o
 * vacíos) y `progress` arma el flujo derivando `position`, `current` y `complete` igual que el servidor.
 */

export const CHECKED = '2026-10-07T15:00:00Z';
export const EXPIRES = '2026-10-10T15:00:00Z';
export const SENT = '2026-10-07T16:00:00Z';
export const UPLOADED = '2026-10-05T10:00:00Z';

/** Los tipos de documento de cada paso de documentos, como los envía el servidor en `document_types`. */
export const OFFICIAL_ID_TYPES = ['PASSPORT', 'NATIONAL_ID', 'DRIVER_LICENSE', 'OTHER_OFFICIAL_ID'];
export const ADDRESS_TYPES = ['PROOF_OF_ADDRESS'];

/** Un paso del flujo: su código, su estado y lo que ese paso trae (fechas, avance del video, tipos de documento). */
export function step(code: string, status: EnrollmentStepStatus, over: Partial<EnrollmentStepState> = {}): EnrollmentStepState {
  return {
    code,
    position: 1,
    status,
    blocked_by: null,
    done_at: null,
    expires_at: null,
    answered: null,
    total: null,
    attempts_left: null,
    document_types: [],
    document_id: null,
    ...over,
  };
}

/** El flujo con sus pasos EN ORDEN (`position`, `current` y `complete` se derivan, como en el servidor). */
export function progress(steps: EnrollmentStepState[], over: Partial<EnrollmentProgress> = {}): EnrollmentProgress {
  const ordered = steps.map((one, index) => ({ ...one, position: index + 1 }));
  return {
    face_status: 'NOT_ENROLLED',
    complete: ordered.every((one) => one.status === 'done'),
    current: ordered.find((one) => one.status === 'pending' || one.status === 'expired')?.code ?? null,
    steps: ordered,
    ...over,
  };
}

/** El flujo por omisión de toda empresa (foto inicial → capturas → video), nada hecho. */
export const NOTHING_DONE = progress([
  step('INITIAL_PHOTO', 'pending'),
  step('FACE_CAPTURES', 'blocked', { blocked_by: 'INITIAL_PHOTO' }),
  step('VOICE_VIDEO', 'blocked', { blocked_by: 'FACE_CAPTURES', answered: 0, total: 0, attempts_left: null }),
]);

/** La foto inicial tomada y vigente: siguen las capturas. */
export const PHOTO_DONE = progress([
  step('INITIAL_PHOTO', 'done', { done_at: CHECKED, expires_at: EXPIRES }),
  step('FACE_CAPTURES', 'pending'),
  step('VOICE_VIDEO', 'blocked', { blocked_by: 'FACE_CAPTURES', answered: 0, total: 0, attempts_left: null }),
]);

/** Capturas enviadas (la foto ya se consumió: sin vencimiento) y el video a medias. */
export const CAPTURES_DONE = progress([
  step('INITIAL_PHOTO', 'done', { done_at: SENT }),
  step('FACE_CAPTURES', 'done', { done_at: SENT }),
  step('VOICE_VIDEO', 'pending', { answered: 2, total: 3, attempts_left: 7 }),
]);

/**
 * Un flujo A LA MEDIDA con los CINCO pasos en un orden propio del ADMIN (documentos primero, el video antes de las
 * capturas): la identificación oficial hecha, el comprobante por subir y lo demás bloqueado por lo que falta.
 */
export const CUSTOM_FIVE = progress([
  step('OFFICIAL_ID', 'done', { done_at: UPLOADED, document_types: OFFICIAL_ID_TYPES, document_id: 7 }),
  step('PROOF_OF_ADDRESS', 'pending', { document_types: ADDRESS_TYPES }),
  step('VOICE_VIDEO', 'blocked', { blocked_by: 'FACE_CAPTURES', answered: 0, total: 3, attempts_left: 9 }),
  step('INITIAL_PHOTO', 'blocked', { blocked_by: 'PROOF_OF_ADDRESS' }),
  step('FACE_CAPTURES', 'blocked', { blocked_by: 'PROOF_OF_ADDRESS' }),
]);

/** Un flujo mínimo de DOS pasos (la empresa solo pide la identificación oficial y las capturas). */
export const CUSTOM_TWO = progress([
  step('OFFICIAL_ID', 'pending', { document_types: OFFICIAL_ID_TYPES }),
  step('FACE_CAPTURES', 'blocked', { blocked_by: 'OFFICIAL_ID' }),
]);
