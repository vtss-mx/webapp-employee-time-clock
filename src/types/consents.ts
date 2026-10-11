/**
 * Consentimiento para tratar datos biométricos (migración 0094 del backend; regla 22 de la raíz: BIPA §15(b), RGPD
 * art. 9.2.a y LFPDPPP). El contrato de `GET /me/consents`, `POST /me/consents` y `DELETE /me/consents/{tipo}`.
 *
 * El TEXTO que lee la persona lo escribe el servidor (título y cinco párrafos) en el idioma de la petición, con su
 * `version` y el `text_sha256` de lo que se mostró: al otorgarlo se devuelven tal cual, así queda probado QUÉ leyó
 * (un texto distinto responde 422 `CONSENT_TEXT_MISMATCH`). La app no escribe ni resume ese texto.
 *
 * `type` es un código del catálogo `consent_types`: se trata como una cadena, no como una lista fija, para que un
 * consentimiento nuevo del servidor se dibuje sin tocar la app (regla 1: el frontend dibuja lo que manda el backend).
 */

/** Lo que la app sabe de UN consentimiento de la persona (lo mismo que devuelven otorgar y revocar). */
export interface ConsentState {
  /** Código del catálogo `consent_types` (hoy `BIOMETRIC_DATA`). */
  type: string;
  /** Vigente: lo otorgó y no lo ha revocado. */
  granted: boolean;
  granted_at: string | null;
  revoked_at: string | null;
  /** Versión del texto que leyó al otorgarlo (prueba), no la vigente. */
  text_version: string | null;
  /** Idioma en que lo leyó al otorgarlo. */
  locale: string | null;
}

/** Un consentimiento con el texto vigente para leerlo y otorgarlo. */
export interface ConsentAsk extends ConsentState {
  /** Su empresa lo pide: sin él no se puede registrar biometría. */
  required: boolean;
  /** Versión del texto VIGENTE (se devuelve al otorgar). */
  version: string;
  /** Huella del texto vigente en el idioma de la petición (se devuelve al otorgar). */
  text_sha256: string;
  /** Título del texto legal, tal como lo envía el servidor. */
  title: string;
  /** Los cinco párrafos del texto legal, en su orden: qué se captura, para qué, retención, revocación y efecto. */
  paragraphs: string[];
}

export interface ConsentAskList {
  items: ConsentAsk[];
}
