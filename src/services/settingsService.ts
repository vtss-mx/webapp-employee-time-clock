import type { VerificationPolicy, VerificationPolicyUpdate } from '../types';
import { hasKeys } from '../utils/guards';
import { apiRequest } from './apiClient';

const isPolicy = hasKeys<VerificationPolicy>(
  'block_glasses',
  'block_headwear',
  'block_mask',
  'liveness_challenge',
  'anti_spoofing',
  'qr_enabled',
);

export const settingsService = {
  getVerificationPolicy(signal?: AbortSignal): Promise<VerificationPolicy> {
    return apiRequest<VerificationPolicy>('/settings/verification', { signal, validate: isPolicy });
  },

  /** COMPANY: actualización parcial (solo los campos enviados). */
  updateVerificationPolicy(changes: VerificationPolicyUpdate): Promise<VerificationPolicy> {
    return apiRequest<VerificationPolicy>('/settings/verification', { method: 'PUT', body: changes, validate: isPolicy });
  },
};
