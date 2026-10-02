/**
 * Contrato único de respuesta de la API y normalización de CUALQUIER respuesta a ese contrato:
 * el contrato mismo, el formato antiguo `{detail}`, HTML de un proxy/ngrok, texto plano,
 * cuerpo vacío o JSON inválido.
 */
import { isRecord } from '../../utils/guards';

export interface ApiErrorItem {
  code: string;
  message: string;
  field: string | null;
  details: Record<string, unknown> | null;
}

export interface ApiEnvelope<T = unknown> {
  /** Derivado de statusCode (2xx). */
  success: boolean;
  statusCode: number;
  code: string;
  message: string;
  data: T;
  errors: ApiErrorItem[];
  traceId: string | null;
  timestamp: string | null;
}

type EnvelopeInit = Pick<ApiEnvelope, 'statusCode' | 'code' | 'message'> & Partial<ApiEnvelope>;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly errors: ApiErrorItem[];
  readonly traceId: string | null;
  readonly timestamp: string | null;
  /** Datos que el servidor haya devuelto junto al error (normalmente null). */
  readonly data: unknown;
  /** Espera sugerida por el servidor (cabecera Retry-After) antes de reintentar. */
  readonly retryAfterMs: number | null;

  constructor(envelope: EnvelopeInit, retryAfterMs: number | null = null) {
    super(envelope.message);
    this.name = 'ApiError';
    this.status = envelope.statusCode;
    this.code = envelope.code;
    this.errors = envelope.errors ?? [];
    this.traceId = envelope.traceId ?? null;
    this.timestamp = envelope.timestamp ?? null;
    this.data = envelope.data ?? null;
    this.retryAfterMs = retryAfterMs;
  }

  /** Errores por campo (validación) listos para formularios: { campo: mensaje }. */
  get fieldErrors(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const err of this.errors) {
      if (err.field && !result[err.field]) result[err.field] = err.message;
    }
    return result;
  }

  /** Datos adicionales del primer error que los incluya (p. ej. { accessories: [...] }). */
  get details(): Record<string, unknown> | null {
    return this.errors.find((e) => e.details)?.details ?? null;
  }

  /** Errores transitorios: el usuario puede reintentar. */
  get isTransient(): boolean {
    return this.status === 0 || this.status === 408 || this.status === 429 || this.status >= 502;
  }
}

/* ---------------------------- Valores por defecto ---------------------------- */

const DEFAULT_MESSAGES: Record<number, string> = {
  0: 'No fue posible conectar con el servidor. Verifica tu conexión.',
  200: 'Operación exitosa',
  400: 'Solicitud inválida',
  401: 'Tu sesión no es válida. Inicia sesión nuevamente.',
  403: 'No tienes permisos para realizar esta acción',
  404: 'Recurso no encontrado',
  405: 'Operación no permitida',
  408: 'El servidor tardó demasiado en responder. Intenta nuevamente.',
  409: 'Conflicto con datos existentes',
  413: 'El archivo es demasiado grande',
  415: 'Formato no soportado',
  422: 'Los datos enviados no son válidos',
  429: 'Demasiados intentos. Espera unos segundos.',
  500: 'Ocurrió un error inesperado. Intenta nuevamente.',
  502: 'El servicio no está disponible en este momento. Intenta en unos segundos.',
  503: 'El servicio no está disponible en este momento. Intenta en unos segundos.',
  504: 'El servidor tardó demasiado en responder. Intenta nuevamente.',
};

const DEFAULT_CODES: Record<number, string> = {
  0: 'NETWORK_ERROR',
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  408: 'TIMEOUT',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'UNPROCESSABLE',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  502: 'SERVICE_UNAVAILABLE',
  503: 'SERVICE_UNAVAILABLE',
  504: 'GATEWAY_TIMEOUT',
};

const INVALID_RESPONSE_MESSAGE = 'El servidor devolvió una respuesta inesperada. Intenta nuevamente.';

const isSuccessStatus = (status: number) => status >= 200 && status < 300;

export function defaultMessage(status: number): string {
  if (DEFAULT_MESSAGES[status]) return DEFAULT_MESSAGES[status];
  if (isSuccessStatus(status)) return DEFAULT_MESSAGES[200];
  return status >= 500 ? DEFAULT_MESSAGES[500] : DEFAULT_MESSAGES[400];
}

export function defaultCode(status: number): string {
  if (DEFAULT_CODES[status]) return DEFAULT_CODES[status];
  if (isSuccessStatus(status)) return 'OK';
  return status >= 500 ? 'SERVER_ERROR' : 'HTTP_ERROR';
}

