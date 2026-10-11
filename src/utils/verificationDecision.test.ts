import { describe, expect, it } from 'vitest';
import type { VerificationResult } from '../types';
import { canRetryVerification, isApprovedVerification } from './verificationDecision';

const result = (status?: string | null, review = false, verified = true): VerificationResult => ({ verified, review, verification_status: status, method: 'FACE', message: '' });

describe('solo una identidad aprobada permite éxito', () => {
  it.each(['APPROVED', 'REJECTED', 'BLOCKED', 'MANUAL_REVIEW', 'RETRY_REQUIRED', 'INCONCLUSIVE', 'TECHNICAL_ERROR', 'EXPIRED', 'FUTURE_STATUS'])('verdictos incoherentes o nuevos no aprueban %s', (status) => {
    expect(isApprovedVerification(result(status))).toBe(status === 'APPROVED');
    expect(isApprovedVerification(result(status, true))).toBe(false);
    expect(isApprovedVerification(result(status, false, false))).toBe(false);
  });

  it('un contrato anterior sin estado explícito nunca autoriza', () => {
    expect(isApprovedVerification(null)).toBe(false);
    expect(isApprovedVerification(result())).toBe(false);
    expect(isApprovedVerification(result(undefined, true))).toBe(false);
    expect(isApprovedVerification(result(null))).toBe(false);
  });

  it.each(['APPROVED', 'REJECTED', 'BLOCKED', 'MANUAL_REVIEW', 'RETRY_REQUIRED', 'INCONCLUSIVE', 'TECHNICAL_ERROR', 'EXPIRED', 'FUTURE_STATUS', null, undefined])('ofrece un nuevo reto solo cuando corresponde al estado %s', (status) => {
    expect(canRetryVerification(result(status))).toBe(status === undefined || status === 'REJECTED' || status === 'RETRY_REQUIRED' || status === 'TECHNICAL_ERROR' || status === 'EXPIRED');
  });

  it('sin respuesta permite iniciar un intento nuevo', () => expect(canRetryVerification(null)).toBe(true));
});
