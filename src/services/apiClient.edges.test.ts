import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFail, mockFetch } from '../test/http';
import { apiEnvelope, ApiError, apiRequest, configureApiClient, newTraceId, normalizeResponse } from './apiClient';
import { defaultMessage } from './http/envelope';

/**
 * Casos límite del transporte: respuestas que no se pueden leer o sin cabeceras, el cliente antes de
 * configurarse (sin sesión) y contextos sin `crypto.randomUUID` (http en la red local).
 */

const ENVELOPE = { success: true, statusCode: 200, code: 'OK', message: 'Bien', data: { id: 1 }, errors: [], traceId: 't-1', timestamp: 'x' };

/** Respuesta sin Content-Type, como la de algunos proxies. */
function untyped(text: string, status = 200): Response {
  const response = new Response(text, { status });
  response.headers.delete('Content-Type');
  return response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('cliente sin configurar (aún no monta AuthProvider)', () => {
  it('no hay token y renovar la sesión responde que no', async () => {
    vi.resetModules();
    const fresh = await import('./apiClient');
    expect(fresh.currentAccessToken()).toBeNull();
    await expect(fresh.renewAccessToken()).resolves.toBe(false);
  });

  it('un 401 sin quien escuche el cierre de sesión solo rechaza la petición', async () => {
    configureApiClient({ getToken: () => 'token-1', refreshSession: () => Promise.resolve(false) });
    mockFetch(apiFail(401, 'SESSION_REVOKED', 'Sesión revocada'));
    await expect(apiRequest('/users/me')).rejects.toMatchObject({ status: 401, code: 'SESSION_REVOKED' });
  });
});

describe('cuerpos que no se pueden leer o sin Content-Type', () => {
  it('un cuerpo que falla al leerse cuenta como vacío', async () => {
    configureApiClient({ getToken: () => null, refreshSession: () => Promise.resolve(false) });
    const broken = (status: number) => {
      const response = new Response('x', { status });
      vi.spyOn(response, 'text').mockRejectedValue(new TypeError('conexión interrumpida'));
      return response;
    };
    mockFetch(() => broken(200));
    await expect(apiEnvelope('/auth/logout', { method: 'POST' })).resolves.toMatchObject({ success: true, data: null });
    mockFetch(() => broken(503));
    await expect(apiRequest('/catalogs', { retries: 0 })).rejects.toMatchObject({ status: 503, code: 'SERVICE_UNAVAILABLE' });
  });

  it('JSON sin cabecera se reconoce por su forma; texto o JSON roto quedan como respuesta inesperada', async () => {
    mockFetch(() => untyped(JSON.stringify(ENVELOPE)));
    await expect(apiRequest('/x')).resolves.toEqual({ id: 1 });

    mockFetch(() => untyped('<!doctype html><p>Mantenimiento</p>'));
    await expect(apiRequest('/x', { retries: 0 })).rejects.toMatchObject({ status: 502, code: 'INVALID_RESPONSE' });

    mockFetch(() => untyped('{"success": tru'));
    await expect(apiRequest('/x', { retries: 0 })).rejects.toMatchObject({ status: 502, code: 'INVALID_RESPONSE' });

    mockFetch(() => untyped('Servicio en mantenimiento', 503));
    const error = await apiRequest('/x', { retries: 0 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 503, code: 'SERVICE_UNAVAILABLE', message: defaultMessage(503) });
  });
});

describe('traceId sin crypto.randomUUID', () => {
  it.each([
    ['contexto sin randomUUID', {}],
    [
      'randomUUID que falla (contexto no seguro)',
      {
        randomUUID: () => {
          throw new DOMException('Contexto no seguro', 'SecurityError');
        },
      },
    ],
  ])('%s: usa el respaldo con hora y azar', (_name, crypto) => {
    vi.stubGlobal('crypto', crypto);
    const first = newTraceId();
    expect(first).toMatch(/^[0-9a-z]{12,}$/);
    expect(newTraceId()).not.toBe(first);
  });
});

describe('contrato: valores que faltan o vienen vacíos', () => {
  it('código y mensaje vacíos se completan con los del estado HTTP', () => {
    const env = normalizeResponse(409, { statusCode: 409, code: '', message: 42, errors: [] });
    expect(env).toMatchObject({ success: false, code: 'CONFLICT', message: defaultMessage(409) });
    expect(env.errors).toEqual([{ code: 'CONFLICT', message: defaultMessage(409), field: null, details: null }]);
  });

  it('un contrato con errores pero sin data sigue siendo el contrato', () => {
    const env = normalizeResponse(422, { statusCode: 422, code: 'VALIDATION_ERROR', message: 'Revisa', errors: [{ code: 'REQUIRED', message: 'Falta', field: 'email' }] });
    expect(env).toMatchObject({ code: 'VALIDATION_ERROR', message: 'Revisa', data: null });
    expect(env.errors).toEqual([{ code: 'REQUIRED', message: 'Falta', field: 'email', details: null }]);
  });

  it('formato antiguo con lista de errores y detalles: los detalles van en el primer error', () => {
    const env = normalizeResponse(400, { detail: 'Rostro no válido', errors: ['Quita los lentes', 'Mira de frente'], details: { accessories: ['GLASSES'] } });
    expect(env.errors).toEqual([
      { code: 'BAD_REQUEST', message: 'Quita los lentes', field: null, details: { accessories: ['GLASSES'] } },
      { code: 'BAD_REQUEST', message: 'Mira de frente', field: null, details: null },
    ]);
  });

  it('un 5xx sin mensaje propio usa el mensaje genérico del servidor', () => {
    expect(defaultMessage(599)).toBe(defaultMessage(500));
  });
});
