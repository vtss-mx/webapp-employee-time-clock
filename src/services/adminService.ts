import type {
  AdminPolicyUpdate,
  AdminVerificationPolicy,
  BillingPlanInput,
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
  PolicyChange,
  PolicyChangeList,
  PolicyUpdateResult,
  Restored,
  RiskPolicyCandidate,
  RiskSimulation,
} from '../types';
import { hasKeys, isPage } from '../utils/guards';
import { apiRequest } from './apiClient';
import { restoreRecord } from './http/restore';
import { isPolicy } from './settingsService';

const isDetail = hasKeys<CompanyDetail>('id', 'name', 'active', 'employee_count');
const isAdmin = hasKeys<CompanyAdmin>('id', 'email', 'active');
const isEmployee = hasKeys<CompanyEmployee>('id', 'employee_number', 'first_name', 'last_name', 'active', 'face_status');
const isStats = hasKeys<PlatformStats>('companies', 'active_companies', 'employees', 'company_admins');
/** La política del ADMIN: la de la empresa más el motor de riesgo y los controles antifraude. */
const isAdminPolicy = (value: unknown): value is AdminVerificationPolicy => isPolicy(value) && hasKeys('risk_engine', 'risk_signals', 'pending_changes')(value);
const isUpdateResult = (value: unknown): value is PolicyUpdateResult => hasKeys<PolicyUpdateResult>('policy', 'change')(value) && isAdminPolicy(value.policy);
const isChange = hasKeys<PolicyChange>('id', 'status', 'changes', 'requested_by');
const isSimulation = hasKeys<RiskSimulation>('evaluated', 'current', 'candidate', 'frauds');

type CompanyData = Omit<CompanyFormValues, 'admin_email' | 'admin_password' | 'admin_password_confirm'>;

/**
 * Datos de la empresa como los espera la API (sin espacios sobrantes; límites numéricos: el de empleados o null). El
 * identificador fiscal es opcional: el número vacío viaja como null (sin capturar; al editar, lo borra con su país y su
 * tipo, que sin número el backend ignora).
 */
