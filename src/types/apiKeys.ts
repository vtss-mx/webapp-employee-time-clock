/**
 * Permiso de una llave de la API de integración (catálogo api_scopes): los de lectura y `VERIFICATION`, la verificación
 * facial desde la aplicación móvil de la empresa (SDK; migración 0084 del backend).
 */
export type ApiScope = 'EMPLOYEES_READ' | 'ATTENDANCE_READ' | 'VALIDATORS_READ' | 'VERIFICATION';

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
  expires_at: string | null;
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
  /** Días de vigencia; null = sin vencimiento. */
  expires_in_days: number | null;
}
