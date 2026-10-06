import type {
  Employee,
  EnrollmentSubmitResponse,
  EmployeeCreatePayload,
  EmployeeIdList,
  EmployeeList,
  EmployeeListParams,
  EmployeeQrSummary,
  EmployeeUpdatePayload,
  IdentityReverifySummary,
  PageQuery,
  Restored,
  VerificationLogList,
  VerificationResult,
} from '../types';
import { hasKeys, isNothing, isPage } from '../utils/guards';
import { apiRequest } from './apiClient';
import { postFaceCaptures, type FaceCaptures } from './http/faceUpload';
import { restoreRecord } from './http/restore';
import { isVerificationResult } from './verificationService';

const isEmployee = hasKeys<Employee>('id', 'employee_number', 'first_name', 'last_name');
const isQrSummary = hasKeys<EmployeeQrSummary>('live', 'last_used_at');

export const employeeService = {
  /** Registro asistido: la empresa captura el rostro del empleado presente (queda aprobado al momento). */
  enrollFaceInPerson(id: number, captures: FaceCaptures): Promise<EnrollmentSubmitResponse> {
    return postFaceCaptures(`/employees/${id}/face/enroll`, captures, hasKeys<EnrollmentSubmitResponse>('enrollment_id', 'face_status'));
  },

  /** Verificación en persona: el rostro del empleado presente contra su registro aprobado (1:1). */
  verifyFaceInPerson(id: number, captures: FaceCaptures): Promise<VerificationResult> {
    return postFaceCaptures(`/employees/${id}/face/verify`, captures, isVerificationResult);
  },

  list(params: EmployeeListParams = {}, signal?: AbortSignal): Promise<EmployeeList> {
    return apiRequest<EmployeeList>('/employees', { query: { ...params }, signal, validate: isPage(isEmployee) });
  },

  /**
   * Los ids de los empleados de un filtro (los mismos filtros de `list`), a lo más el tope de una
   * operación masiva: "seleccionar los N de este filtro" sin cargar todas las páginas.
   */
  ids(params: Omit<EmployeeListParams, 'page' | 'size'> = {}, signal?: AbortSignal): Promise<EmployeeIdList> {
    return apiRequest<EmployeeIdList>('/employees/ids', { query: { ...params }, signal, validate: hasKeys<EmployeeIdList>('ids', 'total', 'limit') });
  },

  get(id: number, signal?: AbortSignal): Promise<Employee> {
    return apiRequest<Employee>(`/employees/${id}`, { signal, validate: isEmployee });
  },

  /** Alta de empleado + usuario EMPLOYEE + QR automático (el rostro lo registra el empleado). */
  create(payload: EmployeeCreatePayload): Promise<Employee> {
    const body = { ...payload };
    (['first_name', 'last_name', 'employee_number', 'email'] as const).forEach((k) => (body[k] = body[k].trim()));
    return apiRequest<Employee>('/employees', { method: 'POST', body, validate: isEmployee });
  },

  update(id: number, payload: EmployeeUpdatePayload): Promise<Employee> {
    return apiRequest<Employee>(`/employees/${id}`, { method: 'PUT', body: payload, validate: isEmployee });
  },

  setStatus(id: number, active: boolean): Promise<Employee> {
    return apiRequest<Employee>(`/employees/${id}/status`, { method: 'PATCH', body: { active }, validate: isEmployee });
  },

  /** Lo manda a «Eliminados» (se restaura durante 1 año); su rostro y sus fotos se borran para siempre. */
  async remove(id: number): Promise<void> {
    await apiRequest<null | undefined>(`/employees/${id}`, { method: 'DELETE', validate: isNothing });
  },

  /** Lo regresa de «Eliminados» (deberá registrar su rostro de nuevo). */
  restore(id: number): Promise<Restored<Employee>> {
    return restoreRecord(`/employees/${id}`, isEmployee);
  },

  /** Solicita al empleado verificar de nuevo su identidad (motivo opcional, visible para él). */
  resetFace(id: number, reason?: string): Promise<Employee> {
    return apiRequest<Employee>(`/employees/${id}/face/reset`, {
      method: 'POST',
      body: reason ? { reason } : undefined,
      validate: isEmployee,
    });
  },

  /** Solicita a TODOS los empleados con registro facial verificar de nuevo su identidad. */
  resetAllFaces(reason?: string): Promise<IdentityReverifySummary> {
    return apiRequest<IdentityReverifySummary>('/employees/face/reset', {
      method: 'POST',
      body: reason ? { reason } : undefined,
      validate: hasKeys<IdentityReverifySummary>('employees'),
    });
  },

  /** Actividad del QR dinámico (si tiene uno vigente, cuándo lo generó y lo usó). */
  qrSummary(id: number, signal?: AbortSignal): Promise<EmployeeQrSummary> {
    return apiRequest<EmployeeQrSummary>(`/employees/${id}/qr`, { signal, validate: isQrSummary });
  },

  /** Invalida el QR vigente: el teléfono del empleado muestra otro. */
  revokeQr(id: number): Promise<EmployeeQrSummary> {
    return apiRequest<EmployeeQrSummary>(`/employees/${id}/qr`, { method: 'DELETE', validate: isQrSummary });
  },

  /** Bitácora de verificaciones del empleado, paginada (la más reciente primero). */
  history(id: number, query: PageQuery, signal?: AbortSignal): Promise<VerificationLogList> {
    return apiRequest<VerificationLogList>(`/employees/${id}/verifications`, {
      query: { ...query },
      signal,
      validate: isPage(hasKeys('id', 'method', 'success')),
    });
  },
};
