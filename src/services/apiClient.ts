import { currentLocale, t } from '../i18n/core';
import { config } from '../utils/config';
import { sleep } from '../utils/waits';
import { ApiError, clientError, normalizeResponse, type ApiEnvelope } from './http/envelope';

export { ApiError, fieldErrorsFrom, normalizeResponse } from './http/envelope';
export type { ApiEnvelope, ApiErrorItem } from './http/envelope';

/* ------------------------------------------------------------------------------------------
 * Configuración (la inyecta AuthProvider)
 * ------------------------------------------------------------------------------------------ */

/**
 * Validador en una computadora (su empresa exige tableta o teléfono). Es la ÚNICA restricción de
 * dispositivo: empleados y administradores usan la aplicación desde cualquier dispositivo.
 */
export const TOUCH_DEVICE_REQUIRED = 'TOUCH_DEVICE_REQUIRED';
export const DEVICE_NOT_ALLOWED_CODES: ReadonlySet<string> = new Set([TOUCH_DEVICE_REQUIRED]);

/**
 * Empresa suspendida en la plataforma (cobranza): ninguna cuenta suya entra ni opera. Llega como 403
 * (login, renovación, elegir empresa o cualquier petición) o 401 (la sesión se cerró al suspenderla).
 */
export const COMPANY_SUSPENDED = 'COMPANY_SUSPENDED';

/**
 * Códigos 403 que indican que una pantalla del menú dejó de estar disponible para esta cuenta (el ADMIN apagó el QR o
 * el registro facial ya no está aprobado, el módulo de validadores se desactivó). No son un error de la cuenta: la app
 * vuelve a pedir al usuario (`onScreenUnavailable`) para que el backend recalcule `screens`/`home` y la pantalla salga
 * del menú. Defensa en profundidad: cada pantalla afectada además lo resuelve a su manera.
 */
export const SCREEN_UNAVAILABLE_CODES: ReadonlySet<string> = new Set(['FACE_NOT_APPROVED', 'QR_DISABLED', 'VALIDATORS_DISABLED']);

/**
 * Segundo factor obligatorio con la gracia VENCIDA (migración 0096 del backend): la cuenta sigue dentro, pero
 * ninguna pantalla responde (403 en todas) hasta que registre su llave de acceso. Lo único abierto es lo de la
 * cuenta, que es justo lo que necesita para cumplir. La app lo presenta de forma global (`MfaGate`) con la acción
 * que SÍ sirve —ir a registrar la llave—, nunca con un «Reintentar» que no podría funcionar (regla 7 de la raíz).
 */
export const MFA_ENROLLMENT_REQUIRED = 'MFA_ENROLLMENT_REQUIRED';

interface ApiClientHooks {
  getToken: () => string | null;
  /** Sesión rechazada (401 sin renovación posible). Sin quien la escuche, la petición solo se rechaza. */
  onUnauthorized?: (message: string) => void;
  /** Respuesta TOUCH_DEVICE_REQUIRED (en el login o en cualquier petición posterior). */
  onDeviceNotAllowed?: (error: ApiError) => void;
  /** Respuesta COMPANY_SUSPENDED (401 o 403, en el login o en cualquier petición): pantalla completa. */
  onCompanySuspended?: (error: ApiError) => void;
  /** Una pantalla dejó de estar disponible (403 con `SCREEN_UNAVAILABLE_CODES`): refrescar al usuario (una sola vez). */
  onScreenUnavailable?: () => void;
  /** Respuesta MFA_ENROLLMENT_REQUIRED (403 en cualquier pantalla): pantalla completa para registrar la llave. */
  onMfaEnrollmentRequired?: (error: ApiError) => void;
  /** Renueva el access token (refresh token en cookie). true si se obtuvo uno nuevo. */
  refreshSession: () => Promise<boolean>;
}

// Hasta que AuthProvider lo configure no hay sesión: sin token, un 401 nunca llega a cerrarla.
let hooks: ApiClientHooks = {
  getToken: () => null,
  refreshSession: () => Promise.resolve(false),
};

export function configureApiClient(next: ApiClientHooks): void {
  hooks = next;
}

/** Token de acceso vigente (en memoria) para canales que no pasan por fetch, p. ej. WebSocket. */
export function currentAccessToken(): string | null {
  return hooks.getToken();
}

/** Pide renovar el token (refresh con cookie). true si se obtuvo uno nuevo. */
export function renewAccessToken(): Promise<boolean> {
  return hooks.refreshSession();
}

/** Lo que tardó un intento: ruta como se pidió (sin query), estado HTTP; 0 = sin red, 408 = tiempo agotado del cliente. */
export interface ApiTiming {
  method: string;
  path: string;
  durationMs: number;
  status: number;
}

// Quién mide cada intento (los observadores de rendimiento, `services/perf`); null = nadie. Es un registro y no
// una importación para que el cliente no dependa de la telemetría (sin ciclos) y no mida nada si está apagada.
let timingListener: ((timing: ApiTiming) => void) | null = null;

