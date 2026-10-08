import type { EnrollmentProgress } from '../types';

/*
 * Estados del registro facial de tres pasos independientes (decisión del dueño, 2026-10-07) como los manda
 * `GET /enrollment/progress`, para las pruebas del índice y de las pantallas de cada paso.
 */

export const CHECKED = '2026-10-07T15:00:00Z';
export const EXPIRES = '2026-10-10T15:00:00Z';
export const SENT = '2026-10-07T16:00:00Z';

/** Nada hecho: la foto por tomar y los demás pasos bloqueados. */
export const NOTHING_DONE: EnrollmentProgress = {
  face_status: 'NOT_ENROLLED',
  photo: { status: 'pending', checked_at: null, expires_at: null },
  capture: { status: 'locked', submitted_at: null },
  voice: { status: 'locked', answered: 0, total: 0, attempts_left: null },
};
export const PHOTO_DONE: EnrollmentProgress = { ...NOTHING_DONE, photo: { status: 'done', checked_at: CHECKED, expires_at: EXPIRES }, capture: { status: 'pending', submitted_at: null } };
export const CAPTURES_DONE: EnrollmentProgress = {
  ...NOTHING_DONE,
  photo: { status: 'done', checked_at: SENT, expires_at: null },
  capture: { status: 'done', submitted_at: SENT },
  voice: { status: 'pending', answered: 2, total: 3, attempts_left: 7 },
};
