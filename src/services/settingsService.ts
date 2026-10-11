import type { VerificationPolicy } from '../types';
import { DEFAULT_ENROLLMENT_STEPS } from '../utils/enrollmentStepRules';
import { hasKeys } from '../utils/guards';
import { apiRequest } from './apiClient';

export const isPolicy = hasKeys<VerificationPolicy>(
  'block_glasses',
  'block_headwear',
  'block_mask',
  'liveness_challenge',
  'anti_spoofing',
  'qr_enabled',
  'voice_guidance_enabled',
);

/**
 * Normaliza la política para los consumidores: `blocked_cameras` y `enrollment_steps` SIEMPRE son arreglos. Así un
 * despliegue gradual (un backend anterior que aún no manda el campo) no rompe a quien recorre la lista (`LiveFaceFlow`
 * y la telemetría de la cámara; el indicador de pasos de «En validación»): sin lista de cámaras no se bloquea ninguna
 * en pantalla (el backend la exige igual) y sin pasos se asume el flujo por omisión del backend.
 */
const normalized = (policy: VerificationPolicy): VerificationPolicy => ({
  ...policy,
  blocked_cameras: Array.isArray(policy.blocked_cameras) ? policy.blocked_cameras : [],
  enrollment_steps: Array.isArray(policy.enrollment_steps) ? policy.enrollment_steps : [...DEFAULT_ENROLLMENT_STEPS],
});

/**
 * Política de verificación vigente de la empresa de la sesión (solo lectura: la configura el ADMIN de
 * la plataforma desde su consola, `adminService.updatePolicy`).
 */
export const settingsService = {
  getVerificationPolicy(signal?: AbortSignal): Promise<VerificationPolicy> {
    return apiRequest<VerificationPolicy>('/settings/verification', { signal, validate: isPolicy }).then(normalized);
  },
};
