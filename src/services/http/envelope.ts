/**
 * Contrato único de respuesta de la API y normalización de CUALQUIER respuesta a ese contrato:
 * el contrato mismo, el formato antiguo `{detail}`, HTML de un proxy/ngrok, texto plano,
 * cuerpo vacío o JSON inválido.
 */
import { t } from '../../i18n/core';
import type { Messages } from '../../types/i18n';
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
    // Texto que armó la app (sin respuesta o sin mensaje del servidor): se traduce al leerse, así un
    // popup abierto con este error cambia de idioma junto con la app. El del servidor ya llega traducido.
    const local = LOCAL_TEXTS.get(envelope);
    if (local) Object.defineProperty(this, 'message', { get: local, configurable: true, enumerable: false });
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

/**
 * Errores de una petición llevados a los campos de un formulario (única implementación): los de
 * validación por campo (`ApiError.fieldErrors`) y el de negocio cuyo código corresponde a un campo
 * (correo ya registrado, RFC que no coincide...), que tiene prioridad. `rename` traduce al nombre
 * del formulario tanto campos del backend (`location_radius_m` → `radius`) como códigos de error
 * (`EMAIL_TAKEN` → `email`); un campo sin traducción conserva su nombre.
 */
export function fieldErrorsFrom<T>(err: unknown, rename: Partial<Record<string, keyof T>> = {}): Partial<Record<keyof T, string>> {
  if (!(err instanceof ApiError)) return {};
  const result: Partial<Record<keyof T, string>> = {};
  for (const [field, message] of Object.entries(err.fieldErrors)) result[rename[field] ?? (field as keyof T)] = message;
  const byCode = rename[err.code];
  if (byCode) result[byCode] = err.message;
  return result;
}

/* ---------------------------- Valores por defecto ---------------------------- */

type StatusText = keyof Messages['errors']['status'];

/** Texto por estado cuando la respuesta no trae uno (o no hubo respuesta), en el idioma activo. */
const STATUS_TEXTS: Record<number, StatusText> = {
  0: 'network',
  200: 'ok',
  400: 'badRequest',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'notFound',
  405: 'methodNotAllowed',
  408: 'timeout',
  409: 'conflict',
  413: 'payloadTooLarge',
  415: 'unsupportedMedia',
  422: 'unprocessable',
  429: 'rateLimited',
  500: 'server',
  502: 'unavailable',
  503: 'unavailable',
  504: 'timeout',
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

const isSuccessStatus = (status: number) => status >= 200 && status < 300;

function statusText(status: number): StatusText {
  if (STATUS_TEXTS[status]) return STATUS_TEXTS[status];
  if (isSuccessStatus(status)) return 'ok';
  return status >= 500 ? 'server' : 'badRequest';
}

export function defaultMessage(status: number): string {
  return t(`errors.status.${statusText(status)}`);
}

/**
 * Envoltorios cuyo mensaje lo armó la app (no el servidor), con cómo traducirlo: `ApiError` lo lee al
 * construirse para que su texto siga al idioma activo. Débil: no retiene envoltorios que ya no se usan.
 */
const LOCAL_TEXTS = new WeakMap<object, () => string>();

/** El envoltorio lleva el texto de la app `text` (ya resuelto en `message`) y lo recuerda para traducirlo después. */
function localText<E extends object>(envelope: E, text: () => string): E {
  LOCAL_TEXTS.set(envelope, text);
  return envelope;
}

const invalidResponse = () => t('errors.invalidResponse');

export function defaultCode(status: number): string {
  if (DEFAULT_CODES[status]) return DEFAULT_CODES[status];
  if (isSuccessStatus(status)) return 'OK';
  return status >= 500 ? 'SERVER_ERROR' : 'HTTP_ERROR';
}

/** Error construido en el cliente (red, timeout, forma de datos inesperada). */
export function clientError(statusCode: number, traceId: string | null, code = defaultCode(statusCode)): ApiError {
  const text = code === 'INVALID_RESPONSE' ? invalidResponse : () => defaultMessage(statusCode);
  return new ApiError(localText({ statusCode, code, message: text(), traceId, errors: [singleError(code, text())] }, text));
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
  const serverMessage = asString(body.message);
  const message = serverMessage ?? defaultMessage(status);
  const success = isSuccessStatus(status) && body.success !== false;
  const errors = normalizeErrors(body.errors, code);
  const envelope: ApiEnvelope = {
    success,
    statusCode: status,
    code,
    message,
    data: body.data ?? null,
    errors: success ? [] : errors.length ? errors : [singleError(code, message)],
    traceId: asString(body.traceId) ?? traceId,
    timestamp: asString(body.timestamp),
  };
  return serverMessage ? envelope : localText(envelope, () => defaultMessage(status));
}

/** 2) Formato antiguo o de terceros: { detail, code, errors, details, request_id }. */
function fromLegacyError(status: number, body: Record<string, unknown>, traceId: string | null): ApiEnvelope {
  const code = asString(body.code) ?? asString(body.error) ?? defaultCode(status);
  const detail = body.detail;
  const details = isRecord(body.details) ? body.details : null;
  const serverMessage = asString(detail) ?? asString(body.message) ?? asString(body.error_description);
  const parsed = normalizeErrors(Array.isArray(detail) ? detail : body.errors, code);
  const errors = parsed.length ? parsed.map((e, i) => (i === 0 && details ? { ...e, details } : e)) : [singleError(code, serverMessage ?? defaultMessage(status), details)];
  // Varios errores de validación se resumen con el texto de la app; uno solo conserva el del servidor.
  const summary = Array.isArray(detail) && errors.length > 1 ? () => defaultMessage(422) : serverMessage ? null : () => defaultMessage(status);
  const envelope: ApiEnvelope = {
    success: false,
    statusCode: status,
    code,
    message: summary ? summary() : (serverMessage as string),
    data: null,
    errors,
    traceId: asString(body.request_id) ?? asString(body.traceId) ?? traceId,
    timestamp: null,
  };
  return summary ? localText(envelope, summary) : envelope;
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
  const text = isSuccessStatus(status) ? invalidResponse : () => defaultMessage(status);
  return localText({ success: false, statusCode, code, message: text(), data: null, errors: [singleError(code, text())], traceId, timestamp: null }, text);
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
