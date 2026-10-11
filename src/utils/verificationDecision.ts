import type { VerificationResult } from '../types';

/** Un estado presente exige aprobación explícita; una revisión antigua tampoco permite acceso. */
export function isApprovedVerification(result: VerificationResult | null): boolean {
  return Boolean(result?.verified && !result.review && result.verification_status === 'APPROVED');
}

/** Volver a intentar abre un reto nuevo; una revisión o un bloqueo requieren su propia resolución. */
export function canRetryVerification(result: VerificationResult | null): boolean {
  const status = result?.verification_status;
  return status === undefined || status === 'REJECTED' || status === 'RETRY_REQUIRED' || status === 'TECHNICAL_ERROR' || status === 'EXPIRED';
}
