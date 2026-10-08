// Consola de la plataforma (solo el ADMIN): empresas, sus administradores y el resumen global.
import type { WithAvatar } from './avatar';
import type { BillingStatus, SuspensionReason } from './billing';
import type { SoftDeleted } from './trash';

export interface Company extends SoftDeleted {
  id: number;
  name: string;
  legal_name: string | null;
  /**
   * Identificador fiscal de cualquier país (migración 0074): país (ISO alfa-2), tipo (catálogo `tax_id_types`) y número
   * normalizado; los tres null = sin capturar. (El backend aún envía `rfc`, obsoleto: la app ya no lo usa.)
   */
  tax_country: string | null;
  tax_id_type: string | null;
  tax_id: string | null;
  phone: string | null;
  active: boolean;
  max_employees: number | null;
  /** Validadores ACTIVOS que puede tener (lo decide el ADMIN). 0 = sin el módulo de validadores. */
  max_validators: number;
  /** El ADMIN de la plataforma decide si la empresa usa el módulo de Integraciones (API). */
  api_enabled: boolean;
  /**
   * El ADMIN decide si la empresa exige documentos de identidad en el onboarding (comprobante de domicilio e
   * identificación oficial; decisión del dueño, 2026-10-07). Encendido, el empleado los sube y la empresa los revisa.
   */
  require_employee_documents: boolean;
  employee_count: number;
  admin_count: number;
  /** Validadores activos: cuentan contra `max_validators` y se cobran como empleados. */
  active_validators: number;
  /** Cobranza: suspendida (por falta de pago o a mano), nadie de la empresa puede iniciar sesión. */
  billing_status: BillingStatus;
  suspension_reason: SuspensionReason | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyAdmin extends WithAvatar {
  id: number;
  email: string;
  active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface CompanyListParams {
  search?: string;
  active?: boolean;
  /** Solo las de «Eliminadas» (sin `active`). */
  deleted?: boolean;
  page?: number;
  size?: number;
}

/** Formulario de empresa; los datos del administrador solo se capturan al dar de alta. */
export interface CompanyFormValues {
  name: string;
  legal_name: string;
  /** País fiscal y tipo de identificador (siempre con valor: se proponen MX y su RFC) y el número (vacío = sin capturar). */
  tax_country: string;
  tax_id_type: string;
  tax_id: string;
  /** 10 dígitos. */
  phone: string;
  /** Vacío = sin límite. */
  max_employees: string;
  /** Validadores activos permitidos: "0" = sin el módulo (por omisión en el alta). */
  max_validators: string;
  admin_email: string;
  admin_password: string;
  /** Solo en el cliente: la contraseña repetida (no se envía). */
  admin_password_confirm: string;
}

export interface PlatformStats {
  companies: number;
  active_companies: number;
  employees: number;
  company_admins: number;
}
