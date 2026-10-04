import type { DynamicQr, QrStatus, UserPreferences } from '../types';
import { hasKeys } from '../utils/guards';
import { apiRequest } from './apiClient';

const isQr = hasKeys<DynamicQr>('id', 'content', 'expires_at', 'lifetime_seconds');
const isQrStatus = hasKeys<QrStatus>('id', 'status');
const isPreferences = hasKeys<UserPreferences>('sidebar_collapsed');

/** Recursos del usuario autenticado. */
export const meService = {
  /** EMPLOYEE con identidad aprobada: un QR dinámico nuevo (reemplaza al anterior; sirve una vez). */
  issueQr(signal?: AbortSignal): Promise<DynamicQr> {
    return apiRequest<DynamicQr>('/users/me/qr', { method: 'POST', signal, validate: isQr });
  },

  /** Estado del QR mostrado: en cuanto un validador lo usa, la pantalla muestra otro. */
  qrStatus(id: number, signal?: AbortSignal): Promise<QrStatus> {
    return apiRequest<QrStatus>(`/users/me/qr/${id}`, { signal, validate: isQrStatus });
  },

  /** Guarda preferencias de la interfaz en la BD (cambio parcial). */
  updatePreferences(changes: Partial<UserPreferences>): Promise<UserPreferences> {
    return apiRequest<UserPreferences>('/users/me/preferences', { method: 'PATCH', body: changes, validate: isPreferences });
  },
};
