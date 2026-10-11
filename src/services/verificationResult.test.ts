import { describe, expect, it } from 'vitest';
import { isVerificationResult } from './verificationService';

const legacy = { verified: true, method: 'FACE', message: 'Identificación' };
describe('contrato de resultado compartido de rostro y QR', () => {
  it.each([legacy, { ...legacy, review: null, verification_status: null }, { ...legacy, review: false, verification_status: 'APPROVED' }, { ...legacy, verified: false, review: true, verification_status: 'FUTURE_STATUS' }])('tolera despliegue gradual y códigos nuevos %j', (value) => {
    expect(isVerificationResult(value)).toBe(true);
  });
  it.each([null, {}, { ...legacy, verified: 'true' }, { ...legacy, method: 42 }, { ...legacy, message: [] }, { ...legacy, review: 'false' }, { ...legacy, verification_status: {} }])('rechaza tipos inválidos %j', (value) => {
    expect(isVerificationResult(value)).toBe(false);
  });
});