function companyBody(values: Partial<CompanyData>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (key === 'max_employees') body[key] = value === '' ? null : Number(value);
    else if (key === 'tax_id') body[key] = value.trim() || null;
    else if (key === 'max_validators') body[key] = Number(value);
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

  /**
   * Empresa + su primer administrador en una sola operación (y si usará Integraciones). `billing` es
   * su plan de cobro (la pantalla de alta siempre lo envía; null = sin plan, no se le cobra).
   */
  create(values: CompanyFormValues, apiEnabled = false, billing: BillingPlanInput | null = null): Promise<CompanyDetail> {
    const { admin_email, admin_password, admin_password_confirm: _confirm, ...company } = values;
    const body = { ...companyBody(company), api_enabled: apiEnabled, admin_email: admin_email.trim(), admin_password, billing };
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

  /**
   * Si la empresa exige documentos de identidad en el onboarding (comprobante de domicilio e identificación oficial;
   * decisión del dueño, 2026-10-07). Encendido, el empleado los sube y la empresa los revisa en el expediente.
   */
  setDocumentsRequired(id: number, required: boolean): Promise<CompanyDetail> {
    return apiRequest<CompanyDetail>(`/admin/companies/${id}`, { method: 'PUT', body: { require_employee_documents: required }, validate: isDetail });
  },

  setStatus(id: number, active: boolean): Promise<CompanyDetail> {
    return apiRequest<CompanyDetail>(`/admin/companies/${id}/status`, { method: 'PATCH', body: { active }, validate: isDetail });
  },

  /** Solo una empresa sin empleados (con empleados, el backend responde 409 y se desactiva); va a «Eliminadas». */
  remove(id: number): Promise<void> {
    return apiRequest<null>(`/admin/companies/${id}`, { method: 'DELETE' }).then(() => undefined);
  },

  /** La regresa de «Eliminadas» con sus cuentas (las fotos de sus cuentas no se recuperan). */
  restore(id: number): Promise<Restored<CompanyDetail>> {
    return restoreRecord(`/admin/companies/${id}`, isDetail);
  },

  /** Administradores de la empresa, paginados (el más antiguo primero). */
  admins(id: number, query: PageQuery, signal?: AbortSignal): Promise<CompanyAdminList> {
    return apiRequest<CompanyAdminList>(`/admin/companies/${id}/admins`, { query: { ...query }, signal, validate: isPage(isAdmin) });
  },

  /**
   * Política de verificación de identidad de la empresa: la configura el ADMIN (la empresa solo lee su parte). Trae
   * además el motor de riesgo, los controles antifraude y cuántos cambios esperan aprobación.
   */
  policy(id: number, signal?: AbortSignal): Promise<AdminVerificationPolicy> {
    return apiRequest<AdminVerificationPolicy>(`/admin/companies/${id}/verification-policy`, { signal, validate: isAdminPolicy });
  },

  /**
   * Pide un cambio parcial (solo los campos enviados). Lo que endurece aplica en segundos; lo que RELAJA la
   * seguridad queda por aprobar de otro ADMIN (`change.status = PENDING`, regla de dos personas) y la política
   * sigue igual. `change` es null si no cambiaba nada.
   */
  updatePolicy(id: number, changes: AdminPolicyUpdate): Promise<PolicyUpdateResult> {
    return apiRequest<PolicyUpdateResult>(`/admin/companies/${id}/verification-policy`, { method: 'PUT', body: changes, validate: isUpdateResult });
  },

  /** Aplica un nivel predefinido (Estándar, Alto o Máximo) por el mismo camino que un cambio. */
  applyPolicyPreset(id: number, preset: string, reason?: string): Promise<PolicyUpdateResult> {
    return apiRequest<PolicyUpdateResult>(`/admin/companies/${id}/verification-policy/preset`, {
      method: 'POST',
      body: { preset, reason: reason?.trim() || null },
      validate: isUpdateResult,
    });
  },

  /** Historial de la política (quién, cuándo, antes → después); con `status`, solo ese estado (p. ej. PENDING). */
  policyChanges(id: number, query: PageQuery & { status?: string }, signal?: AbortSignal): Promise<PolicyChangeList> {
    return apiRequest<PolicyChangeList>(`/admin/companies/${id}/verification-policy/changes`, { query: { ...query }, signal, validate: isPage(isChange) });
  },

  /** Aprobar un cambio pendiente (solo un ADMIN distinto de quien lo pidió): la política lo aplica al instante. */
  approvePolicyChange(id: number, changeId: number): Promise<PolicyUpdateResult> {
    return apiRequest<PolicyUpdateResult>(`/admin/companies/${id}/verification-policy/changes/${changeId}/approve`, { method: 'POST', validate: isUpdateResult });
  },

  /** Rechazar un cambio pendiente con su motivo (lo lee quien lo pidió). */
  rejectPolicyChange(id: number, changeId: number, note: string): Promise<PolicyChange> {
    return apiRequest<PolicyChange>(`/admin/companies/${id}/verification-policy/changes/${changeId}/reject`, {
      method: 'POST',
      body: { note: note.trim() },
      validate: isChange,
    });
  },

  /** Retirar un cambio propio por aprobar. */
  cancelPolicyChange(id: number, changeId: number): Promise<PolicyChange> {
    return apiRequest<PolicyChange>(`/admin/companies/${id}/verification-policy/changes/${changeId}/cancel`, { method: 'POST', validate: isChange });
  },

  /** ¿Qué habría pasado en los últimos días con esta configuración del motor de riesgo? (no guarda nada). */
  simulatePolicy(id: number, candidate: RiskPolicyCandidate, signal?: AbortSignal): Promise<RiskSimulation> {
    return apiRequest<RiskSimulation>(`/admin/companies/${id}/verification-policy/simulate`, { method: 'POST', body: candidate, signal, validate: isSimulation });
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
