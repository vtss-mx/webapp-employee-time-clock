import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFail, apiOk, jsonResponse, mockFetch } from '../test/http';
import {
  ApiError,
  apiEnvelope,
  apiRequest,
  buildUrl,
  configureApiClient,
  errorMessage,
  fieldErrorsFrom,
  newTraceId,
  normalizeResponse,
  parseRetryAfter,
  retryDelay,
} from './apiClient';
import { clientError, defaultCode, defaultMessage, normalizeErrors } from './http/envelope';
import { buildFaceForm } from './http/faceUpload';

const hooks = { getToken: vi.fn<() => string | null>(), onUnauthorized: vi.fn(), refreshSession: vi.fn<() => Promise<boolean>>() };

beforeEach(() => {
  hooks.getToken.mockReturnValue('token-1');
  hooks.refreshSession.mockResolvedValue(false);
  configureApiClient(hooks);
});
afterEach(() => vi.useRealTimers());

describe('normalizeResponse: cualquier respuesta se convierte al contrato', () => {
  it('contrato válido', () => {
    const env = normalizeResponse(200, { success: true, statusCode: 200, code: 'OK', message: 'Bien', data: { a: 1 }, errors: [], traceId: 't', timestamp: 'x' });
    expect(env).toMatchObject({ success: true, code: 'OK', data: { a: 1 }, traceId: 't' });
  });
  it('success contradictorio con 2xx se trata como error', () => {
    const env = normalizeResponse(200, { success: false, statusCode: 200, code: 'X', message: 'm', data: null, errors: [] });
    expect(env.success).toBe(false);
    expect(env.errors).toHaveLength(1);
  });
  it('formato antiguo {detail} y errores de FastAPI', () => {
    expect(normalizeResponse(409, { detail: 'Duplicado', code: 'CONFLICT', request_id: 'r' })).toMatchObject({ message: 'Duplicado', traceId: 'r', success: false });
    const raw = normalizeResponse(422, { detail: [{ loc: ['body', 'email'], msg: 'bad', type: 'value_error' }, { loc: ['body', 'x'], msg: 'otro' }] });
    expect(raw.errors[0]).toMatchObject({ field: 'email', code: 'value_error' });
    expect(raw.message).toBe(defaultMessage(422));
    const withDetails = normalizeResponse(422, { detail: 'Quita lentes', details: { accessories: ['GLASSES'] } });
    expect(withDetails.errors[0].details).toEqual({ accessories: ['GLASSES'] });
  });
  it('HTML, texto, vacío y primitivos', () => {
    expect(normalizeResponse(502, '<html>', { isJson: false, traceId: 'h' })).toMatchObject({ code: 'SERVICE_UNAVAILABLE', traceId: 'h' });
    expect(normalizeResponse(200, '<!doctype html>', { isJson: false })).toMatchObject({ success: false, code: 'INVALID_RESPONSE', statusCode: 502 });
    expect(normalizeResponse(204, null)).toMatchObject({ success: true, data: null });
    expect(normalizeResponse(200, [1, 2], { isJson: true })).toMatchObject({ success: true, data: [1, 2] });
    expect(normalizeResponse(418, 'tetera', { isJson: false })).toMatchObject({ code: 'HTTP_ERROR' });
    expect(normalizeResponse(500, 42, { isJson: true }).success).toBe(false);
  });
  it('valores por defecto y errores normalizados', () => {
    expect(defaultCode(299)).toBe('OK');
    expect(defaultCode(599)).toBe('SERVER_ERROR');
    expect(defaultMessage(299)).toBe(defaultMessage(200));
    expect(defaultMessage(451)).toBe(defaultMessage(400));
    expect(normalizeErrors(['texto', 5, { nada: 1 }], 'C')).toEqual([{ code: 'C', message: 'texto', field: null, details: null }]);
    expect(normalizeErrors('no-lista', 'C')).toEqual([]);
    expect(clientError(0, 't').code).toBe('NETWORK_ERROR');
  });
});

