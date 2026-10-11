/**
 * Revisión de accesos (pantalla `ADMIN_ACCESS_REVIEW`, solo el ADMIN; migración 0096 del backend): contrato de
 * `/api/admin/access-review`.
 *
 * Solo datos de ACCESO (correo, rol, empresa, fechas y conteos): nunca datos fiscales, de contacto, biometría ni
 * hashes (regla 13 de la raíz). Los CONTROLES declarados los envía el servidor desde el código vigente: la app los
 * dibuja como datos, nunca los escribe.
 */
import type { Page, Role, UserCompanyInfo } from './index';

/** Una cuenta como la revisa el auditor. */
export interface AccessReviewAccount {
  id: number;
  email: string;
  role: Role;
  active: boolean;
  created_at: string;
  /** Empresa de la cuenta (COMPANY y VALIDATOR); null en el ADMIN y en un empleado de varias empresas. */
  company: UserCompanyInfo | null;
  last_login_at: string | null;
  /** Días desde su último acceso; null = nunca ha entrado. */
  days_since_login: number | null;
  stale: boolean;
  locked: boolean;
  locked_until: string | null;
  mfa_required: boolean;
  mfa_satisfied: boolean;
  passkeys: number;
  mfa_grace_until: string | null;
  open_sessions: number;
  employments: number;
}

export type AccessReviewList = Page<AccessReviewAccount>;

/** Los controles DECLARADOS que acompañan al informe (salen del código vigente del servidor). */
export interface AccessControls {
  mfa_required_for: Role[];
  mfa_grace_days: number;
  password_min_length: number;
  password_history_size: number;
  breached_password_check: boolean;
  /** Argon2id declarado: iteraciones, memoria en MB (regla 17), hilos y tamaños. */
  argon2: Record<string, number>;
  lockout_max_failures: number;
  lockout_minutes: number;
  session_absolute_minutes: number;
  session_idle_minutes: number;
  privileged_session_idle_minutes: number;
  stale_days: number;
}

/** El encabezado fechado del informe: lo que el auditor copia en su papel de trabajo. */
export interface AccessReviewSummary {
  generated_at: string;
  accounts: number;
  /** Cuentas por rol (código del catálogo `roles` → cuántas). */
  by_role: Record<string, number>;
  inactive: number;
  never_signed_in: number;
  stale: number;
  locked: number;
  privileged: number;
  privileged_without_mfa: number;
  active_api_keys: number;
  api_keys_expiring_soon: number;
  controls: AccessControls;
}

/** La exportación del informe: CSV en base64 dentro del contrato único (se guarda con `utils/download.ts`). */
export interface AccessReviewExport {
  filename: string;
  content_type: string;
  data: string;
  rows: number;
  /** Tope aplicado: si `rows` lo alcanza, hay que filtrar más. */
  limit: number;
  generated_at: string;
}

/** Filtros del informe: los mismos del listado y de la exportación. */
export interface AccessReviewFilters {
  role?: Role;
  company_id?: number;
  without_mfa?: boolean;
  stale?: boolean;
  locked?: boolean;
  search?: string;
}
