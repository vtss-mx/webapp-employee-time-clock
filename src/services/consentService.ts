import type { ConsentAsk, ConsentAskList, ConsentState } from '../types/consents';
import { hasKeys, isArrayOf, isRecord } from '../utils/guards';
import { apiRequest } from './apiClient';

/** Rutas del consentimiento del propio titular (rol EMPLOYEE, pantalla `PROFILE`). */
const BASE = '/me/consents';

const isText = (value: unknown): value is string => typeof value === 'string';

/**
 * Un consentimiento con su texto: además de las llaves, los párrafos tienen que ser una lista de textos (la pantalla
 * los recorre; una respuesta de otra forma no debe romperla).
 */
const isAsk = (value: unknown): value is ConsentAsk =>
  hasKeys<ConsentAsk>('type', 'granted', 'required', 'version', 'text_sha256', 'title')(value) && isArrayOf<string[]>(isText)(value.paragraphs);

const isAskList = (value: unknown): value is ConsentAskList => isRecord(value) && isArrayOf<ConsentAsk[]>(isAsk)(value.items);

const isState = hasKeys<ConsentState>('type', 'granted', 'granted_at', 'revoked_at');

/*
 * Consentimiento biométrico (regla 22 de la raíz; migración 0094 del backend). Toda ruta que crea biometría responde
 * 403 `BIOMETRIC_CONSENT_REQUIRED` mientras falte: la app lo pide con el TEXTO del servidor y lo otorga devolviendo la
 * misma `version` y el mismo `text_sha256` que mostró. El idioma importa: el servidor recalcula la huella en el idioma
 * de la petición (`Accept-Language`, que pone `apiClient`), así que mostrar y otorgar tienen que ir en el MISMO idioma;
 * si no coincide responde 422 `CONSENT_TEXT_MISMATCH` y el texto se vuelve a pedir (regla 16: el idioma es parte de la
 * llave del recurso).
 */
export const consentService = {
  /** EMPLOYEE: qué consentimientos se le piden, su estado y el texto vigente en el idioma de la petición. */
  list(signal?: AbortSignal): Promise<ConsentAskList> {
    return apiRequest<ConsentAskList>(BASE, { signal, validate: isAskList });
  },

  /** EMPLOYEE: otorga el consentimiento con la versión y la huella del texto que se mostró (solo el titular). */
  grant(ask: Pick<ConsentAsk, 'type' | 'version' | 'text_sha256'>): Promise<ConsentState> {
    return apiRequest<ConsentState>(BASE, {
      method: 'POST',
      body: { type: ask.type, version: ask.version, text_sha256: ask.text_sha256 },
      validate: isState,
    });
  },

  /**
   * EMPLOYEE: revoca el consentimiento. El servidor borra DE VERDAD la biometría al momento (rostro, plantillas,
   * fotos y clips) y el registro facial deja de existir: es irreversible y se confirma antes (regla 3).
   */
  revoke(type: string): Promise<ConsentState> {
    return apiRequest<ConsentState>(`${BASE}/${encodeURIComponent(type)}`, { method: 'DELETE', validate: isState });
  },
};
