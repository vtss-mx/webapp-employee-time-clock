import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n/core';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../test/http';
import { config } from '../../utils/config';
import { apiRequest, configureApiClient } from '../apiClient';
import { flush, pendingSamples, record, type PerfSample } from './telemetry';
import { resetWebPerformance, startWebPerformance, trackPerfScreen } from './webPerformance';

/**
 * Observadores del navegador con un `PerformanceObserver` simulado: cada prueba entrega las entradas como lo haría
 * el navegador y revisa qué se envía (y cómo) a `POST /api/telemetry/web`.
 */
class FakeObserver {
  static supportedEntryTypes: string[] = [];
  static instances: FakeObserver[] = [];
  type = '';
  init: Record<string, unknown> = {};
  disconnected = false;
  constructor(private readonly callback: (list: { getEntries: () => unknown[] }) => void) {
    FakeObserver.instances.push(this);
  }
  observe(init: { type: string }) {
    this.type = init.type;
    this.init = init;
  }
  disconnect() {
    this.disconnected = true;
  }
  deliver(entries: unknown[]) {
    this.callback({ getEntries: () => entries });
  }
}

const ALL_TYPES = ['navigation', 'paint', 'largest-contentful-paint', 'layout-shift', 'event', 'first-input', 'longtask'];
/** Entrega entradas de un tipo a sus observadores conectados (como el navegador). */
const emit = (type: string, ...entries: unknown[]) => FakeObserver.instances.filter((o) => o.type === type && !o.disconnected).forEach((o) => o.deliver(entries));
const shift = (value: number, startTime: number, hadRecentInput = false) => ({ value, startTime, hadRecentInput });

let visibility: DocumentVisibilityState = 'visible';
const setVisibility = (state: DocumentVisibilityState) => {
  visibility = state;
  document.dispatchEvent(new Event('visibilitychange'));
};

const telemetry = (calls: MockCall[]) => calls.filter((call) => call.url.endsWith('/telemetry/web'));
const sent = (call: MockCall) => (JSON.parse(call.init.body as string) as { app_version: string; samples: PerfSample[] }).samples;
const perf = config.perf as { -readonly [K in keyof typeof config.perf]: (typeof config.perf)[K] };
const defaults = { ...config.perf };

beforeEach(() => {
  FakeObserver.supportedEntryTypes = [...ALL_TYPES];
  FakeObserver.instances = [];
  vi.stubGlobal('PerformanceObserver', FakeObserver);
  visibility = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  window.history.replaceState(null, '', '/admin/companies/12');
});

