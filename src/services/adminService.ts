import type {
  CompanyAdmin,
  CompanyAdminList,
  CompanyDetail,
  CompanyEmployee,
  CompanyEmployeeList,
  CompanyFormValues,
  CompanyList,
  CompanyListParams,
  FaceLearningSummary,
  PageQuery,
  PlatformStats,
  VerificationPolicy,
  VerificationPolicyUpdate,
} from '../types';
import { hasKeys, isPage } from '../utils/guards';
import { apiRequest } from './apiClient';
import { isPolicy } from './settingsService';

const isDetail = hasKeys<CompanyDetail>('id', 'name', 'active', 'employee_count');
const isAdmin = hasKeys<CompanyAdmin>('id', 'email', 'active');
const isEmployee = hasKeys<CompanyEmployee>('id', 'employee_number', 'first_name', 'last_name', 'active', 'face_status');
const isStats = hasKeys<PlatformStats>('companies', 'active_companies', 'employees', 'company_admins');

type CompanyData = Omit<CompanyFormValues, 'admin_email' | 'admin_password' | 'admin_password_confirm'>;

/** Datos de la empresa como los espera la API (sin espacios sobrantes, límite numérico o null). */
function companyBody(values: Partial<CompanyData>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (key === 'max_employees') body[key] = value === '' ? null : Number(value);
    else body[key] = typeof value === 'string' ? value.trim() : value;
  }
  return body;
}

/** Consola de la plataforma (rol ADMIN): empresas y sus administradores. */
export const adminService = {
  stats(signal?: AbortSignal): Promise<PlatformStats> {
    return apiRequest<PlatformStats>('/admin/stats', { signal, validate: isStats });
  },

  list(params: CompanyListParams = {}, signal?: AbortSignal): Promise<CompanyList> {
    return apiRequest<CompanyList>('/admin/companies', { query: { ...params }, signal, validate: isPage(isDetail) });
  },

  get(id: number, signal?: AbortSignal): Promise<CompanyDetail> {
    return apiRequest<CompanyDetail>(`/admin/companies/${id}`, { signal, validate: isDetail });
  },

  /** Empresa + su primer administrador en una sola operación (y si usará Integraciones). */
  create(values: CompanyFormValues, apiEnabled = false): Promise<CompanyDetail> {
    const { admin_email, admin_password, admin_password_confirm: _confirm, ...company } = values;
    const body = { ...companyBody(company), api_enabled: apiEnabled, admin_email: admin_email.trim(), admin_password };
    return apiRequest<CompanyDetail>('/admin/companies', { method: 'POST', body, validate: isDetail });
  },

  update(id: number, changes: Partial<CompanyData>): Promise<CompanyDetail> {
    return apiRequest<CompanyDetail>(`/admin/companies/${id}`, { method: 'PUT', body: companyBody(changes), validate: isDetail });
  },

  /**
   * Acceso de la empresa al módulo de Integraciones (API). Sin él, su pantalla desaparece del menú y
   * el backend rechaza sus llaves aunque existan (no se borran: al volver a darlo, funcionan).
   */
  setApiAccess(id: number, enabled: boolean): Promise<CompanyDetail> {
    return apiRequest<CompanyDetail>(`/admin/companies/${id}`, { method: 'PUT', body: { api_enabled: enabled }, validate: isDetail });
  },

  setStatus(id: number, active: boolean): Promise<CompanyDetail> {
    return apiRequest<CompanyDetail>(`/admin/companies/${id}/status`, { method: 'PATCH', body: { active }, validate: isDetail });
  },

  /** Solo una empresa sin empleados (con empleados, el backend responde 409 y se desactiva). */
  remove(id: number): Promise<void> {
    return apiRequest<null>(`/admin/companies/${id}`, { method: 'DELETE' }).then(() => undefined);
  },

  /** Administradores de la empresa, paginados (el más antiguo primero). */
  admins(id: number, query: PageQuery, signal?: AbortSignal): Promise<CompanyAdminList> {
    return apiRequest<CompanyAdminList>(`/admin/companies/${id}/admins`, { query: { ...query }, signal, validate: isPage(isAdmin) });
  },

  /** Política de verificación de identidad de la empresa: la configura el ADMIN (la empresa solo la lee). */
  policy(id: number, signal?: AbortSignal): Promise<VerificationPolicy> {
    return apiRequest<VerificationPolicy>(`/admin/companies/${id}/verification-policy`, { signal, validate: isPolicy });
  },

  /** Actualización parcial (solo los campos enviados); aplica en segundos a toda la empresa. */
  updatePolicy(id: number, changes: VerificationPolicyUpdate): Promise<VerificationPolicy> {
    return apiRequest<VerificationPolicy>(`/admin/companies/${id}/verification-policy`, { method: 'PUT', body: changes, validate: isPolicy });
  },

  /** Empleados de la empresa, paginados y de solo lectura (su ficha de trabajo, sin biometría). */
  employees(id: number, query: CompanyListParams, signal?: AbortSignal): Promise<CompanyEmployeeList> {
    return apiRequest<CompanyEmployeeList>(`/admin/companies/${id}/employees`, { query: { ...query }, signal, validate: isPage(isEmployee) });
  },

  /** Cómo evoluciona el reconocimiento facial de la empresa (solo el ADMIN lo ve y lo administra). */
  faceLearning(id: number, signal?: AbortSignal): Promise<FaceLearningSummary> {
    return apiRequest<FaceLearningSummary>(`/admin/companies/${id}/face-learning`, {
      signal,
      validate: hasKeys<FaceLearningSummary>('enabled', 'employees_learning', 'learned_samples'),
    });
  },

  /** Olvida lo que el reconocimiento aprendió de un empleado: vuelve a su registro aprobado. */
  forgetLearnedFace(id: number, employeeId: number): Promise<CompanyEmployee> {
    return apiRequest<CompanyEmployee>(`/admin/companies/${id}/employees/${employeeId}/face/learned`, { method: 'DELETE', validate: isEmployee });
  },

  admin(id: number, userId: number, signal?: AbortSignal): Promise<CompanyAdmin> {
    return apiRequest<CompanyAdmin>(`/admin/companies/${id}/admins/${userId}`, { signal, validate: isAdmin });
  },

  addAdmin(id: number, email: string, password: string): Promise<CompanyDetail> {
    const body = { admin_email: email.trim(), admin_password: password };
    return apiRequest<CompanyDetail>(`/admin/companies/${id}/admins`, { method: 'POST', body, validate: isDetail });
  },

  setAdminStatus(id: number, userId: number, active: boolean): Promise<CompanyDetail> {
    return apiRequest<CompanyDetail>(`/admin/companies/${id}/admins/${userId}/status`, {
      method: 'PATCH',
      body: { active },
      validate: isDetail,
    });
  },

  /** Contraseña olvidada: asigna una nueva y cierra las sesiones abiertas del administrador. */
  resetAdminPassword(id: number, userId: number, password: string): Promise<CompanyDetail> {
    return apiRequest<CompanyDetail>(`/admin/companies/${id}/admins/${userId}/password`, {
      method: 'PUT',
      body: { admin_password: password },
      validate: isDetail,
    });
  },
};
