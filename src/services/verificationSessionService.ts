import type { VerificationSession } from '../types/verificationSession';
import { isRecord } from '../utils/guards';
import { apiRequest } from './apiClient';

const EXECUTION = new Set(['READY', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'EXPIRED']);
const nullableString = (value: unknown): value is string | null => value === null || typeof value === 'string';
const positiveAttempt = (value: unknown) => value === null || (Number.isSafeInteger(value) && Number(value) > 0);

/** La decisión es un dato del servidor; ningún estado técnico se convierte en aprobación. */
export function isVerificationSession(value: unknown): value is VerificationSession {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && value.id.length === 64 &&
    typeof value.execution_status === 'string' && EXECUTION.has(value.execution_status) &&
    nullableString(value.decision_status) &&
    typeof value.created_at === 'string' && Number.isFinite(Date.parse(value.created_at)) &&
    typeof value.expires_at === 'string' && Number.isFinite(Date.parse(value.expires_at)) &&
    Date.parse(value.expires_at) > Date.parse(value.created_at) &&
    typeof value.flow_version === 'string' && value.flow_version.length > 0 &&
    typeof value.policy_version === 'string' && value.policy_version.length === 64 &&
    positiveAttempt(value.attempt_id) && nullableString(value.device_nonce) &&
    (value.execution_status === 'COMPLETED' || (value.decision_status === null && value.attempt_id === null));
}

export const verificationSessionService = {
  read(id: string, signal?: AbortSignal): Promise<VerificationSession> {
    return apiRequest<VerificationSession>(`/verification/sessions/${encodeURIComponent(id)}`, {
      signal, validate: (value): value is VerificationSession => isVerificationSession(value) && value.id === id,
    });
  },
  cancel(id: string): Promise<VerificationSession> {
    return apiRequest<VerificationSession>(`/verification/sessions/${encodeURIComponent(id)}/cancel`, {
      method: 'POST', validate: (value): value is VerificationSession => isVerificationSession(value) && value.id === id &&
        value.execution_status !== 'READY' && value.execution_status !== 'PROCESSING',
    });
  },
};
