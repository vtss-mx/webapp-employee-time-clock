/**
 * Claves de FIRMA de una empresa (migración 0105 del backend, regla 24 de la raíz): la clave pública con que la
 * empresa firma cada petición de la API de integración —su clave privada nunca toca el servidor— y la clave pública
 * con que la plataforma firma lo que responde.
 *
 * Lo que NUNCA vive aquí es la clave privada de la empresa: solo viaja UNA vez, en la respuesta de «generar el par»
 * (`SigningKeyGenerated.private_key`), y no se guarda en ninguna parte (ni en el servidor, ni en el navegador).
 */
import type { ApiKeyStatus } from './apiKeys';

/** Clave de firma de la empresa. Todo esto es público por diseño: una clave pública no es un secreto. */
export interface SigningKey {
  id: number;
  /** Para qué sistema es (p. ej. «Nómina»). */
  label: string;
  /** `sha256` del SPKI DER en hexadecimal: lo que viaja en `X-Signature-Key` y dice CUÁL clave firmó. */
  fingerprint: string;
  /** La clave pública tal como se verifica (SPKI DER en base64): se puede comparar con la que se registró. */
  public_key: string;
  /** Hoy siempre `ES256` (ECDSA P-256 con SHA-256), el algoritmo del contrato. */
  algorithm: string;
  /** `true`: la plataforma generó el par y entregó la privada una vez; `false`: la empresa subió su pública. */
  generated: boolean;
  /** Se deriva de sus fechas en el SERVIDOR (catálogo `api_key_statuses`), nunca en la app. */
  status: ApiKeyStatus;
  created_at: string;
  created_by: string | null;
  expires_at: string;
  /** Días completos que le quedan (0 = vence hoy). Lo calcula el servidor. */
  days_to_expire: number;
  /** Vence pronto: el aviso de rotarla lo decide el SERVIDOR con su propio plazo, nunca la app. */
  expiring_soon: boolean;
  revoked_at: string | null;
  revoked_by: string | null;
  last_used_at: string | null;
}

/**
 * El par recién generado por la plataforma. `private_key` (PEM PKCS#8) viaja UNA sola vez: el servidor no la guarda
 * y la aplicación tampoco (no va a `localStorage`, `sessionStorage`, IndexedDB ni al estado de una ruta; vive en el
 * popup que la muestra y desaparece al cerrarlo).
 */
export interface SigningKeyGenerated extends SigningKey {
  private_key: string;
}

/**
 * Clave pública con que la PLATAFORMA firma sus respuestas a ESTA empresa (`X-Platform-Signature`).
 * `configured: false` = la plataforma no tiene su secreto raíz y no firma: no hay nada que verificar, y eso NO es
 * un error (así lo dice el contrato §2.5).
 */
export interface PlatformKey {
  configured: boolean;
  fingerprint: string | null;
  public_key: string | null;
  algorithm: string | null;
}

/**
 * Las reglas del SERVIDOR que viajan con el listado (regla 25 de la raíz): la app no lleva escrito ninguno de estos
 * números, los dibuja. Salen del `.env` del backend (`API_SIGNATURE_*`).
 */
export interface SigningKeyLimits {
  /** Claves que hoy pueden firmar (sin revocar y sin vencer). */
  active: number;
  /** Tope de claves vigentes por empresa; llegar a él responde 409 `SIGNING_KEY_LIMIT`. */
  max_active: number;
  /** Vigencia que se le da a una clave si no se pide otra. */
  default_days: number;
  /** Vigencia máxima que se puede pedir; pasarse responde 422 `SIGNING_KEY_EXPIRY_TOO_LONG`. */
  max_days: number;
  /** Días que la clave reemplazada sigue firmando al rotar. */
  grace_days: number;
}

/** Lo que se envía para registrar la clave pública de la empresa (el camino recomendado). */
export interface SigningKeyRegisterPayload {
  label: string;
  /** SPKI en PEM o su DER en base64 (estándar o url): el servidor acepta las tres formas. */
  public_key: string;
  /** Días de vigencia; null = la vigencia por omisión del servidor. */
  expires_in_days: number | null;
  /** Clave que reemplaza (rotación con ventana de gracia); null = una clave más. */
  replaces: number | null;
}

/** Lo que se envía para que la plataforma genere el par (el segundo camino): lo mismo, sin la clave pública. */
export type SigningKeyGeneratePayload = Omit<SigningKeyRegisterPayload, 'public_key'>;