afterEach(() => {
  resetWebPerformance();
  Object.assign(perf, defaults);
  configureApiClient({ getToken: () => null, refreshSession: () => Promise.resolve(false) });
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('carga de la página y visitas a pantallas', () => {
  it('TTFB, FCP y LCP de la pantalla donde se abrió (una vez); al ocultarse se envía con keepalive, sin sesión ni datos personales', () => {
    const { calls } = mockFetch(apiOk({ accepted: 4, dropped: 0 }, { status: 202 }));
    const stop = startWebPerformance();
    expect(FakeObserver.instances.map((o) => o.type)).toEqual(ALL_TYPES);
    expect(FakeObserver.instances.find((o) => o.type === 'event')?.init).toEqual({ type: 'event', buffered: true, durationThreshold: 40 });

    emit('navigation', { responseStart: 0 }, { responseStart: 120.44 });
    emit('paint', { name: 'first-paint', startTime: 200 }, { name: 'first-contentful-paint', startTime: 300 });
    emit('largest-contentful-paint', { startTime: 500 }, { startTime: 900 });
    window.dispatchEvent(new KeyboardEvent('keydown')); // la primera tecla termina la carga
    emit('largest-contentful-paint', { startTime: 1500 }); // ya no cuenta
    emit('paint', { name: 'first-contentful-paint', startTime: 50 }); // FCP ya se midió

    setVisibility('hidden');
    expect(telemetry(calls)).toHaveLength(1);
    const [call] = telemetry(calls);
    expect(call.url).toBe('/api/telemetry/web');
    expect(call.init).toMatchObject({ method: 'POST', keepalive: true });
    expect(call.init.headers).toEqual({ 'Content-Type': 'application/json', 'Accept-Language': 'es-MX', 'ngrok-skip-browser-warning': 'true' });
    expect(JSON.parse(call.init.body as string)).toMatchObject({ app_version: 'test-build' });
    expect(sent(call)).toEqual([
      { kind: 'TTFB', name: '/admin/companies/{id}', value: 120.4 },
      { kind: 'FCP', name: '/admin/companies/{id}', value: 300 },
      { kind: 'LCP', name: '/admin/companies/{id}', value: 900 },
      { kind: 'CLS', name: '/admin/companies/{id}', value: 0 },
    ]);
    expect(pendingSamples()).toEqual([]);
    // Cerrar la página después de ocultarla no repite la visita (ya se cerró) ni envía un lote vacío.
    window.dispatchEvent(new Event('pagehide'));
    expect(telemetry(calls)).toHaveLength(1);
    stop();
    expect(FakeObserver.instances.every((o) => o.disconnected)).toBe(true);
  });

  it('con sesión el envío lleva el token y el idioma activo', async () => {
    await setLocale('en-US');
    configureApiClient({ getToken: () => 'token-1', refreshSession: () => Promise.resolve(false) });
    const { calls } = mockFetch(apiOk(null, { status: 202 }));
    startWebPerformance();
    emit('longtask', { duration: 75.25 });
    window.dispatchEvent(new Event('pagehide'));
    expect(telemetry(calls)[0].init.headers).toMatchObject({ Authorization: 'Bearer token-1', 'Accept-Language': 'en-US' });
    expect(sent(telemetry(calls)[0])).toEqual([
      { kind: 'LONG_TASK', name: '/admin/companies/{id}', value: 75.3 },
      { kind: 'CLS', name: '/admin/companies/{id}', value: 0 },
    ]);
  });

  it('CLS e INP por visita: cambiar de pantalla cierra la visita (la query no es otra pantalla) y las tareas largas van con su pantalla', () => {
    const { calls } = mockFetch(apiOk(null, { status: 202 }));
    startWebPerformance();
    emit('layout-shift', shift(0.05, 100), shift(0.04, 600), shift(0.3, 700, true));
    emit('event', { interactionId: 3, duration: 120 }, { interactionId: 3, duration: 260 }, { duration: 999 });
    emit('first-input', { interactionId: 2, duration: 30 });
    emit('largest-contentful-paint', { startTime: 400 });
    trackPerfScreen('/admin/companies/12'); // misma ruta (otra query): nada cambia
    expect(pendingSamples()).toEqual([]);
    window.dispatchEvent(new Event('pointerdown')); // la persona toca un enlace...
    trackPerfScreen('/admin/errors'); // ...y cambia de pantalla
    emit('longtask', { duration: 60 });
    emit('layout-shift', shift(0.12345, 2000));
    setVisibility('hidden');
    expect(sent(telemetry(calls)[0])).toEqual([
      { kind: 'LCP', name: '/admin/companies/{id}', value: 400 },
      { kind: 'CLS', name: '/admin/companies/{id}', value: 0.09 },
      { kind: 'INP', name: '/admin/companies/{id}', value: 260 },
      { kind: 'LONG_TASK', name: '/admin/errors', value: 60 },
      { kind: 'CLS', name: '/admin/errors', value: 0.1235 },
    ]);
  });

  it('una redirección durante la carga (sin interacción) sigue la misma visita y su LCP es de la pantalla de destino', () => {
    window.history.replaceState(null, '', '/');
    const { calls } = mockFetch(apiOk(null, { status: 202 }));
    startWebPerformance();
    emit('paint', { name: 'first-contentful-paint', startTime: 120 });
    emit('layout-shift', shift(0.02, 300));
    trackPerfScreen('/login');
    emit('largest-contentful-paint', { startTime: 800 });
    window.dispatchEvent(new KeyboardEvent('keydown'));
    setVisibility('hidden');
    expect(sent(telemetry(calls)[0])).toEqual([
      { kind: 'FCP', name: '/', value: 120 },
      { kind: 'LCP', name: '/login', value: 800 },
      { kind: 'CLS', name: '/login', value: 0.02 },
    ]);
  });

  it('cargada en segundo plano no mide FCP ni LCP; al volver a verse empieza otra visita que se cierra al ocultarse', () => {
    visibility = 'hidden';
    const { calls } = mockFetch(apiOk(null, { status: 202 }));
    startWebPerformance();
    emit('paint', { name: 'first-contentful-paint', startTime: 100 });
    emit('largest-contentful-paint', { startTime: 200 });
    trackPerfScreen('/admin/errors'); // la visita oculta no se envía
    setVisibility('visible');
    setVisibility('visible'); // ya visible: sigue la misma visita
    emit('event', { interactionId: 1, duration: 90 });
    setVisibility('hidden');
    expect(sent(telemetry(calls)[0])).toEqual([
      { kind: 'CLS', name: '/admin/errors', value: 0 },
      { kind: 'INP', name: '/admin/errors', value: 90 },
    ]);
  });

  it('lo que se pinta después de ocultarse no es la carga', () => {
    const { calls } = mockFetch(apiOk(null, { status: 202 }));
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    startWebPerformance();
    setVisibility('hidden');
    emit('paint', { name: 'first-contentful-paint', startTime: 1500 });
    setVisibility('visible');
    trackPerfScreen('/admin/errors');
    expect(pendingSamples()).toEqual([{ kind: 'CLS', name: '/admin/companies/{id}', value: 0 }]);
    expect(sent(telemetry(calls)[0])).toEqual([{ kind: 'CLS', name: '/admin/companies/{id}', value: 0 }]);
  });

  it('un navegador sin estas métricas (Safari, Firefox) no observa nada y no envía CLS', () => {
    FakeObserver.supportedEntryTypes = ['paint'];
    const { calls } = mockFetch(apiOk(null, { status: 202 }));
    startWebPerformance();
    expect(FakeObserver.instances.map((o) => o.type)).toEqual(['paint']);
    window.dispatchEvent(new Event('pagehide'));
    expect(telemetry(calls)).toEqual([]);
  });
});

describe('peticiones a la API vistas desde el navegador', () => {
  it('cada intento con su plantilla y su estado (0 sin red, 408 tiempo agotado); una cancelación y el envío mismo no se miden', async () => {
    let hang = false;
    const { calls } = mockFetch((call) => {
      if (call.url.endsWith('/telemetry/web')) return apiOk(null, { status: 202 });
      if (call.url.includes('/employees/12')) return apiOk({ id: 12 });
      if (call.url.includes('/sites')) return apiFail(404, 'NOT_FOUND');
      if (hang)
        return new Promise<Response>((_resolve, reject) => {
          call.init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        });
      throw new TypeError('Failed to fetch');
    });
    startWebPerformance();
    await apiRequest('/employees/12?include=all');
    await expect(apiRequest('/sites/9', { method: 'POST', body: {} })).rejects.toMatchObject({ status: 404 });
    await expect(apiRequest('/catalogs', { retries: 0 })).rejects.toMatchObject({ status: 0 });
    hang = true;
    await expect(apiRequest('/catalogs', { retries: 0, timeoutMs: 5 })).rejects.toMatchObject({ status: 408 });
    const controller = new AbortController();
    const cancelled = apiRequest('/catalogs', { signal: controller.signal });
    controller.abort();
    await expect(cancelled).rejects.toBeDefined();

    expect(pendingSamples().map(({ kind, name, status }) => [kind, name, status])).toEqual([
      ['API', 'GET /api/employees/{id}', 200],
      ['API', 'POST /api/sites/{id}', 404],
      ['API', 'GET /api/catalogs', 0],
      ['API', 'GET /api/catalogs', 408],
    ]);
    expect(pendingSamples().every((sample) => sample.value >= 0)).toBe(true);
    window.dispatchEvent(new Event('pagehide'));
    expect(telemetry(calls)).toHaveLength(1);
    expect(pendingSamples()).toEqual([]); // el envío no pasó por apiClient: no se midió a sí mismo
  });

  it('sin observadores activos (detenido), las peticiones no se miden', async () => {
    mockFetch(apiOk({ id: 1 }));
    startWebPerformance()();
    await apiRequest('/employees/1');
    expect(pendingSamples()).toEqual([]);
  });
});

describe('muestreo, topes y envío de mejor esfuerzo', () => {
  it('apagado o sin muestrear, no observa ni mide; el muestreo se decide una vez por carga de la página', async () => {
    perf.enabled = false;
    startWebPerformance();
    expect(FakeObserver.instances).toEqual([]);
    perf.enabled = true;
    perf.sampleRate = 0;
    resetWebPerformance();
    mockFetch(apiOk({ id: 1 }));
    startWebPerformance()();
    await apiRequest('/employees/1');
    expect(FakeObserver.instances).toEqual([]);
    expect(pendingSamples()).toEqual([]);
    // Ya decidido para esta carga: aunque cambie la proporción, no se vuelve a sortear.
    perf.sampleRate = 1;
    startWebPerformance();
    expect(FakeObserver.instances).toEqual([]);
  });

  it('se inicia una sola vez; detenerlo dos veces no hace nada y reiniciarlo no repite lo medido una vez', () => {
    const { calls } = mockFetch(apiOk(null, { status: 202 }));
    const stop = startWebPerformance();
    expect(startWebPerformance()).not.toBe(stop);
    expect(FakeObserver.instances).toHaveLength(ALL_TYPES.length);
    emit('paint', { name: 'first-contentful-paint', startTime: 300 });
    stop();
    stop();
    expect(sent(telemetry(calls)[0])).toEqual([{ kind: 'FCP', name: '/admin/companies/{id}', value: 300 }]);
    startWebPerformance(); // como el doble montaje de React en desarrollo
    emit('paint', { name: 'first-contentful-paint', startTime: 300 });
    expect(pendingSamples()).toEqual([]);
  });

  it('envía cada N segundos lo que haya (nada si no hay); el envío tiene tiempo límite y una falla no lanza', async () => {
    vi.useFakeTimers();
    let release: (() => void) | undefined;
    const fetch = vi.fn((_url: string, init: RequestInit) => {
      init.signal?.addEventListener('abort', () => release?.());
      return new Promise<Response>((_resolve, reject) => {
        release = () => reject(new DOMException('aborted', 'AbortError'));
      });
    });
    vi.stubGlobal('fetch', fetch);
    startWebPerformance();
    await vi.advanceTimersByTimeAsync(config.perf.flushMs);
    expect(fetch).not.toHaveBeenCalled();
    emit('longtask', { duration: 51 });
    await vi.advanceTimersByTimeAsync(config.perf.flushMs);
    expect(fetch).toHaveBeenCalledOnce();
    const signal = fetch.mock.calls[0][1].signal as AbortSignal;
    expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(config.perf.timeoutMs);
    expect(signal.aborted).toBe(true); // tiempo agotado: el lote se descarta, sin reintentos ni popups
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('tope de muestras en memoria y del cuerpo; nombres y valores dentro del contrato', () => {
    const { calls } = mockFetch(apiOk(null, { status: 202 }));
    for (let i = 0; i < config.perf.maxSamples + 50; i++) record({ kind: 'API', name: `GET /api/${'x'.repeat(260)}`, value: i === 0 ? -5 : 900_000, status: 200 });
    expect(pendingSamples()).toHaveLength(config.perf.maxSamples);
    expect(pendingSamples()[0]).toEqual({ kind: 'API', name: `GET /api/${'x'.repeat(191)}`, value: 0, status: 200 });
    expect(pendingSamples()[1].value).toBe(600_000);
    flush();
    const body = telemetry(calls)[0].init.body as string;
    expect(body.length).toBeLessThanOrEqual(61_000);
    expect(sent(telemetry(calls)[0]).length).toBeLessThan(config.perf.maxSamples);
    expect(pendingSamples()).toEqual([]); // lo que no cupo se descarta
    flush();
    expect(telemetry(calls)).toHaveLength(1);
  });
});
