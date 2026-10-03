import type {
  Employee,
  EnrollmentSubmitResponse,
  EmployeeCreatePayload,
  EmployeeList,
  EmployeeListParams,
  EmployeeQr,
  EmployeeUpdatePayload,
  PageQuery,
  VerificationLogList,
  VerificationResult,
} from '../types';
import { hasKeys, isNothing, isPage } from '../utils/guards';
import { apiRequest } from './apiClient';
import { postFaceCaptures, type FaceCaptures } from './http/faceUpload';
import { isVerificationResult } from './verificationService';

const isEmployee = hasKeys<Employee>('id', 'employee_number', 'first_name', 'last_name');
const isQr = hasKeys<EmployeeQr>('image_base64', 'employee_number');

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

  /** Bitácora de verificaciones del empleado, paginada (la más reciente primero). */
  history(id: number, query: PageQuery, signal?: AbortSignal): Promise<VerificationLogList> {
    return apiRequest<VerificationLogList>(`/employees/${id}/verifications`, {
      query: { ...query },
      signal,
      validate: isPage(hasKeys('id', 'method', 'success')),
    });
  },
};
