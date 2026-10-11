import { describe, expect, it } from 'vitest';
import { biometricConsent, consentList, consentState, SHA } from '../test/consents';
import { apiFail, apiOk, mockFetch } from '../test/http';
import type { ApiError } from './apiClient';
import { consentService } from './consentService';

const header = (init: RequestInit) => new Headers(init.headers).get('Accept-Language');

describe('consentService (consentimiento biométrico del titular)', () => {
  it('pide los consentimientos con su texto, en el idioma activo', async () => {
    const { calls } = mockFetch(apiOk(consentList()));
    expect(await consentService.list()).toEqual(consentList());
    expect([calls[0].url, calls[0].init.method ?? 'GET', header(calls[0].init)]).toEqual(['/api/me/consents', 'GET', 'es-MX']);
  });

  it('otorga devolviendo SOLO el tipo, la versión y la huella que mostró el servidor', async () => {
    const { calls } = mockFetch(apiOk(consentState(), { status: 201, code: 'CONSENT_GRANTED', message: 'Consentimiento otorgado' }));
    // Se le pasa el consentimiento completo: solo viajan el tipo, la versión y la huella (el texto no se devuelve).
    expect(await consentService.grant(biometricConsent)).toEqual(consentState());
    expect([calls[0].url, calls[0].init.method]).toEqual(['/api/me/consents', 'POST']);
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ type: 'BIOMETRIC_DATA', version: '1', text_sha256: SHA });
  });

  it('revoca con el código en la ruta, escapado', async () => {
    const { calls } = mockFetch(apiOk(consentState({ granted: false, revoked_at: '2026-10-07T09:00:00Z' })));
    expect((await consentService.revoke('BIOMETRIC_DATA')).granted).toBe(false);
    await consentService.revoke('A/B DATA');
    expect(calls.map((call) => [call.url, call.init.method])).toEqual([
      ['/api/me/consents/BIOMETRIC_DATA', 'DELETE'],
      ['/api/me/consents/A%2FB%20DATA', 'DELETE'],
    ]);
  });

  it('una respuesta con otra forma se rechaza: nunca se dibuja un consentimiento a medias', async () => {
    const rejected = async (data: unknown) => {
      mockFetch(apiOk(data));
      return (await consentService.list().catch((cause: unknown) => cause)) as ApiError;
    };
    expect((await rejected(null)).code).toBe('INVALID_RESPONSE');
    expect((await rejected({ items: [{ ...biometricConsent, paragraphs: 'uno' }] })).code).toBe('INVALID_RESPONSE');
    expect((await rejected({ items: [{ ...biometricConsent, paragraphs: [1, 2] }] })).code).toBe('INVALID_RESPONSE');
    const { type, ...withoutType } = biometricConsent;
    expect(type).toBe('BIOMETRIC_DATA');
    expect((await rejected({ items: [withoutType] })).code).toBe('INVALID_RESPONSE');
    mockFetch(apiOk({ id: 1 }));
    expect(((await consentService.grant(biometricConsent).catch((cause: unknown) => cause)) as ApiError).code).toBe('INVALID_RESPONSE');
  });

  it('cada falla del servidor llega con su código y su estado (sin reintentar una escritura)', async () => {
    const cases: Array<[number, string]> = [
      [401, 'UNAUTHORIZED'],
      [403, 'FORBIDDEN'],
      [404, 'EMPLOYEE_NOT_FOUND'],
      [409, 'COMPANY_SELECTION_REQUIRED'],
      [409, 'CONSENT_ALREADY_GRANTED'],
      [422, 'CONSENT_TEXT_MISMATCH'],
      [500, 'INTERNAL_ERROR'],
      [503, 'DATABASE_UNAVAILABLE'],
    ];
    for (const [status, code] of cases) {
      const { calls } = mockFetch(apiFail(status, code));
      const error = (await consentService.grant(biometricConsent).catch((cause: unknown) => cause)) as ApiError;
      expect([error.status, error.code]).toEqual([status, code]);
      expect(calls).toHaveLength(1);
    }
  });

  it('un 429 trae su espera sugerida y tampoco se reintenta solo', async () => {
    const { calls } = mockFetch(apiFail(429, 'RATE_LIMITED', 'Demasiadas peticiones', { 'Retry-After': '30' }));
    const error = (await consentService.grant(biometricConsent).catch((cause: unknown) => cause)) as ApiError;
    expect([error.status, error.retryAfterMs, calls.length]).toEqual([429, 30_000, 1]);
  });

  it('sin red el error llega a la pantalla, y la lectura viaja con su señal para cancelarse', async () => {
    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    const error = (await consentService.grant(biometricConsent).catch((cause: unknown) => cause)) as ApiError;
    expect(error.status).toBe(0);
    const { calls } = mockFetch(apiOk(consentList()));
    await consentService.list(new AbortController().signal);
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
  });
});
