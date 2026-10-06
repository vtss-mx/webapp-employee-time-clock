import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFail, apiOk, mockFetch, type MockCall } from '../test/http';

/**
 * Cada prueba carga el módulo de nuevo: lo ya reportado vive por carga de la página (como en el
 * navegador) y así ninguna prueba depende de lo que reportó otra. Las clases de error se importan de
 * la misma carga para que `instanceof` las reconozca, y el idioma (`locale`) se activa en esa carga.
 */
async function fresh(locale: 'es-MX' | 'en-US' = 'es-MX') {
  vi.resetModules();
  await (await import('../i18n/core')).setLocale(locale);
  const service = await import('./clientErrorService');
  const { ApiError } = await import('./apiClient');
  const { MapsApiError } = await import('./maps/googleMaps');
  const { LocationError } = await import('../utils/geolocation');
  const { DeviceKeyError } = await import('../utils/deviceKey');
  const { CameraNotReadyError } = await import('../utils/cameraDiagnostics');
  return { ...service, ApiError, MapsApiError, LocationError, DeviceKeyError, CameraNotReadyError };
}

const sent = (calls: MockCall[]) => calls.filter((call) => call.url === '/api/client-errors');
const bodyOf = (call: MockCall) => JSON.parse(call.init.body as string) as Record<string, unknown>;
const accepted = () => apiOk(null, { status: 202, code: 'CLIENT_ERROR_RECORDED' });

beforeEach(() => {
  window.history.pushState(null, '', '/company/employees/12/edit?search=ana#detalle');
});

afterEach(() => {
  window.history.pushState(null, '', '/');
  vi.unstubAllGlobals();
});

