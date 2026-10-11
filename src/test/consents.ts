/**
 * Datos de prueba del consentimiento biométrico, como los envía el backend (migración 0094): el estado plano más el
 * texto vigente (título y CINCO párrafos) con su versión y su huella.
 */
import type { ConsentAsk, ConsentAskList, ConsentState } from '../types/consents';

export const SHA = 'a'.repeat(64);

/** El consentimiento que pide la empresa y la persona todavía no otorga. */
export const biometricConsent: ConsentAsk = {
  type: 'BIOMETRIC_DATA',
  granted: false,
  granted_at: null,
  revoked_at: null,
  text_version: null,
  locale: null,
  required: true,
  version: '1',
  text_sha256: SHA,
  title: 'Consentimiento para tratar tus datos biométricos',
  paragraphs: [
    'Qué se captura: la imagen de tu rostro y, si tu empresa lo pide, un video con tu voz.',
    'Para qué: comprobar que eres tú al checar tu entrada y tu salida.',
    'Cuánto se conserva: mientras trabajes en tu empresa.',
    'Puedes revocar este consentimiento cuando quieras desde Mi perfil.',
    'Si lo revocas, tus datos biométricos se borran de inmediato y para siempre.',
  ],
};

/** Ya otorgado (lo que ve quien puede revocarlo). */
export const grantedConsent: ConsentAsk = {
  ...biometricConsent,
  granted: true,
  granted_at: '2026-10-01T10:00:00Z',
  text_version: '1',
  locale: 'es-MX',
};

/** Otorgado y revocado: vuelve a pedirse. */
export const revokedConsent: ConsentAsk = {
  ...biometricConsent,
  granted_at: '2026-09-01T10:00:00Z',
  revoked_at: '2026-10-02T11:00:00Z',
  text_version: '1',
  locale: 'es-MX',
};

export const consentList = (items: ConsentAsk[] = [biometricConsent]): ConsentAskList => ({ items });

export const consentState = (changes: Partial<ConsentState> = {}): ConsentState => ({
  type: 'BIOMETRIC_DATA',
  granted: true,
  granted_at: '2026-10-06T12:00:00Z',
  revoked_at: null,
  text_version: '1',
  locale: 'es-MX',
  ...changes,
});
