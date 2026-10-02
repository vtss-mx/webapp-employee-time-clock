import { ApiError } from '../services/apiClient';
import type { CatalogApi } from './catalogs';

/** Fallas de red o de carga ajenas al catálogo de errores faciales: siempre se puede reintentar. */
const TRANSIENT_CODES: ReadonlySet<string> = new Set(['SERVER_BUSY', 'TIMEOUT']);

/**
 * Error que la persona puede corregir y reintentar (calidad, pose, accesorios, prueba de vida...):
 * lo dice el catálogo face_errors (`retryable`); además, sin conexión o servidor saturado.
 */
export function isRetryableFaceError(error: unknown, catalogs: Pick<CatalogApi, 'byCode'>): error is ApiError {
  if (!(error instanceof ApiError)) return false;
  return error.status === 0 || TRANSIENT_CODES.has(error.code) || catalogs.byCode('face_errors', error.code)?.retryable === true;
}

/** Códigos del catálogo de accesorios que el servidor detectó en la captura. */
export function detectedAccessories(error: unknown): string[] {
  if (!(error instanceof ApiError) || error.code !== 'ACCESSORIES_DETECTED') return [];
  const list = (error.details as { accessories?: unknown } | null)?.accessories;
  return Array.isArray(list) ? list.filter((code): code is string => typeof code === 'string') : [];
}
