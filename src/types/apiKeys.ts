/**
 * Permiso de una llave de la API de integración (catálogo api_scopes): los de lectura y `VERIFICATION`, la verificación
 * facial desde la aplicación móvil de la empresa (SDK; migración 0084 del backend).
 */
/**
 * El código de un permiso del catálogo `api_scopes`: lo decide el BACKEND (regla 25 de la raíz) y crece con cada
 * módulo que se abre a la llave (regla 24), así que es un dato, no una lista que la app repita. Lo que la app hace
 * con él es dibujarlo con el nombre del catálogo y reenviarlo.
 */
export type ApiScope = string;

/** Estado de una llave de la API (catálogo api_key_statuses): se deriva de sus fechas. */
export type ApiKeyStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

/** Llave de la API de integración de la empresa (sin su secreto: solo se ve al crearla o rotarla). */
export interface ApiKey {
  id: number;
  name: string;
  /** Inicio de la llave para reconocerla (p. ej. "tck_Ab3dE9fG"). */
  prefix: string;
  scopes: ApiScope[];
  status: ApiKeyStatus;
  created_at: string;
  created_by: string | null;
  /**
   * Cuándo vence. Desde la migración 0096 del backend NINGUNA llave puede nacer sin vencimiento: el servidor pone
   * el suyo por omisión y nunca más de su tope (422 `API_KEY_EXPIRY_TOO_LONG`). Sigue siendo opcional en el tipo
   * porque una llave emitida antes de esa migración puede no tenerlo.
   */
  expires_at: string | null;
  /** Días que le quedan (negativo o 0: ya venció); null sin vencimiento. Lo calcula el servidor. */
  days_to_expire: number | null;
  /** Vence pronto: el aviso de rotarla lo decide el SERVIDOR, nunca la app. */
  expiring_soon: boolean;
  last_used_at: string | null;
  last_used_ip: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
}

/** Llave recién creada o rotada: el secreto viaja una sola vez. */
export interface ApiKeyCreated extends ApiKey {
  secret: string;
}

export interface ApiKeyCreatePayload {
  name: string;
  scopes: ApiScope[];
  /**
   * Días de vigencia; null = el valor por omisión del servidor. Ya NO existe «sin vencimiento» (migración 0096):
   * pasarse del tope responde 422 `API_KEY_EXPIRY_TOO_LONG` en el campo `expires_in_days`.
   */
  expires_in_days: number | null;
}
