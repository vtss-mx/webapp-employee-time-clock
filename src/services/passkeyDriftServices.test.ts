import { describe, expect, it } from 'vitest';
import { apiOk, mockFetch } from '../test/http';
import { authService } from './authService';
import { driftService } from './driftService';
import { passkeyService } from './passkeyService';

const passkey = { id: 1, name: 'Mi teléfono', created_at: '2026-10-01T10:00:00Z', last_used_at: null, transports: ['internal'], backed_up: true };
const options = { token: 'sellado-123', options: { challenge: 'cmV0bw' } };
const credential = { id: 'Y3JlZA', rawId: 'Y3JlZA', type: 'public-key' as const, response: { clientDataJSON: 'AQ', attestationObject: 'Ag', transports: [] }, authenticatorAttachment: null, clientExtensionResults: {} };
const assertion = { ...credential, response: { clientDataJSON: 'AQ', authenticatorData: 'Ag', signature: 'Aw', userHandle: null } };
const token = { access_token: 'tok', token_type: 'Bearer', expires_in: 3600, expires_at: 'x', session_id: 'sid', user: { id: 1, email: 'a@e.com', role: 'COMPANY' } };
const summary = { window_days: 7, psi_alert: 0.2, tail_drop_alert: 0.15, min_samples: 200, quick_review_seconds: 30, quick_approval_ratio: 0.8, weeks: [], latest_week: null, alerts: 0, insufficient: 0, companies_alerted: 0, platforms: [], versions: [], computed_at: null };
const row = { id: 1, week_start: '2026-09-28', signal: 'LIVENESS_YAW', platform: 'IOS_SAFARI', status: 'OK', samples: 10 };
const company = { id: 1, week_start: '2026-09-28', company_id: 1, company_name: 'Acme', status: 'OK', reviews: 3 };

/** Llaves de acceso y deriva: cada servicio llama al endpoint y método correctos y valida la forma de la respuesta. */
describe('servicios de llaves de acceso y deriva', () => {
  it.each([
    ['passkeys.registrationOptions', () => passkeyService.registrationOptions(), options, 'POST', '/api/auth/passkeys/options'],
    ['passkeys.register', () => passkeyService.register({ token: 'sellado-123', name: 'Mi teléfono', credential }), passkey, 'POST', '/api/auth/passkeys'],
    ['passkeys.list', () => passkeyService.list({ page: 1, size: 10 }), { items: [passkey], total: 1, page: 1, size: 10 }, 'GET', '/api/auth/passkeys?page=1&size=10'],
    ['passkeys.rename', () => passkeyService.rename(1, 'Laptop'), passkey, 'PATCH', '/api/auth/passkeys/1'],
    ['passkeys.revoke', () => passkeyService.revoke(1), null, 'DELETE', '/api/auth/passkeys/1'],
    ['passkeys.loginOptions', () => passkeyService.loginOptions(), options, 'POST', '/api/auth/login/passkey/options'],
    ['auth.loginWithPasskey', () => authService.loginWithPasskey({ token: 'sellado-123', credential: assertion, remember: true }), token, 'POST', '/api/auth/login/passkey'],
    ['drift.summary', () => driftService.summary(), summary, 'GET', '/api/admin/drift/summary'],
    ['drift.signals', () => driftService.signals({ page: 1, size: 10, week: '2026-09-28', platform: 'DESKTOP', status: 'ALERT' }), { items: [row], total: 1, page: 1, size: 10 }, 'GET', '/api/admin/drift?page=1&size=10&week=2026-09-28&platform=DESKTOP&status=ALERT'],
    ['drift.companies', () => driftService.companies({ page: 1, size: 10, search: 'ac' }), { items: [company], total: 1, page: 1, size: 10 }, 'GET', '/api/admin/drift/companies?page=1&size=10&search=ac'],
  ])('%s', async (_name, call, data, method, url) => {
    const { calls } = mockFetch(apiOk(data));
    await expect(call()).resolves.toEqual(data === null ? undefined : data);
    expect(calls[0].url).toBe(url);
    expect(calls[0].init.method ?? 'GET').toBe(method);
  });

  it('calcular ahora devuelve el resumen nuevo con el mensaje del servidor', async () => {
    const { calls } = mockFetch(apiOk(summary, { message: 'Deriva calculada (33 filas)' }));
    await expect(driftService.compute()).resolves.toEqual({ summary, message: 'Deriva calculada (33 filas)' });
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].url).toBe('/api/admin/drift/compute');
  });

  it('una respuesta con otra forma se rechaza', async () => {
    mockFetch(apiOk({ token: 'x' }));
    await expect(passkeyService.loginOptions()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    mockFetch(apiOk({ items: [{ id: 1 }], total: 1, page: 1, size: 10 }));
    await expect(passkeyService.list({ page: 1, size: 10 })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    mockFetch(apiOk({ weeks: [] }));
    await expect(driftService.summary()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
