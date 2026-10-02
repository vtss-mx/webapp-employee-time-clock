import { config } from '../utils/config';
import { ApiError, clientError, normalizeResponse, type ApiEnvelope } from './http/envelope';

export { ApiError, normalizeResponse } from './http/envelope';
export type { ApiEnvelope, ApiErrorItem } from './http/envelope';

/* ------------------------------------------------------------------------------------------
 * Configuración (la inyecta AuthProvider)
 * ------------------------------------------------------------------------------------------ */

/** El servidor rechaza el dispositivo: los empleados solo pueden usar la app desde un teléfono. */
export const MOBILE_DEVICE_REQUIRED = 'MOBILE_DEVICE_REQUIRED';
/** Validador en una computadora (su empresa exige tableta o teléfono). */
export const TOUCH_DEVICE_REQUIRED = 'TOUCH_DEVICE_REQUIRED';
export const DEVICE_NOT_ALLOWED_CODES: ReadonlySet<string> = new Set([MOBILE_DEVICE_REQUIRED, TOUCH_DEVICE_REQUIRED]);

interface ApiClientHooks {
  getToken: () => string | null;
  onUnauthorized: (message: string) => void;
  /** Respuesta MOBILE_DEVICE_REQUIRED (en el login o en cualquier petición posterior). */
  onDeviceNotAllowed?: (error: ApiError) => void;
  /** Renueva el access token (refresh token en cookie). true si se obtuvo uno nuevo. */
  refreshSession: () => Promise<boolean>;
}

let hooks: ApiClientHooks = {
  getToken: () => null,
  onUnauthorized: () => undefined,
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

export interface RequestOptions<T> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  auth?: boolean;
  signal?: AbortSignal;
  /** Tiempo máximo por intento. */
  timeoutMs?: number;
  /** Valida la forma de `data`; si no coincide se lanza ApiError INVALID_RESPONSE. */
  validate?: (data: unknown) => data is T;
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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function buildRequest(options: RequestOptions<unknown>, traceId: string): { headers: Record<string, string>; payload?: BodyInit } {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Request-ID': traceId,
    // Evita la página intermedia de advertencia de ngrok (plan gratuito) en llamadas a la API.
    'ngrok-skip-browser-warning': 'true',
  };
  const token = options.auth !== false ? hooks.getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body instanceof FormData) return { headers, payload: options.body }; // boundary lo define el navegador
  if (options.body === undefined) return { headers };
  headers['Content-Type'] = 'application/json';
  return { headers, payload: JSON.stringify(options.body) };
}

/* ------------------------------------------------------------------------------------------
 * Peticiones
 * ------------------------------------------------------------------------------------------ */

async function attempt<T>(path: string, options: RequestOptions<T>): Promise<ApiEnvelope<T>> {
  const { method = 'GET', query, signal, timeoutMs = config.apiTimeoutMs, validate } = options;
  // El traceId se genera en el cliente para poder reportarlo aunque no haya respuesta.
  const traceId = newTraceId();
  const { headers, payload } = buildRequest(options, traceId);

  // Tiempo límite por intento combinado con la señal de cancelación del llamador.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
  const onAbort = () => controller.abort('cancelled');
  signal?.addEventListener('abort', onAbort);

  let response: Response;
  let parsed: { body: unknown; isJson: boolean };
  try {
    // credentials: la cookie HttpOnly del refresh token (el navegador solo la adjunta a /api/auth).
    response = await fetch(buildUrl(path, query), { method, headers, body: payload, signal: controller.signal, credentials: 'include' });
    parsed = await readBody(response);
  } catch (error) {
    if (signal?.aborted) throw error;
    throw clientError(controller.signal.aborted ? 408 : 0, traceId);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }

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

/** Access token vencido: se renueva UNA vez (refresh compartido entre peticiones simultáneas). */
async function recoverFromUnauthorized(error: ApiError, alreadyRefreshed: boolean, signal?: AbortSignal): Promise<boolean> {
  if (error.code === 'TOKEN_EXPIRED' && !alreadyRefreshed && !signal?.aborted && (await hooks.refreshSession())) {
    return true;
  }
  hooks.onUnauthorized(error.message);
  return false;
}

/**
 * Petición que devuelve el contrato completo (success, code, message, data, errors, traceId...).
 * Tiempo límite, renovación automática del token, reintentos con backoff para lecturas ante
 * errores transitorios (red, 502/503/504) y errores normalizados (ApiError).
 */
export async function apiEnvelope<T>(path: string, options: RequestOptions<T> = {}): Promise<ApiEnvelope<T>> {
  const retries = (options.method ?? 'GET') === 'GET' ? config.apiGetRetries : 0;
  let refreshed = false;
  for (let i = 0; ; i++) {
    const authenticated = options.auth !== false && hooks.getToken() !== null;
    try {
      return await attempt<T>(path, options);
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      if (DEVICE_NOT_ALLOWED_CODES.has(error.code)) hooks.onDeviceNotAllowed?.(error);
      if (authenticated && error.status === 401) {
        if (!(await recoverFromUnauthorized(error, refreshed, options.signal))) throw error;
        refreshed = true;
        i--; // el reintento tras renovar no consume reintentos por errores transitorios
        continue;
      }
      if (!error.isTransient || error.status === 429 || i >= retries || options.signal?.aborted) throw error;
      await wait(retryDelay(i, error.retryAfterMs));
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
  return 'Ocurrió un error inesperado';
}