/** Error construido en el cliente (red, timeout, forma de datos inesperada). */
export function clientError(statusCode: number, traceId: string | null, code = defaultCode(statusCode)): ApiError {
  const message = code === 'INVALID_RESPONSE' ? INVALID_RESPONSE_MESSAGE : defaultMessage(statusCode);
  return new ApiError({ statusCode, code, message, traceId, errors: [singleError(code, message)] });
}

/* ------------------------------ Normalización ------------------------------ */

const asString = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);

function singleError(code: string, message: string, details: Record<string, unknown> | null = null): ApiErrorItem {
  return { code, message, field: null, details };
}

function normalizeErrorItem(item: unknown, fallbackCode: string): ApiErrorItem | null {
  if (typeof item === 'string') return singleError(fallbackCode, item);
  if (!isRecord(item)) return null;
  const message = asString(item.message) ?? asString(item.msg) ?? asString(item.detail);
  if (!message) return null;
  const loc = Array.isArray(item.loc) ? item.loc.filter((p) => p !== 'body').join('.') : '';
  return {
    code: asString(item.code) ?? asString(item.type) ?? fallbackCode,
    message,
    field: asString(item.field) ?? (loc || null),
    details: isRecord(item.details) ? item.details : null,
  };
}

export function normalizeErrors(raw: unknown, fallbackCode: string): ApiErrorItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => normalizeErrorItem(item, fallbackCode)).filter((item): item is ApiErrorItem => item !== null);
}

function looksLikeEnvelope(body: Record<string, unknown>): boolean {
  return 'statusCode' in body && 'code' in body && 'message' in body && ('data' in body || 'errors' in body);
}

/** 1) Contrato único. `success` se recalcula con el HTTP real; si el cuerpo lo contradice es error. */
function fromEnvelope(status: number, body: Record<string, unknown>, traceId: string | null): ApiEnvelope {
  const code = asString(body.code) ?? defaultCode(status);
  const message = asString(body.message) ?? defaultMessage(status);
  const success = isSuccessStatus(status) && body.success !== false;
  const errors = normalizeErrors(body.errors, code);
  return {
    success,
    statusCode: status,
    code,
    message,
    data: body.data ?? null,
    errors: success ? [] : errors.length ? errors : [singleError(code, message)],
    traceId: asString(body.traceId) ?? traceId,
    timestamp: asString(body.timestamp),
  };
}

/** 2) Formato antiguo o de terceros: { detail, code, errors, details, request_id }. */
function fromLegacyError(status: number, body: Record<string, unknown>, traceId: string | null): ApiEnvelope {
  const code = asString(body.code) ?? asString(body.error) ?? defaultCode(status);
  const detail = body.detail;
  const details = isRecord(body.details) ? body.details : null;
  const message = asString(detail) ?? asString(body.message) ?? asString(body.error_description) ?? defaultMessage(status);
  const parsed = normalizeErrors(Array.isArray(detail) ? detail : body.errors, code);
  const errors = parsed.length ? parsed.map((e, i) => (i === 0 && details ? { ...e, details } : e)) : [singleError(code, message, details)];
  return {
    success: false,
    statusCode: status,
    code,
    message: Array.isArray(detail) && errors.length > 1 ? defaultMessage(422) : message,
    data: null,
    errors,
    traceId: asString(body.request_id) ?? asString(body.traceId) ?? traceId,
    timestamp: null,
  };
}

/** 3) Éxito sin contrato (JSON simple, colección, valor o cuerpo vacío). */
function fromPlainSuccess(status: number, body: unknown, traceId: string | null): ApiEnvelope {
  return {
    success: true,
    statusCode: status,
    code: defaultCode(status),
    message: defaultMessage(status),
    data: body,
    errors: [],
    traceId,
    timestamp: null,
  };
}

/** 4) HTML, texto, JSON inválido o un 2xx que no es JSON (la SPA respondiendo por la API). */
function fromUnexpected(status: number, traceId: string | null): ApiEnvelope {
  const statusCode = isSuccessStatus(status) ? 502 : status;
  const code = isSuccessStatus(status) ? 'INVALID_RESPONSE' : defaultCode(status);
  const message = isSuccessStatus(status) ? INVALID_RESPONSE_MESSAGE : defaultMessage(status);
  return { success: false, statusCode, code, message, data: null, errors: [singleError(code, message)], traceId, timestamp: null };
}

export function normalizeResponse(
  status: number,
  body: unknown,
  meta: { traceId?: string | null; isJson?: boolean } = {},
): ApiEnvelope {
  const traceId = meta.traceId ?? null;
  if (isRecord(body) && looksLikeEnvelope(body)) return fromEnvelope(status, body, traceId);
  if (!isSuccessStatus(status) && isRecord(body)) return fromLegacyError(status, body, traceId);
  if (isSuccessStatus(status) && (meta.isJson || body === null)) return fromPlainSuccess(status, body, traceId);
  return fromUnexpected(status, traceId);
}
