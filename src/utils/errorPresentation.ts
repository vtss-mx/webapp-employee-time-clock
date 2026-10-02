import { ApiError, DEVICE_NOT_ALLOWED_CODES } from '../services/apiClient';

export type MessageVariant = 'error' | 'warning' | 'info' | 'success';

/** Cómo se presenta un error en el popup: tono, título, texto, detalle por campo y rastreo. */
export interface ErrorPresentation {
  variant: MessageVariant;
  title: string;
  text: string;
  details: string[];
  /** Solo en fallas del servidor o de red: es lo que soporte necesita para rastrearla. */
  traceId: string | null;
  retryable: boolean;
}

const BY_STATUS: Record<number, { variant: MessageVariant; title: string }> = {
  0: { variant: 'error', title: 'Sin conexión con el servidor' },
  401: { variant: 'warning', title: 'No fue posible validar tu acceso' },
  403: { variant: 'warning', title: 'Acción no permitida' },
  404: { variant: 'warning', title: 'No encontramos lo que buscas' },
  408: { variant: 'warning', title: 'El servidor tardó en responder' },
  409: { variant: 'warning', title: 'La información ya existe' },
  413: { variant: 'warning', title: 'El archivo es demasiado grande' },
  422: { variant: 'warning', title: 'Revisa la información' },
  429: { variant: 'warning', title: 'Demasiados intentos' },
};
const SERVER_ERROR = { variant: 'error', title: 'Ocurrió un problema en el servidor' } as const;
const UNKNOWN_ERROR = { variant: 'error', title: 'No se pudo completar la operación' } as const;
const FALLBACK_TEXT = 'Ocurrió un error inesperado. Intenta nuevamente.';

export function describeError(error: unknown, title?: string): ErrorPresentation {
  if (error instanceof ApiError) {
    const known = BY_STATUS[error.status] ?? (error.status >= 500 ? SERVER_ERROR : UNKNOWN_ERROR);
    // Errores por campo que no repiten el mensaje principal (p. ej. varios campos inválidos).
    const details = [...new Set(error.errors.filter((e) => e.field && e.message !== error.message).map((e) => e.message))];
    return {
      variant: known.variant,
      title: title ?? known.title,
      text: error.message || FALLBACK_TEXT,
      details,
      traceId: error.status === 0 || error.status >= 500 ? error.traceId : null,
      retryable: error.isTransient,
    };
  }
  const text = error instanceof Error && error.message ? error.message : typeof error === 'string' && error ? error : FALLBACK_TEXT;
  return { variant: 'error', title: title ?? 'Ocurrió un problema', text, details: [], traceId: null, retryable: false };
}

/**
 * Errores que la app ya presenta de forma global y no deben repetirse en cada pantalla:
 * dispositivo no permitido (aviso de teléfono) y sesión vencida (aviso al volver al login).
 * En el login los 401 sí se muestran (credenciales incorrectas, cuenta desactivada).
 */
export function isHandledGlobally(error: unknown, { showAuthErrors = false } = {}): boolean {
  if (!(error instanceof ApiError)) return false;
  if (DEVICE_NOT_ALLOWED_CODES.has(error.code)) return true;
  return error.status === 401 && !showAuthErrors;
}