/** Registra (o quita, con null) quién recibe la duración de cada intento. Una cancelación del llamador no se mide. */
export function onApiTiming(listener: ((timing: ApiTiming) => void) | null): void {
  timingListener = listener;
}

export interface RequestOptions<T> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  auth?: boolean;
  signal?: AbortSignal;
  /** Tiempo máximo por intento. */
  timeoutMs?: number;
  /**
   * Reintentos ante errores transitorios (red, 502/503/504). Por omisión solo las lecturas (GET) los
   * hacen (`config.apiGetRetries`); 0 para consultas que deben responder rápido o rendirse (p. ej.
   * la validación en vivo, que no debe dejar el formulario "verificando" durante minutos).
   */
  retries?: number;
  /** Valida la forma de `data`; si no coincide se lanza ApiError INVALID_RESPONSE. */
  validate?: (data: unknown) => data is T;
  /**
   * Códigos de un 401 que NO cierran la sesión: son un rechazo normal de ESTA petición, no una sesión inválida (p. ej.
   * elegir una empresa inactiva o con el acceso desactivado: la sesión del empleado sigue viva en la pantalla anterior).
   * Solo se rechazan con su error; nunca disparan `onUnauthorized`.
   */
  sessionSafeCodes?: ReadonlySet<string>;
}

/* ------------------------------------------------------------------------------------------
 * Utilidades de transporte
 * ------------------------------------------------------------------------------------------ */

