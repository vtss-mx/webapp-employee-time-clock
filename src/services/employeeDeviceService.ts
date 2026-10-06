import type { DeviceStatus, EmployeeDevice, EmployeeDeviceList, PageQuery } from '../types';
import { hasKeys, isPage } from '../utils/guards';
import { apiRequest } from './apiClient';

const isEmployeeDevice = hasKeys<EmployeeDevice>('id', 'name', 'status', 'first_seen_at', 'uses');

/** Lo que la empresa decide de un dispositivo: aprobarlo o revocarlo. */
export type EmployeeDeviceDecision = Extract<DeviceStatus, 'APPROVED' | 'REVOKED'>;

/**
 * Dispositivos de los empleados (antifraude 1b, decisión D2): la empresa los ve en la ficha del empleado y los aprueba
 * o revoca; el empleado ve los suyos en Mi perfil. El backend guarda solo el hash de la llave de cada navegador.
 */
export const employeeDeviceService = {
  /** COMPANY: los dispositivos de un empleado, el más reciente primero. */
  list(employeeId: number, query: PageQuery, signal?: AbortSignal): Promise<EmployeeDeviceList> {
    return apiRequest<EmployeeDeviceList>(`/employees/${employeeId}/devices`, { query: { ...query }, signal, validate: isPage(isEmployeeDevice) });
  },

  /** COMPANY: aprobar (sus registros dejan de quedar en revisión por el dispositivo) o revocar (vuelve a ser desconocido). */
  setStatus(employeeId: number, deviceId: number, status: EmployeeDeviceDecision): Promise<EmployeeDevice> {
    return apiRequest<EmployeeDevice>(`/employees/${employeeId}/devices/${deviceId}/status`, { method: 'PATCH', body: { status }, validate: isEmployeeDevice });
  },

  /** EMPLOYEE: los míos (Mi perfil, solo lectura). */
  mine(query: PageQuery, signal?: AbortSignal): Promise<EmployeeDeviceList> {
    return apiRequest<EmployeeDeviceList>('/users/me/devices', { query: { ...query }, signal, validate: isPage(isEmployeeDevice) });
  },
};
