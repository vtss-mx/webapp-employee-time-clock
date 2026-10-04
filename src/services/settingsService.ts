import type { VerificationPolicy } from '../types';
import { hasKeys } from '../utils/guards';
import { apiRequest } from './apiClient';

export const isPolicy = hasKeys<VerificationPolicy>(
  'block_glasses',
  'block_headwear',
  'block_mask',
  'liveness_challenge',
  'anti_spoofing',
  'qr_enabled',
);

/**
 * Política de verificación vigente de la empresa de la sesión (solo lectura: la configura el ADMIN de
 * la plataforma desde su consola, `adminService.updatePolicy`).
 */
export const settingsService = {
  getVerificationPolicy(signal?: AbortSignal): Promise<VerificationPolicy> {
    return apiRequest<VerificationPolicy>('/settings/verification', { signal, validate: isPolicy });
  },
};
