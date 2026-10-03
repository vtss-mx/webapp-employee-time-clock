import type { CompanyDetail, CompanyFormValues, CompanyList, CompanyListParams, PlatformStats } from '../types';
import { hasKeys, isPage } from '../utils/guards';
import { apiRequest } from './apiClient';

const isCompany = hasKeys<CompanyDetail>('id', 'name', 'active', 'employee_count');
const isDetail = hasKeys<CompanyDetail>('id', 'name', 'admins');
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
    return apiRequest<CompanyList>('/admin/companies', { query: { ...params }, signal, validate: isPage(isCompany) });
  },

  get(id: number): Promise<CompanyDetail> {
    return apiRequest<CompanyDetail>(`/admin/companies/${id}`, { validate: isDetail });
  },

  /** Empresa + su primer administrador en una sola operación. */
  create(values: CompanyFormValues): Promise<CompanyDetail> {
    const { admin_email, admin_password, admin_password_confirm: _confirm, ...company } = values;
    const body = { ...companyBody(company), admin_email: admin_email.trim(), admin_password };
    return apiRequest<CompanyDetail>('/admin/companies', { method: 'POST', body, validate: isDetail });
  },

  update(id: number, changes: Partial<CompanyData>): Promise<CompanyDetail> {
    return apiRequest<CompanyDetail>(`/admin/companies/${id}`, { method: 'PUT', body: companyBody(changes), validate: isDetail });
  },

  setStatus(id: number, active: boolean): Promise<CompanyDetail> {
    return apiRequest<CompanyDetail>(`/admin/companies/${id}/status`, { method: 'PATCH', body: { active }, validate: isDetail });
  },

  /** Solo una empresa sin empleados (con empleados, el backend responde 409 y se desactiva). */
  remove(id: number): Promise<void> {
    return apiRequest<null>(`/admin/companies/${id}`, { method: 'DELETE' }).then(() => undefined);
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