const JSON_LIKE = /^\s*[{["\d-]|^\s*(true|false|null)\s*$/;

async function readBody(response: Response): Promise<{ body: unknown; isJson: boolean }> {
  let text: string;
  try {
    text = await response.text();
  } catch {
    return { body: null, isJson: false };
  }
  if (!text.trim()) return { body: null, isJson: false };
  // Se intenta JSON aunque la cabecera sea incorrecta; HTML o texto quedan como texto.
  if ((response.headers.get('Content-Type') ?? '').includes('json') || JSON_LIKE.test(text)) {
    try {
      return { body: JSON.parse(text) as unknown, isJson: true };
    } catch {
      /* JSON inválido: se trata como texto */
    }
  }
  return { body: text, isJson: false };
}

export function buildUrl(path: string, query?: RequestOptions<unknown>['query']): string {
  const url = `${config.apiUrl}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export function newTraceId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  } catch {
    /* contexto no seguro (http en LAN): se usa el respaldo */
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`.padEnd(12, '0');
}

export function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

/** Espera antes de reintentar: backoff exponencial con jitter, respetando Retry-After (con tope). */
export function retryDelay(attemptIndex: number, retryAfterMs: number | null): number {
  const backoff = 400 * 2 ** attemptIndex;
  const hinted = retryAfterMs !== null ? Math.min(retryAfterMs, config.apiMaxRetryAfterMs) : 0;
  return Math.max(backoff, hinted) * (0.75 + Math.random() * 0.5);
}

function buildRequest(options: RequestOptions<unknown>, traceId: string, token: string | null): { headers: Record<string, string>; payload?: BodyInit } {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    // Idioma activo: el backend responde sus mensajes y catálogos ya traducidos (es-MX o en-US).
    'Accept-Language': currentLocale(),
    'X-Request-ID': traceId,
    // Evita la página intermedia de advertencia de ngrok (plan gratuito) en llamadas a la API.
    'ngrok-skip-browser-warning': 'true',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body instanceof FormData) return { headers, payload: options.body }; // boundary lo define el navegador
  if (options.body === undefined) return { headers };
  headers['Content-Type'] = 'application/json';
  return { headers, payload: JSON.stringify(options.body) };
}

/* ------------------------------------------------------------------------------------------
 * Peticiones
 * ------------------------------------------------------------------------------------------ */

async function attempt<T>(path: string, options: RequestOptions<T>, token: string | null): Promise<ApiEnvelope<T>> {
  const { method = 'GET', query, signal, timeoutMs = config.apiTimeoutMs, validate } = options;
  // El traceId se genera en el cliente para poder reportarlo aunque no haya respuesta.
  const traceId = newTraceId();
  const { headers, payload } = buildRequest(options, traceId, token);

  // Tiempo límite por intento combinado con la señal de cancelación del llamador.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
  const onAbort = () => controller.abort('cancelled');
  signal?.addEventListener('abort', onAbort);
  const started = performance.now();
  const measure = (status: number) => timingListener?.({ method, path, durationMs: performance.now() - started, status });

  let response: Response;
  let parsed: { body: unknown; isJson: boolean };
  try {
    // credentials: la cookie HttpOnly del refresh token (el navegador solo la adjunta a /api/auth).
    response = await fetch(buildUrl(path, query), { method, headers, body: payload, signal: controller.signal, credentials: 'include' });
    parsed = await readBody(response);
  } catch (error) {
    if (signal?.aborted) throw error;
    const status = controller.signal.aborted ? 408 : 0;
    measure(status);
    throw clientError(status, traceId);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
  measure(response.status);

  const envelope = normalizeResponse(response.status, parsed.body, {
    traceId: response.headers.get('X-Request-ID') ?? traceId,
    isJson: parsed.isJson,
  });
  if (!envelope.success) {
    if (envelope.statusCode >= 500) console.warn(`[api] ${method} ${path} → ${envelope.code} (traceId ${envelope.traceId})`);
    throw new ApiError(envelope, parseRetryAfter(response.headers.get('Retry-After')));
  }
  if (validate && !validate(envelope.data)) {
    console.warn(`[api] ${method} ${path}: forma de "data" inesperada (traceId ${envelope.traceId})`);
    throw clientError(502, envelope.traceId, 'INVALID_RESPONSE');
  }
  return envelope as ApiEnvelope<T>;
}

/**
 * 401 de una petición con sesión: ¿se repite? (si no, se rechaza con el error).
 * - Cancelada por el llamador: solo se rechaza; nunca cierra la sesión (la persona salió de la pantalla).
 * - El token ya cambió mientras viajaba (otra petición lo renovó): se repite con el nuevo, sin otra
 *   renovación. Si ya no hay token, la sesión se cerró por otro lado: solo se rechaza.
 * - TOKEN_EXPIRED: se renueva UNA vez (refresh compartido entre peticiones simultáneas) y se repite.
 * - Cualquier otro caso cierra la sesión (revocada, reemplazada, vencida).
 */
async function recoverFromUnauthorized(error: ApiError, usedToken: string, alreadyRetried: boolean, signal?: AbortSignal, sessionSafe?: ReadonlySet<string>): Promise<boolean> {
  if (signal?.aborted) return false;
  const current = hooks.getToken();
  if (current !== usedToken) return current !== null && !alreadyRetried;
  if (error.code === 'TOKEN_EXPIRED' && !alreadyRetried && (await hooks.refreshSession())) return true;
  if (signal?.aborted) return false;
  // Un 401 "seguro para la sesión" (p. ej. elegir una empresa inactiva) es un rechazo de esta petición, no una sesión
  // inválida: no se cierra la sesión, solo se rechaza con su error para que la pantalla lo muestre.
  if (sessionSafe?.has(error.code)) return false;
  hooks.onUnauthorized?.(error.message);
  return false;
}

/**
 * Errores que la app presenta de forma global (antes del flujo del 401: la pantalla de la empresa
 * suspendida queda puesta cuando la sesión se cierra): dispositivo no permitido y empresa suspendida.
 */
function notifyGlobalHandlers(error: ApiError): void {
  if (DEVICE_NOT_ALLOWED_CODES.has(error.code)) hooks.onDeviceNotAllowed?.(error);
  if (error.code === COMPANY_SUSPENDED) hooks.onCompanySuspended?.(error);
  // Una pantalla dejó de estar disponible (403): refrescar al usuario para que el menú se recalcule (el hook se
  // protege contra bucles). No aplica a un 401 con el mismo código (ese cierra o renueva la sesión por su cuenta).
  if (error.status === 403 && SCREEN_UNAVAILABLE_CODES.has(error.code)) hooks.onScreenUnavailable?.();
  // Segundo factor vencido: lo presenta la app completa; ninguna pantalla repite el error (`isHandledGlobally`).
  if (error.status === 403 && error.code === MFA_ENROLLMENT_REQUIRED) hooks.onMfaEnrollmentRequired?.(error);
}

/**
 * Petición que devuelve el contrato completo (success, code, message, data, errors, traceId...).
 * Tiempo límite, renovación automática del token, reintentos con backoff para lecturas ante
 * errores transitorios (red, 502/503/504) y errores normalizados (ApiError).
 */
export async function apiEnvelope<T>(path: string, options: RequestOptions<T> = {}): Promise<ApiEnvelope<T>> {
  const retries = options.retries ?? ((options.method ?? 'GET') === 'GET' ? config.apiGetRetries : 0);
  let retriedAuth = false;
  for (let i = 0; ; i++) {
    // El token con que sale ESTE intento: al recibir un 401 se compara con el vigente.
    const token = options.auth !== false ? hooks.getToken() : null;
    try {
      return await attempt<T>(path, options, token);
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      notifyGlobalHandlers(error);
      if (token !== null && error.status === 401) {
        if (!(await recoverFromUnauthorized(error, token, retriedAuth, options.signal, options.sessionSafeCodes))) throw error;
        retriedAuth = true;
        i--; // el reintento tras renovar no consume reintentos por errores transitorios
        continue;
      }
      if (!error.isTransient || error.status === 429 || i >= retries || options.signal?.aborted) throw error;
      await sleep(retryDelay(i, error.retryAfterMs), options.signal);
      // Cancelada durante la espera: no se hace otro intento.
      options.signal?.throwIfAborted();
    }
  }
}

/** Petición que devuelve solo `data` (lo más común en servicios). */
export async function apiRequest<T>(path: string, options: RequestOptions<T> = {}): Promise<T> {
  return (await apiEnvelope<T>(path, options)).data;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return t('errors.unexpected');
}
