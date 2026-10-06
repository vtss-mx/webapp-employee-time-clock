import type { Department, DepartmentList, DepartmentPayload, PageQuery, Restored } from '../types';
import { hasKeys, isNothing, isPage } from '../utils/guards';
import { apiRequest } from './apiClient';
import { restoreRecord } from './http/restore';

const isDepartment = hasKeys<Department>('id', 'name', 'employee_count', 'managers');

/** Departamentos de la empresa (rol COMPANY): responsables y empleados asignados. */
export const departmentService = {
  /** `deleted`: solo los de «Eliminados». */
  list(query: PageQuery & { search?: string; deleted?: boolean }, signal?: AbortSignal): Promise<DepartmentList> {
    return apiRequest<DepartmentList>('/departments', { query: { ...query }, signal, validate: isPage(isDepartment) });
  },

  get(id: number, signal?: AbortSignal): Promise<Department> {
    return apiRequest<Department>(`/departments/${id}`, { signal, validate: isDepartment });
  },

  create(payload: DepartmentPayload): Promise<Department> {
    return apiRequest<Department>('/departments', { method: 'POST', body: payload, validate: isDepartment });
  },

  update(id: number, payload: DepartmentPayload): Promise<Department> {
    return apiRequest<Department>(`/departments/${id}`, { method: 'PUT', body: payload, validate: isDepartment });
  },

  /** Solo sin empleados asignados (si no, 409 DEPARTMENT_HAS_EMPLOYEES); va a «Eliminados». */
  async remove(id: number): Promise<void> {
    await apiRequest<null | undefined>(`/departments/${id}`, { method: 'DELETE', validate: isNothing });
  },

  restore(id: number): Promise<Restored<Department>> {
    return restoreRecord(`/departments/${id}`, isDepartment);
  },

  /** Asigna el empleado (si estaba en otro departamento, lo cambia a este). Idempotente. */
  assign(id: number, employeeId: number): Promise<Department> {
    return apiRequest<Department>(`/departments/${id}/employees`, { method: 'POST', body: { employee_id: employeeId }, validate: isDepartment });
  },

  unassign(id: number, employeeId: number): Promise<Department> {
    return apiRequest<Department>(`/departments/${id}/employees/${employeeId}`, { method: 'DELETE', validate: isDepartment });
  },

  addManager(id: number, employeeId: number): Promise<Department> {
    return apiRequest<Department>(`/departments/${id}/managers`, { method: 'POST', body: { employee_id: employeeId }, validate: isDepartment });
  },

  removeManager(id: number, employeeId: number): Promise<Department> {
    return apiRequest<Department>(`/departments/${id}/managers/${employeeId}`, { method: 'DELETE', validate: isDepartment });
  },
};
