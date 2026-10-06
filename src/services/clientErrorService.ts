import { t } from '../i18n/core';
import { CameraNotReadyError, errorKind } from '../utils/cameraDiagnostics';
import { config } from '../utils/config';
import { DeviceKeyError } from '../utils/deviceKey';
import { LocationError } from '../utils/geolocation';
import { ApiError, apiRequest } from './apiClient';
import { MapsApiError } from './maps/googleMaps';
import { isChunkLoadError } from './versionReload';

/**
 * Fallas de la aplicación web → "Errores del sistema" del ADMIN (`POST /api/client-errors`).
 *
 * Solo lo que es una falla de la app y nadie más que el equipo puede corregir:
 * - CRASH: una pantalla se rompió (ErrorBoundary).
 * - UNHANDLED: un error inesperado que nadie capturó (GlobalErrorHandler).
 * - CONFIG: una configuración de la plataforma que la persona no puede arreglar (una API de Google
 *   Maps sin habilitar para la llave).
 *
 * Nunca se reporta lo que la persona resuelve (permiso de cámara o ubicación, sin conexión, tiempo
 * agotado, cancelaciones) ni una respuesta de la API (`ApiError`: el servidor ya registró sus fallas).
 *
 * De mejor esfuerzo: nunca lanza, nunca abre un popup (la persona ya ve la falla en la pantalla),
 * con tiempo límite corto y sin reintentos. La misma falla se reporta una vez por carga de la página
 * (un ciclo de errores no inunda al servidor) y hay un tope de reportes por carga.
 */

export type ClientErrorKind = 'CRASH' | 'UNHANDLED' | 'CONFIG';

export interface ClientErrorReport {
  kind: ClientErrorKind;
  error: unknown;
  /** Componente o módulo donde ocurrió (p. ej. el que rompió la pantalla). */
  component?: string;
  /** Dato adicional (p. ej. la pila de componentes de React). */
  detail?: string;
  /** Qué hace "la misma falla" en esta carga de la página. Por omisión: tipo + mensaje + pantalla. */
  fingerprint?: string;
}

/** Topes del contrato del backend (`ClientErrorIn`). */
const LIMITS = { message: 1000, stack: 8000, component: 500, detail: 500, path: 255, version: 64 } as const;
const REPORT_TIMEOUT_MS = 5000;
/** Reportes distintos por carga de la página: más allá de esto la app ya está en un ciclo de fallas. */
const MAX_REPORTS_PER_PAGE = 20;
/** Lo que no es una falla de la app sino de la red o de una publicación nueva. */
const NETWORK_FAILURE = /Failed to fetch|NetworkError|Load failed|network error/i;
/** Cancelaciones y tiempos agotados: los decide la persona (o la red), no un error del código. */
const EXPECTED_NAMES = new Set(['AbortError', 'TimeoutError']);

const reported = new Set<string>();

/** Texto de cualquier valor lanzado (un objeto sin `toString` no rompe al reportero). */
function textOf(value: unknown): string {
  try {
    return String(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

/** Una falla sin texto se reporta como "(sin mensaje)" en el idioma de quien la tuvo. */
function describeError(error: unknown): { message: string; stack: string | null } {
  if (error instanceof Error) return { message: `${error.name || 'Error'}: ${error.message || t('services.clientErrors.noMessage')}`, stack: error.stack ?? null };
  return { message: textOf(error) || t('services.clientErrors.noMessage'), stack: null };
}

const clip = (text: string | null | undefined, limit: number): string | null => (text ? text.slice(0, limit) : null);

/**
 * La pantalla donde ocurrió, sin query ni fragmento (pueden llevar datos de la persona). Sin una ruta
 * legible (una `location` sustituida) se usa la raíz: el reportero nunca lanza.
 */
function currentPath(): string {
  const path: unknown = window.location.pathname;
  return typeof path === 'string' && path.startsWith('/') ? path.slice(0, LIMITS.path) : '/';
}

/**
 * ¿Es una falla de la app (o de la configuración de la plataforma)? No lo es lo que el servidor ya
 * respondió, lo que la persona resuelve (permisos, cámara ocupada, sin conexión) ni una cancelación.
 */
export function isAppFailure(error: unknown): boolean {
  if (error instanceof ApiError || error instanceof LocationError || error instanceof DeviceKeyError || error instanceof CameraNotReadyError) return false;
  if (error instanceof MapsApiError) return error.problem === 'denied';
  const name = error instanceof Error || error instanceof DOMException ? error.name : '';
  // Cancelada, tiempo agotado o la cámara (permiso, sin cámara, ocupada): no es un error del código.
  if (EXPECTED_NAMES.has(name) || errorKind(error) !== 'unknown') return false;
  if (!(error instanceof Error)) return true;
  return !NETWORK_FAILURE.test(error.message) && !isChunkLoadError(error);
}

/** Reporta la falla (una vez por carga de la página). La promesa siempre se cumple: nunca rechaza. */
export function reportClientError({ kind, error, component, detail, fingerprint }: ClientErrorReport): Promise<void> {
  // Sin conexión el reporte no llegaría y la falla casi siempre es la conexión misma.
  if (!navigator.onLine || !isAppFailure(error)) return Promise.resolve();
  const { message, stack } = describeError(error);
  const path = currentPath();
  const key = fingerprint ?? `${kind}|${message}|${path}`;
  if (reported.has(key) || reported.size >= MAX_REPORTS_PER_PAGE) return Promise.resolve();
  reported.add(key);
  const body = {
    kind,
    message: message.slice(0, LIMITS.message),
    stack: clip(stack, LIMITS.stack),
    path,
    component: clip(component, LIMITS.component),
    detail: clip(detail, LIMITS.detail),
    app_version: clip(config.buildId, LIMITS.version),
  };
  return (
    apiRequest<null>('/client-errors', { method: 'POST', body, timeoutMs: REPORT_TIMEOUT_MS, retries: 0 })
      .then(() => undefined)
      // Mejor esfuerzo: si el reporte no llega (sin red, servidor saturado, 429) la app sigue igual y
      // no se avisa a la persona (no es algo que pueda resolver); no se reintenta para no insistir.
      .catch(() => undefined)
  );
}

/**
 * Una API de Google Maps que la llave de la plataforma no tiene habilitada: solo el equipo puede
 * habilitarla. Una vez por API y carga de la página, y sin popup (el formulario sigue a mano). Sin
 * red o desactivada a propósito no es una falla de configuración y no se reporta.
 */
export function reportMapsProblem(problem: MapsApiError): void {
  void reportClientError({ kind: 'CONFIG', error: problem, component: `GoogleMaps:${problem.api}`, fingerprint: `maps:${problem.api}` });
}
