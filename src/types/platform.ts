// Consola de la plataforma (solo el ADMIN): empresas, sus administradores y el resumen global.

export interface Company {
  id: number;
  name: string;
  legal_name: string | null;
  rfc: string | null;
  phone: string | null;
  active: boolean;
  max_employees: number | null;
  /** El ADMIN de la plataforma decide si la empresa usa el módulo de Integraciones (API). */
  api_enabled: boolean;
  employee_count: number;
  admin_count: number;
  created_at: string;
  updated_at: string;
}

export interface CompanyAdmin {
  id: number;
  email: string;
  active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface CompanyListParams {
  search?: string;
  active?: boolean;
  page?: number;
  size?: number;
}

/** Formulario de empresa; los datos del administrador solo se capturan al dar de alta. */
export interface CompanyFormValues {
  name: string;
  legal_name: string;
  rfc: string;
  /** 10 dígitos. */
  phone: string;
  /** Vacío = sin límite. */
  max_employees: string;
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
