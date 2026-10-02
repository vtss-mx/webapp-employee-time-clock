import { vi } from 'vitest';

export interface MockCall {
  url: string;
  init: RequestInit;
}

type Responder = (call: MockCall) => Response | Promise<Response>;

/** Respuesta con el contrato único de la API. */
export function envelope(data: unknown, init: { status?: number; code?: string; message?: string; errors?: unknown[] } = {}) {
  const status = init.status ?? 200;
  return {
    success: status >= 200 && status < 300,
    statusCode: status,
    code: init.code ?? (status < 300 ? 'OK' : 'ERROR'),
    message: init.message ?? 'mensaje',
    data,
    errors: init.errors ?? [],
    traceId: 'trace-test',
    timestamp: '2026-10-01T00:00:00.000Z',
  };
}

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Request-ID': 'trace-test', ...headers },
  });
}

export function apiOk(data: unknown, init: { status?: number; code?: string; message?: string } = {}): Response {
  return jsonResponse(envelope(data, init), init.status ?? 200);
}

export function apiFail(status: number, code: string, message = 'falló', headers: Record<string, string> = {}): Response {
  return jsonResponse(envelope(null, { status, code, message, errors: [{ code, message, field: null, details: null }] }), status, headers);
}

/** Sustituye fetch por una cola de respuestas (o una función) y registra las llamadas. */
export function mockFetch(...responders: Array<Response | Responder>) {
  const calls: MockCall[] = [];
  const queue = [...responders];
  const fn = vi.fn((input: RequestInfo | URL, init: RequestInit = {}) => {
    const call = { url: typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, init };
    calls.push(call);
    const next = queue.length > 1 ? queue.shift() : queue[0];
    if (!next) return Promise.reject(new TypeError('Failed to fetch'));
    return Promise.resolve(typeof next === 'function' ? next(call) : next.clone());
  });
  vi.stubGlobal('fetch', fn);
  return { calls, fn };
}

/** Respuesta de la validación en vivo (`GET /api/validation`, respaldo HTTP del canal). */
export function liveCheck(code = 'AVAILABLE', message = 'Disponible', field = 'email'): Response {
  const valid = code !== 'INVALID_FORMAT' && code !== 'EMPTY';
  return apiOk({ field, value: '', normalized: null, valid, available: valid && code !== 'TAKEN', code, message });
}