describe('reportClientError', () => {
  it('reporta una pantalla rota con su ruta (sin query ni fragmento), versión y stack, una sola vez por carga', async () => {
    const { calls } = mockFetch(accepted());
    const { reportClientError } = await fresh();
    const error = new TypeError('x is not a function');
    await expect(reportClientError({ kind: 'CRASH', error, component: 'EmployeeForm', detail: 'at EmployeeForm' })).resolves.toBeUndefined();
    const [call] = sent(calls);
    expect(call.init.method).toBe('POST');
    expect(bodyOf(call)).toEqual({
      kind: 'CRASH',
      message: 'TypeError: x is not a function',
      stack: error.stack,
      path: '/company/employees/12/edit',
      component: 'EmployeeForm',
      detail: 'at EmployeeForm',
      app_version: 'test-build',
    });

    await reportClientError({ kind: 'CRASH', error: new TypeError('x is not a function') }); // la misma: no se repite
    expect(sent(calls)).toHaveLength(1);
    window.history.pushState(null, '', '/company/departments');
    await reportClientError({ kind: 'CRASH', error });
    expect(sent(calls)).toHaveLength(2); // en otra pantalla es otra falla
    expect(bodyOf(sent(calls)[1])).toMatchObject({ path: '/company/departments', component: null, detail: null });
  });

  it('es de mejor esfuerzo: un 429, un 500 o sin red no lanzan, no se reintentan ni avisan', async () => {
    const { calls } = mockFetch(apiFail(429, 'RATE_LIMITED'), apiFail(500, 'INTERNAL_ERROR'));
    const { reportClientError } = await fresh();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(reportClientError({ kind: 'UNHANDLED', error: new Error('uno') })).resolves.toBeUndefined();
    await expect(reportClientError({ kind: 'UNHANDLED', error: new Error('dos') })).resolves.toBeUndefined();
    expect(sent(calls)).toHaveLength(2); // uno por falla: sin reintentos
    mockFetch(); // la red no responde
    await expect(reportClientError({ kind: 'UNHANDLED', error: new Error('tres') })).resolves.toBeUndefined();
  });

  it('no reporta lo que la persona resuelve ni lo que el servidor ya registró', async () => {
    const { calls } = mockFetch(accepted());
    const { reportClientError, isAppFailure, ApiError, MapsApiError, LocationError, DeviceKeyError, CameraNotReadyError } = await fresh();
    const skipped = [
      new ApiError({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'falló' }), // ya lo registró el backend
      new LocationError('denied'),
      new DeviceKeyError(),
      new CameraNotReadyError(),
      new DOMException('Permiso denegado', 'NotAllowedError'), // permiso de cámara
      new DOMException('Sin cámara', 'NotFoundError'),
      new DOMException('Cancelada', 'AbortError'),
      new DOMException('Tardó demasiado', 'TimeoutError'),
      new TypeError('Failed to fetch'), // sin conexión
      new TypeError('Load failed'),
      new Error('Importing a module script failed.'), // versión nueva publicada
      new MapsApiError('places', 'failed', 'timeout'), // Google sin red
      new MapsApiError('places', 'off'),
    ];
    for (const error of skipped) {
      expect(isAppFailure(error)).toBe(false);
      await reportClientError({ kind: 'UNHANDLED', error });
    }
    expect(sent(calls)).toHaveLength(0);
    expect(isAppFailure(new MapsApiError('places', 'denied'))).toBe(true);
    expect(isAppFailure('texto lanzado')).toBe(true);
  });

  it('sin conexión ni lo intenta', async () => {
    const { calls } = mockFetch(accepted());
    const { reportClientError } = await fresh();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await reportClientError({ kind: 'CRASH', error: new Error('falla real') });
    expect(sent(calls)).toHaveLength(0);
  });

  it('cualquier valor lanzado se describe y cada texto respeta su tope', async () => {
    const { calls } = mockFetch(accepted());
    const { reportClientError } = await fresh();
    const anonymous = new Error('');
    anonymous.name = '';
    anonymous.stack = undefined;
    const huge = new Error('m'.repeat(2000));
    huge.stack = 's'.repeat(9000);
    await reportClientError({ kind: 'UNHANDLED', error: 'falló algo' });
    await reportClientError({ kind: 'UNHANDLED', error: '' });
    await reportClientError({ kind: 'UNHANDLED', error: Object.create(null) as object }); // sin toString
    await reportClientError({ kind: 'UNHANDLED', error: anonymous });
    await reportClientError({ kind: 'CRASH', error: huge, component: 'c'.repeat(600), detail: 'd'.repeat(600) });
    const bodies = sent(calls).map(bodyOf);
    expect(bodies.slice(0, 4).map((body) => [body.message, body.stack])).toEqual([
      ['falló algo', null],
      ['(sin mensaje)', null],
      ['[object Object]', null],
      ['Error: (sin mensaje)', null],
    ]);
    const clipped = bodies[4] as Record<string, string>;
    expect([clipped.message.length, clipped.stack.length, clipped.component.length, clipped.detail.length]).toEqual([1000, 8000, 500, 500]);
  });

  it('una falla sin texto se reporta como "(no message)" en el idioma de quien la tuvo (en-US)', async () => {
    const { calls } = mockFetch(accepted());
    const { reportClientError } = await fresh('en-US');
    const anonymous = new Error('');
    anonymous.stack = undefined;
    await reportClientError({ kind: 'UNHANDLED', error: '' });
    await reportClientError({ kind: 'UNHANDLED', error: anonymous });
    expect(sent(calls).map((call) => bodyOf(call).message)).toEqual(['(no message)', 'Error: (no message)']);
  });

  it('sin una ruta legible usa la raíz (nunca lanza)', async () => {
    const { calls } = mockFetch(accepted());
    const { reportClientError } = await fresh();
    vi.stubGlobal('location', { pathname: undefined });
    await reportClientError({ kind: 'CRASH', error: new Error('sin ruta') });
    expect(bodyOf(sent(calls)[0]).path).toBe('/');
  });

  it('un ciclo de fallas distintas tiene tope por carga de la página', async () => {
    const { calls } = mockFetch(accepted());
    const { reportClientError } = await fresh();
    for (let n = 0; n < 25; n++) await reportClientError({ kind: 'UNHANDLED', error: new Error(`falla ${n}`) });
    expect(sent(calls)).toHaveLength(20);
  });
});

describe('reportMapsProblem', () => {
  it('una API de Google sin habilitar se reporta una vez por API (configuración); sin red o apagada, no', async () => {
    const { calls } = mockFetch(accepted());
    const { reportMapsProblem, MapsApiError } = await fresh();
    reportMapsProblem(new MapsApiError('places', 'denied', 'REQUEST_DENIED'));
    reportMapsProblem(new MapsApiError('places', 'denied', 'otro detalle'));
    reportMapsProblem(new MapsApiError('geocoding', 'failed', 'timeout'));
    reportMapsProblem(new MapsApiError('geolocation', 'off'));
    reportMapsProblem(new MapsApiError('geocoding', 'denied'));
    const bodies = sent(calls).map(bodyOf);
    expect(bodies.map((body) => [body.kind, body.component, body.message])).toEqual([
      ['CONFIG', 'GoogleMaps:places', 'MapsApiError: places: denied (REQUEST_DENIED)'],
      ['CONFIG', 'GoogleMaps:geocoding', 'MapsApiError: geocoding: denied'],
    ]);
  });
});
