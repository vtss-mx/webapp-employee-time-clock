import type {
  Employee,
  EmployeeCreatePayload,
  EmployeeList,
  EmployeeListParams,
  EmployeeQr,
  EmployeeUpdatePayload,
  VerificationLog,
} from '../types';
import { hasKeys, isArrayOf, isNothing, isPage } from '../utils/guards';
import { apiRequest } from './apiClient';

const isEmployee = hasKeys<Employee>('id', 'employee_number', 'first_name', 'last_name');
const isQr = hasKeys<EmployeeQr>('image_base64', 'employee_number');
const isHistory = isArrayOf<VerificationLog[]>(hasKeys('id', 'method', 'success'));

export const employeeService = {
  list(params: EmployeeListParams = {}, signal?: AbortSignal): Promise<EmployeeList> {
    return apiRequest<EmployeeList>('/employees', { query: { ...params }, signal, validate: isPage(isEmployee) });
  },

  get(id: number): Promise<Employee> {
    return apiRequest<Employee>(`/employees/${id}`, { validate: isEmployee });
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

  async remove(id: number): Promise<void> {
    await apiRequest<null | undefined>(`/employees/${id}`, { method: 'DELETE', validate: isNothing });
  },

  /** Elimina los datos faciales: el empleado deberá registrarse de nuevo. */
  /** Solicita al empleado verificar de nuevo su identidad (motivo opcional, visible para él). */
  resetFace(id: number, reason?: string): Promise<Employee> {
    return apiRequest<Employee>(`/employees/${id}/face/reset`, {
      method: 'POST',
      body: reason ? { reason } : undefined,
      validate: isEmployee,
    });
  },

  getQr(id: number): Promise<EmployeeQr> {
    return apiRequest<EmployeeQr>(`/employees/${id}/qr`, { validate: isQr });
  },

  regenerateQr(id: number): Promise<EmployeeQr> {
    return apiRequest<EmployeeQr>(`/employees/${id}/qr/regenerate`, { method: 'POST', validate: isQr });
  },

  history(id: number, limit = 10): Promise<VerificationLog[]> {
    return apiRequest<VerificationLog[]>(`/employees/${id}/verifications`, { query: { limit }, validate: isHistory });
  },
};