describe('ApiError', () => {
  it('expone errores por campo, detalles y si es transitorio', () => {
    const error = new ApiError({
      statusCode: 422,
      code: 'VALIDATION_ERROR',
      message: 'm',
      errors: [
        { code: 'a', message: 'Correo inválido', field: 'email', details: null },
        { code: 'b', message: 'duplicado', field: 'email', details: null },
        { code: 'c', message: 'x', field: null, details: { accessories: ['MASK'] } },
      ],
    });
    expect(error.fieldErrors).toEqual({ email: 'Correo inválido' });
    expect(error.details).toEqual({ accessories: ['MASK'] });
    expect(error.isTransient).toBe(false);
    expect(new ApiError({ statusCode: 503, code: 'X', message: 'm' }).isTransient).toBe(true);
    expect(new ApiError({ statusCode: 503, code: 'X', message: 'm' }).details).toBeNull();
  });
  it('fieldErrorsFrom: errores por campo y de negocio llevados a los campos del formulario', () => {
    type Form = { email: string; street: string; radius: string };
    const validation = new ApiError({
      statusCode: 422,
      code: 'VALIDATION_ERROR',
      message: 'm',
      errors: [
        { code: 'a', message: 'Correo inválido', field: 'email', details: null },
        { code: 'b', message: 'Falta la calle', field: 'address.street', details: null },
        { code: 'c', message: 'Radio inválido', field: 'location_radius_m', details: null },
      ],
    });
    const rename = { 'address.street': 'street', location_radius_m: 'radius', EMAIL_TAKEN: 'email' } as const;
    // Sin traducción, cada campo conserva su nombre; con ella, toma el del formulario.
    expect(fieldErrorsFrom<Form>(validation)).toEqual({ email: 'Correo inválido', 'address.street': 'Falta la calle', location_radius_m: 'Radio inválido' });
    expect(fieldErrorsFrom<Form>(validation, rename)).toEqual({ email: 'Correo inválido', street: 'Falta la calle', radius: 'Radio inválido' });
    // El error de negocio va al campo que le corresponde y tiene prioridad.
    const taken = new ApiError({ statusCode: 409, code: 'EMAIL_TAKEN', message: 'Ya registrado', errors: [{ code: 'x', message: 'otro', field: 'email', details: null }] });
    expect(fieldErrorsFrom<Form>(taken, rename)).toEqual({ email: 'Ya registrado' });
    expect(fieldErrorsFrom<Form>(new ApiError({ statusCode: 409, code: 'OTRO', message: 'm' }), rename)).toEqual({});
    expect(fieldErrorsFrom<Form>(new Error('sin red'), rename)).toEqual({});
  });
  it('mensajes de error legibles', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage('texto')).toBe('texto');
    expect(errorMessage(42)).toBe('Ocurrió un error inesperado');
    expect(errorMessage('')).toBe('Ocurrió un error inesperado'); // texto vacío: el mensaje genérico
  });
});

describe('utilidades de transporte', () => {
  it('construye URLs con query omitiendo vacíos', () => {
    expect(buildUrl('/x')).toBe('/api/x');
    expect(buildUrl('/x', { a: 1, b: '', c: null, d: undefined, e: true })).toBe('/api/x?a=1&e=true');
    expect(buildUrl('/x', { a: '' })).toBe('/api/x');
  });
  it('genera traceIds y respeta Retry-After', () => {
    expect(newTraceId()).toMatch(/^[a-z0-9]{12,}$/);
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter('3')).toBe(3000);
    expect(parseRetryAfter(new Date(Date.now() + 2000).toUTCString())).toBeGreaterThan(0);
    expect(parseRetryAfter('basura')).toBeNull();
    const delay = retryDelay(0, 60_000);
    expect(delay).toBeGreaterThanOrEqual(7500);
    expect(delay).toBeLessThanOrEqual(12500);
    expect(retryDelay(2, null)).toBeGreaterThanOrEqual(1200);
  });
  it('arma el multipart facial (sin capturas de colores: el destello se retiró)', () => {
    const form = buildFaceForm(
      { frontal: [new Blob(['a']), new Blob(['b'])], challenge: { id: 'c1', images: [new Blob(['l']), new Blob(['r'])] }, camera: 'Cámara '.repeat(40) },
      { qr_content: 'TCQR1:x' },
    );
    expect(form.getAll('images')).toHaveLength(2);
    expect(form.get('challenge_id')).toBe('c1');
    expect(form.getAll('challenge_image')).toHaveLength(2);
    expect(form.getAll('flash_image')).toEqual([]);
    expect((form.get('camera_label') as string).length).toBe(200); // acotado
    expect(form.get('qr_content')).toBe('TCQR1:x');
    const bare = buildFaceForm({ frontal: [new Blob(['a'])] });
    expect(bare.get('challenge_id')).toBeNull();
    expect(bare.get('camera_label')).toBeNull();
  });
});

