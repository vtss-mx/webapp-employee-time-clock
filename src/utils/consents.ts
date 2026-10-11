import { ApiError } from '../services/apiClient';
import type { ConsentAsk } from '../types/consents';

/** 403 de toda ruta que crea biometría mientras la persona no haya otorgado su consentimiento (migración 0094). */
export const BIOMETRIC_CONSENT_REQUIRED = 'BIOMETRIC_CONSENT_REQUIRED';

/**
 * Códigos con los que el servidor dice que lo que la app muestra ya no es lo vigente: el texto cambió (422
 * `CONSENT_TEXT_MISMATCH`, también cuando se mostró en otro idioma), ya estaba otorgado (409) o ya no lo estaba (409).
 * En los tres se vuelve a pedir el estado y el texto: reintentar con lo que hay en pantalla no puede funcionar.
 */
const OUTDATED: ReadonlySet<string> = new Set(['CONSENT_TEXT_MISMATCH', 'CONSENT_ALREADY_GRANTED', 'CONSENT_NOT_GRANTED']);

/**
 * Falta el consentimiento biométrico: el paso no puede seguir y reintentarlo tampoco (regla 7: cada código con la
 * acción que sí funciona). Se discrimina por código Y por estado: un 403 también puede ser `FORBIDDEN` o
 * `FACE_NOT_APPROVED`.
 */
export function isConsentRequired(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403 && error.code === BIOMETRIC_CONSENT_REQUIRED;
}

/** Lo que la app tiene del consentimiento ya no sirve: hay que volver a pedir el texto y el estado. */
export function isConsentOutdated(error: unknown): boolean {
  return error instanceof ApiError && OUTDATED.has(error.code);
}

/** Los consentimientos que la empresa pide y la persona todavía no ha otorgado (los que detienen su registro). */
export function pendingConsents(items: readonly ConsentAsk[]): ConsentAsk[] {
  return items.filter((item) => item.required && !item.granted);
}
