import { t } from '../i18n/core';
import { ApiError, COMPANY_SUSPENDED, DEVICE_NOT_ALLOWED_CODES } from '../services/apiClient';
import type { Messages } from '../types/i18n';

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

type ErrorTitle = keyof Messages['errors']['titles'];

const BY_STATUS: Record<number, { variant: MessageVariant; title: ErrorTitle }> = {
  0: { variant: 'error', title: 'network' },
  401: { variant: 'warning', title: 'unauthorized' },
  403: { variant: 'warning', title: 'forbidden' },
  404: { variant: 'warning', title: 'notFound' },
  408: { variant: 'warning', title: 'timeout' },
  409: { variant: 'warning', title: 'conflict' },
  413: { variant: 'warning', title: 'payloadTooLarge' },
  422: { variant: 'warning', title: 'unprocessable' },
  429: { variant: 'warning', title: 'rateLimited' },
};
const SERVER_ERROR = { variant: 'error', title: 'server' } as const;
const UNKNOWN_ERROR = { variant: 'error', title: 'failed' } as const;
const fallbackText = () => t('errors.unexpectedRetry');

/**
 * Cómo se presenta un error, en el idioma activo: el popup lo vuelve a calcular cada vez que se
 * dibuja (un cambio de idioma con el popup abierto cambia su título y los textos que armó la app).
 */
export function describeError(error: unknown, title?: string): ErrorPresentation {
  if (error instanceof ApiError) {
    const known = BY_STATUS[error.status] ?? (error.status >= 500 ? SERVER_ERROR : UNKNOWN_ERROR);
    // Errores por campo que no repiten el mensaje principal (p. ej. varios campos inválidos).
    const details = [...new Set(error.errors.filter((e) => e.field && e.message !== error.message).map((e) => e.message))];
    return {
      variant: known.variant,
      title: title ?? t(`errors.titles.${known.title}`),
      text: error.message || fallbackText(),
      details,
      traceId: error.status === 0 || error.status >= 500 ? error.traceId : null,
      retryable: error.isTransient,
    };
  }
  const text = error instanceof Error && error.message ? error.message : typeof error === 'string' && error ? error : fallbackText();
  return { variant: 'error', title: title ?? t('errors.titles.generic'), text, details: [], traceId: null, retryable: false };
}

/**
 * Errores que la app ya presenta de forma global y no deben repetirse en cada pantalla:
 * dispositivo no permitido (aviso de teléfono), empresa suspendida (pantalla completa, también en el
 * login) y sesión vencida (aviso al volver al login).
 * En el login los 401 sí se muestran (credenciales incorrectas, cuenta desactivada).
 */
export function isHandledGlobally(error: unknown, { showAuthErrors = false } = {}): boolean {
  if (!(error instanceof ApiError)) return false;
  if (DEVICE_NOT_ALLOWED_CODES.has(error.code) || error.code === COMPANY_SUSPENDED) return true;
  return error.status === 401 && !showAuthErrors;
}
