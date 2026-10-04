import { ApiError } from '../services/apiClient';
import { CameraNotReadyError } from './cameraDiagnostics';
import type { CatalogApi } from './catalogs';
import { config } from './config';

/** Fallas de red o de carga ajenas al catálogo de errores faciales: siempre se puede reintentar. */
const TRANSIENT_CODES: ReadonlySet<string> = new Set(['SERVER_BUSY', 'TIMEOUT']);

/**
 * Fallas de red o servidor seguidas que el flujo facial reintenta solo: a la que llega a este número
 * se rinde y muestra el error con "Reintentar". Cada intento vuelve a subir las capturas (pesadas) y
 * no debe repetirse sin fin con la red caída o el servidor saturado.
 */
export const MAX_TRANSIENT_FACE_FAILURES = 2;

/** Sin conexión, tiempo agotado o servidor saturado: no depende de la persona ni de la captura. */
export function isTransientFaceError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 0 || TRANSIENT_CODES.has(error.code));
}

/**
 * Error que la persona puede corregir y reintentar (calidad, pose, accesorios, prueba de vida...):
 * lo dice el catálogo face_errors (`retryable`); además, sin conexión, servidor saturado o la cámara
 * sin imagen en ese momento.
 */
export function isRetryableFaceError(error: unknown, catalogs: Pick<CatalogApi, 'byCode'>): boolean {
  if (error instanceof CameraNotReadyError) return true;
  if (!(error instanceof ApiError)) return false;
  return isTransientFaceError(error) || catalogs.byCode('face_errors', error.code)?.retryable === true;
}

/**
 * Qué hacer con un error del flujo facial según las fallas de red seguidas que ya hubo (`streak`):
 * reanudar solo o terminar (`fatal`: no corregible, o la red sigue fallando). Devuelve la nueva
 * cuenta de fallas seguidas (cualquier otro resultado la reinicia).
 */
export function faceErrorOutcome(error: unknown, catalogs: Pick<CatalogApi, 'byCode'>, streak: number): { fatal: boolean; streak: number } {
  const next = isTransientFaceError(error) ? streak + 1 : 0;
  const fatal = !isRetryableFaceError(error, catalogs) || next >= MAX_TRANSIENT_FACE_FAILURES;
  return { fatal, streak: fatal ? 0 : next };
}

/** Pausa antes de reanudar tras un bloqueo: la del flujo o la que pidió el servidor (Retry-After, con tope). */
export function faceResumeDelayMs(error: unknown): number {
  const hinted = error instanceof ApiError && error.retryAfterMs !== null ? Math.min(error.retryAfterMs, config.apiMaxRetryAfterMs) : 0;
  return Math.max(config.faceResumeAfterBlockMs, hinted);
}

/** Códigos del catálogo de accesorios que el servidor detectó en la captura. */
export function detectedAccessories(error: unknown): string[] {
  if (!(error instanceof ApiError) || error.code !== 'ACCESSORIES_DETECTED') return [];
  const list = (error.details as { accessories?: unknown } | null)?.accessories;
  return Array.isArray(list) ? list.filter((code): code is string => typeof code === 'string') : [];
}
