import { ApiError } from '../services/apiClient';

/** Errores 422 por calidad/pose/accesorios/prueba de vida: el usuario puede corregir y reintentar. */
const RETRYABLE_FACE_CODES = new Set([
  'NO_FACE',
  'MULTIPLE_FACES',
  'LOW_DETECTION_SCORE',
  'FACE_TOO_SMALL',
  'FACE_CUT_OFF',
  'POSE_NOT_FRONTAL',
  'POSE_TILTED',
  'POSE_PITCH',
  'TOO_DARK',
  'TOO_BRIGHT',
  'TOO_BLURRY',
  'ACCESSORIES_DETECTED',
  'ENROLL_INCONSISTENT',
  'CHALLENGE_INVALID',
  'LIVENESS_REQUIRED',
  'LIVENESS_FAILED',
  'LIVENESS_MISMATCH',
  'INVALID_IMAGE',
  'INVALID_IMAGE_FORMAT',
  'IMAGE_TOO_SMALL',
  'IMAGE_TOO_LARGE',
  'FACE_SERVICE_BUSY',
  'SPOOF_DETECTED',
  'SERVER_BUSY',
  'TIMEOUT',
]);

export function isRetryableFaceError(error: unknown): error is ApiError {
  return error instanceof ApiError && (RETRYABLE_FACE_CODES.has(error.code) || error.status === 0);
}

export type AccessoryKind = 'GLASSES' | 'HEADWEAR' | 'MASK';

export const ACCESSORY_LABELS: Record<AccessoryKind, string> = { GLASSES: 'Lentes', HEADWEAR: 'Gorra', MASK: 'Cubrebocas' };

export function detectedAccessories(error: unknown): AccessoryKind[] {
  if (!(error instanceof ApiError) || error.code !== 'ACCESSORIES_DETECTED') return [];
  const list = (error.details as { accessories?: AccessoryKind[] } | null)?.accessories;
  return Array.isArray(list) ? list : [];
}