describe('apiRequest', () => {
  it('envía token, traceId, JSON y cookies; devuelve data', async () => {
    const { calls } = mockFetch(apiOk({ id: 1 }));
    await expect(apiRequest('/users/me', { method: 'POST', body: { a: 1 } })).resolves.toEqual({ id: 1 });
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer token-1');
    expect(headers['X-Request-ID']).toBeTruthy();
    expect(headers['Content-Type']).toBe('application/json');
    expect(calls[0].init.credentials).toBe('include');
  });
  it('no envía token con auth:false ni Content-Type con FormData', async () => {
    const { calls } = mockFetch(apiOk(null));
    await apiRequest('/x', { method: 'POST', body: new FormData(), auth: false });
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(headers['Content-Type']).toBeUndefined();
  });
  it('devuelve el contrato completo con apiEnvelope', async () => {
    mockFetch(apiOk({ id: 1 }, { code: 'EMPLOYEE_CREATED', message: 'Creado', status: 201 }));
    await expect(apiEnvelope('/x', { method: 'POST' })).resolves.toMatchObject({ code: 'EMPLOYEE_CREATED', message: 'Creado', statusCode: 201 });
  });
  it('rechaza datos con forma inesperada', async () => {
    mockFetch(apiOk({ otra: 'cosa' }));
    const isUser = (v: unknown): v is { id: number } => typeof v === 'object' && v !== null && 'id' in v;
    await expect(apiRequest('/x', { validate: isUser })).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 502 });
  });
  it('acepta JSON con content-type incorrecto y respuestas vacías', async () => {
    mockFetch(new Response('{"a":1}', { status: 200, headers: { 'Content-Type': 'text/plain' } }));
    await expect(apiRequest('/x')).resolves.toEqual({ a: 1 });
    mockFetch(new Response(null, { status: 204 }));
    await expect(apiRequest('/x', { method: 'DELETE' })).resolves.toBeNull();
  });
  it('reintenta lecturas ante errores transitorios', async () => {
    vi.useFakeTimers();
    const { fn } = mockFetch(apiFail(503, 'SERVER_BUSY', 'ocupado', { 'Retry-After': '1' }), apiOk('ok'));
    const promise = apiRequest('/x');
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it('no reintenta escrituras ni 429', async () => {
    const { fn } = mockFetch(apiFail(503, 'SERVER_BUSY'));
    await expect(apiRequest('/x', { method: 'POST' })).rejects.toMatchObject({ code: 'SERVER_BUSY' });
    expect(fn).toHaveBeenCalledTimes(1);
    const second = mockFetch(apiFail(429, 'RATE_LIMITED'));
    await expect(apiRequest('/x')).rejects.toMatchObject({ status: 429 });
    expect(second.fn).toHaveBeenCalledTimes(1);
  });
  it('convierte errores de red y timeouts', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(apiRequest('/x', { method: 'POST' })).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    vi.stubGlobal(
      'fetch',
      vi.fn((_: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted'))))),
    );
    await expect(apiRequest('/x', { method: 'POST', timeoutMs: 5 })).rejects.toMatchObject({ status: 408, code: 'TIMEOUT' });
  });
  it('respeta la cancelación del llamador', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('x', 'AbortError'))))),
    );
    const controller = new AbortController();
    const promise = apiRequest('/x', { signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toBeInstanceOf(DOMException);
  });
  it('TOKEN_EXPIRED: renueva una vez y repite la petición', async () => {
    hooks.refreshSession.mockResolvedValue(true);
    const { fn } = mockFetch(apiFail(401, 'TOKEN_EXPIRED'), apiOk('ok'));
    await expect(apiRequest('/x')).resolves.toBe('ok');
    expect(hooks.refreshSession).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledTimes(2);
    expect(hooks.onUnauthorized).not.toHaveBeenCalled();
  });
  it('401 sin posibilidad de renovar cierra la sesión', async () => {
    mockFetch(apiFail(401, 'SESSION_REVOKED', 'Sesión revocada'));
    await expect(apiRequest('/x')).rejects.toMatchObject({ code: 'SESSION_REVOKED' });
    expect(hooks.refreshSession).not.toHaveBeenCalled();
    expect(hooks.onUnauthorized).toHaveBeenCalledWith('Sesión revocada');
  });
  it('retries: 0 no reintenta lecturas (consultas que deben rendirse rápido)', async () => {
    const { fn } = mockFetch(apiFail(503, 'SERVER_BUSY'), apiOk('ok'));
    await expect(apiRequest('/x', { retries: 0 })).rejects.toMatchObject({ code: 'SERVER_BUSY' });
    expect(fn).toHaveBeenCalledOnce();
  });
  it('retries explícito también aplica a escrituras', async () => {
    vi.useFakeTimers();
    const { fn } = mockFetch(apiFail(502, 'SERVICE_UNAVAILABLE'), apiOk('ok'));
    const promise = apiRequest('/x', { method: 'POST', retries: 1 });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it('cancelada durante la espera entre reintentos: no hace otro intento', async () => {
    vi.useFakeTimers();
    const { fn } = mockFetch(apiFail(503, 'SERVER_BUSY', 'ocupado', { 'Retry-After': '5' }), apiOk('ok'));
    const controller = new AbortController();
    const promise = apiRequest('/x', { signal: controller.signal });
    const assertion = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(100); // ya está esperando el reintento
    controller.abort();
    await assertion;
    await vi.runAllTimersAsync();
    expect(fn).toHaveBeenCalledOnce();
  });
  it('401 con un token que otra petición ya renovó: repite con el nuevo sin renovar otra vez', async () => {
    let token = 'token-1';
    hooks.getToken.mockImplementation(() => token);
    const { calls } = mockFetch(() => {
      token = 'token-2'; // otra petición renovó mientras esta viajaba
      return apiFail(401, 'TOKEN_EXPIRED');
    }, apiOk('ok'));
    await expect(apiRequest('/x')).resolves.toBe('ok');
    expect(hooks.refreshSession).not.toHaveBeenCalled();
    expect(hooks.onUnauthorized).not.toHaveBeenCalled();
    expect((calls[1].init.headers as Record<string, string>).Authorization).toBe('Bearer token-2');
  });
  it('401 tras cerrar la sesión por otro lado (sin token): rechaza sin volver a cerrarla', async () => {
    let token: string | null = 'token-1';
    hooks.getToken.mockImplementation(() => token);
    const { fn } = mockFetch(() => {
      token = null;
      return apiFail(401, 'SESSION_REVOKED');
    });
    await expect(apiRequest('/x')).rejects.toMatchObject({ code: 'SESSION_REVOKED' });
    expect(fn).toHaveBeenCalledOnce();
    expect(hooks.onUnauthorized).not.toHaveBeenCalled();
  });
  it('401 de una petición cancelada: rechaza sin renovar ni cerrar la sesión', async () => {
    const controller = new AbortController();
    mockFetch(() => {
      controller.abort(); // la persona salió de la pantalla mientras llegaba la respuesta
      return apiFail(401, 'TOKEN_EXPIRED');
    });
    await expect(apiRequest('/x', { signal: controller.signal })).rejects.toMatchObject({ status: 401 });
    expect(hooks.refreshSession).not.toHaveBeenCalled();
    expect(hooks.onUnauthorized).not.toHaveBeenCalled();
  });
  it('401 cuya renovación termina con la petición ya cancelada: no cierra la sesión', async () => {
    const controller = new AbortController();
    hooks.refreshSession.mockImplementation(() => {
      controller.abort();
      return Promise.resolve(false);
    });
    mockFetch(apiFail(401, 'TOKEN_EXPIRED'));
    await expect(apiRequest('/x', { signal: controller.signal })).rejects.toMatchObject({ status: 401 });
    expect(hooks.refreshSession).toHaveBeenCalledOnce();
    expect(hooks.onUnauthorized).not.toHaveBeenCalled();
  });
  it('401 en peticiones sin sesión no dispara cierre', async () => {
    hooks.getToken.mockReturnValue(null);
    mockFetch(jsonResponse({ detail: 'Credenciales' }, 401));
    await expect(apiRequest('/auth/login', { method: 'POST', auth: false })).rejects.toBeInstanceOf(ApiError);
    expect(hooks.onUnauthorized).not.toHaveBeenCalled();
  });
});
