import { describe, expect, it } from 'vitest';
import { ApiError } from '../services/apiClient';
import type { ConsentAsk } from '../types/consents';
import { BIOMETRIC_CONSENT_REQUIRED, isConsentOutdated, isConsentRequired, pendingConsents } from './consents';

const fail = (statusCode: number, code: string) => new ApiError({ statusCode, code, message: 'x' });

const ask = (changes: Partial<ConsentAsk> = {}): ConsentAsk => ({
  type: 'BIOMETRIC_DATA',
  granted: false,
  granted_at: null,
  revoked_at: null,
  text_version: null,
  locale: null,
  required: true,
  version: '1',
  text_sha256: 'a'.repeat(64),
  title: 'Consentimiento',
  paragraphs: ['uno', 'dos', 'tres', 'cuatro', 'cinco'],
  ...changes,
});

describe('reglas del consentimiento biométrico', () => {
  it('reconoce el 403 que pide el consentimiento, y solo ese', () => {
    expect(isConsentRequired(fail(403, BIOMETRIC_CONSENT_REQUIRED))).toBe(true);
    // Mismo código con otro estado, u otro 403 del servidor: no es esto.
    expect(isConsentRequired(fail(409, BIOMETRIC_CONSENT_REQUIRED))).toBe(false);
    expect(isConsentRequired(fail(403, 'FACE_NOT_APPROVED'))).toBe(false);
    expect(isConsentRequired(fail(403, 'FORBIDDEN'))).toBe(false);
    expect(isConsentRequired(new Error('sin red'))).toBe(false);
  });

  it('reconoce los códigos que dejan viejo lo que se muestra', () => {
    expect(isConsentOutdated(fail(422, 'CONSENT_TEXT_MISMATCH'))).toBe(true);
    expect(isConsentOutdated(fail(409, 'CONSENT_ALREADY_GRANTED'))).toBe(true);
    expect(isConsentOutdated(fail(409, 'CONSENT_NOT_GRANTED'))).toBe(true);
    expect(isConsentOutdated(fail(422, 'VALIDATION_ERROR'))).toBe(false);
    expect(isConsentOutdated('texto')).toBe(false);
  });

  it('los pendientes son los que la empresa pide y no están otorgados', () => {
    const required = ask();
    const granted = ask({ type: 'OTHER', granted: true, granted_at: '2026-10-01T10:00:00Z' });
    const optional = ask({ type: 'OPTIONAL', required: false });
    expect(pendingConsents([required, granted, optional])).toEqual([required]);
    expect(pendingConsents([])).toEqual([]);
  });
});
