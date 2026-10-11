import { describe, expect, it } from 'vitest';
import { apiFail, apiOk, mockFetch } from '../test/http';
import { isVerificationSession, verificationSessionService } from './verificationSessionService';

const id = 's'.repeat(64);
export const SESSION = {
  id, execution_status: 'READY', decision_status: null,
  created_at: '2026-10-10T22:00:00Z', expires_at: '2026-10-10T22:01:00Z',
  flow_version: 'test-protocol', policy_version: 'p'.repeat(64), attempt_id: null, device_nonce: null,
};

describe('verificationSessionService', () => {
  it('consulta y cancela por su ruta con metadata validada', async () => {
    const { calls } = mockFetch(apiOk(SESSION), apiOk({ ...SESSION, execution_status: 'CANCELLED' }));
    await expect(verificationSessionService.read(id)).resolves.toEqual(SESSION);
    await expect(verificationSessionService.cancel(id)).resolves.toMatchObject({ execution_status: 'CANCELLED' });
    expect(calls.map((call) => [call.url, call.init.method ?? 'GET'])).toEqual([
      [`/api/verification/sessions/${id}`, 'GET'], [`/api/verification/sessions/${id}/cancel`, 'POST'],
    ]);
  });

  it('escapa el identificador y transmite la señal de cancelación de lectura', async () => {
    const escaped = '/'.repeat(64);
    const controller = new AbortController();
    const { calls } = mockFetch(apiOk({ ...SESSION, id: escaped }));
    await verificationSessionService.read(escaped, controller.signal);
    expect(calls[0].url).toContain(encodeURIComponent(escaped));
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
  });

  it('una decisión completada sigue siendo metadata sin verified ni permiso implícito', async () => {
    const completed = { ...SESSION, execution_status: 'COMPLETED', decision_status: 'APPROVED', attempt_id: 7, device_nonce: 'nonce' };
    expect(isVerificationSession(completed)).toBe(true);
    expect(isVerificationSession({ ...completed, decision_status: null, attempt_id: null })).toBe(true);
    mockFetch(apiOk(completed));
    const value = await verificationSessionService.read(id);
    expect(value).toEqual(completed);
    expect(value).not.toHaveProperty('verified');
  });

  it.each([
    null, [], {}, { ...SESSION, id: 7 }, { ...SESSION, id: 'short' },
    ...[
      ['execution_status', 7], ['execution_status', 'APPROVED'], ['decision_status', 7],
      ['created_at', 7], ['created_at', 'invalid'], ['expires_at', 7], ['expires_at', 'invalid'],
      ['expires_at', SESSION.created_at], ['flow_version', 7], ['flow_version', ''],
      ['policy_version', 7], ['policy_version', 'short'], ['attempt_id', 0], ['attempt_id', 0.5],
      ['attempt_id', Number.MAX_SAFE_INTEGER + 1], ['device_nonce', 7], ['decision_status', 'APPROVED'], ['attempt_id', 1],
    ].map(([key, value]) => ({ ...SESSION, [key as string]: value })),
  ])('rechaza metadata mal formada %j', (value) => {
    expect(isVerificationSession(value)).toBe(false);
  });

  it('rechaza un éxito de otra sesión y metadata no válida en GET y POST', async () => {
    mockFetch(apiOk({ ...SESSION, id: 'x'.repeat(64) }), apiOk({}), apiOk({ ...SESSION, id: 'x'.repeat(64) }));
    await expect(verificationSessionService.read(id)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(verificationSessionService.cancel(id)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(verificationSessionService.cancel(id)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it.each(['READY', 'PROCESSING'])('cancelación que devuelve %s no prueba una cancelación', async (execution_status) => {
    mockFetch(apiOk({ ...SESSION, execution_status }));
    await expect(verificationSessionService.cancel(id)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it.each([401, 403, 404, 405, 409, 413, 422, 429, 500, 503])('propaga el error %i con código estable', async (status) => {
    mockFetch(apiFail(status, 'SESSION_TEST_ERROR', 'Falla de prueba'));
    await expect(verificationSessionService.read(id)).rejects.toMatchObject({ status, code: 'SESSION_TEST_ERROR' });
  });
});
