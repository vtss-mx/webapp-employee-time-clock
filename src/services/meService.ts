import type { EmployeeQr, UserPreferences } from '../types';
import { hasKeys } from '../utils/guards';
import { apiRequest } from './apiClient';

const isQr = hasKeys<EmployeeQr>('image_base64', 'employee_number', 'file_name');
const isPreferences = hasKeys<UserPreferences>('sidebar_collapsed');

/** Recursos del usuario autenticado. */
export const meService = {
  /** EMPLOYEE con identidad aprobada: su código QR de identidad. */
  getMyQr(signal?: AbortSignal): Promise<EmployeeQr> {
    return apiRequest<EmployeeQr>('/users/me/qr', { signal, validate: isQr });
  },

  /** Guarda preferencias de la interfaz en la BD (cambio parcial). */
  updatePreferences(changes: Partial<UserPreferences>): Promise<UserPreferences> {
    return apiRequest<UserPreferences>('/users/me/preferences', { method: 'PATCH', body: changes, validate: isPreferences });
  },
};
