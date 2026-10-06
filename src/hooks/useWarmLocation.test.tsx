import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWarmLocation } from './useWarmLocation';

/** Geolocalización simulada: cada `watchPosition` queda registrado y la prueba le manda lecturas o errores. */
function fakeGeolocation() {
  const watchers = new Map<number, { ok: PositionCallback; fail: PositionErrorCallback; options?: PositionOptions }>();
  let nextId = 1;
  const api = {
    watchPosition: vi.fn((ok: PositionCallback, fail: PositionErrorCallback, options?: PositionOptions) => {
      watchers.set(nextId, { ok, fail, options });
      return nextId++;
    }),
    clearWatch: vi.fn((id: number) => watchers.delete(id)),
  };
  Object.defineProperty(navigator, 'geolocation', { value: api, configurable: true });
  return {
    api,
    watchers,
    fix: (accuracy: number, latitude = 29.1) => act(() => watchers.forEach((w) => w.ok({ coords: { latitude, longitude: -110.9, accuracy } } as GeolocationPosition))),
    fail: (code: number) => act(() => watchers.forEach((w) => w.fail({ code } as GeolocationPositionError))),
  };
}

let visibility: DocumentVisibilityState = 'visible';
const setVisibility = (next: DocumentVisibilityState) =>
  act(() => {
    visibility = next;
    document.dispatchEvent(new Event('visibilitychange'));
  });

beforeEach(() => {
  visibility = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
});
afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'geolocation');
  Reflect.deleteProperty(window, 'isSecureContext');
});

describe('useWarmLocation: ubicación "caliente" del punto de control', () => {
  it('sin requerirla no observa nada y no adjunta ubicación', async () => {
    const geo = fakeGeolocation();
    const { result } = renderHook(() => useWarmLocation(false, vi.fn()));
    expect(geo.api.watchPosition).not.toHaveBeenCalled();
    expect(await result.current.take()).toBeNull();
  });

  it('observa con precisión alta; cada identificación lleva al instante la más precisa y las recientes (hasta el tope)', async () => {
    const geo = fakeGeolocation();
    const { result } = renderHook(() => useWarmLocation(true, vi.fn()));
    expect(geo.watchers.get(1)?.options).toEqual({ enableHighAccuracy: true, maximumAge: 0 });
    geo.fix(5, 29.11);
    geo.fix(25, 29.12);
    geo.fix(12, 29.13);
    geo.fix(30, 29.14); // config.locationSamples = 3: la primera (aunque precisa) ya no viaja
    const take = await result.current.take();
    expect(take).toEqual({
      latitude: 29.13,
      longitude: -110.9,
      accuracy: 12,
      samples: [29.12, 29.13, 29.14].map((latitude, i) => ({ latitude, longitude: -110.9, accuracy: [25, 12, 30][i] })),
    });
  });

  it('sin lectura reciente espera la siguiente (sin pasar del tope); vieja no se usa', async () => {
    vi.useFakeTimers();
    const geo = fakeGeolocation();
    const { result } = renderHook(() => useWarmLocation(true, vi.fn()));
    const waiting = result.current.take();
    geo.fix(20);
    expect(await waiting).toMatchObject({ accuracy: 20 });

    // 31 s después la lectura ya es vieja: se espera otra y, si no llega en 8 s, se identifica sin ubicación.
    await act(() => vi.advanceTimersByTimeAsync(31_000));
    const timedOut = result.current.take();
    await act(() => vi.advanceTimersByTimeAsync(8_000));
    expect(await timedOut).toBeNull();
  });

  it('permiso bloqueado: se informa UNA vez y no se espera; un GPS sin señal no se informa (sigue intentando)', async () => {
    const geo = fakeGeolocation();
    const onProblem = vi.fn();
    const { result } = renderHook(() => useWarmLocation(true, onProblem));
    const waiting = result.current.take();
    geo.fail(2); // sin señal: termina la espera, sin aviso
    expect(await waiting).toBeNull();
    expect(onProblem).not.toHaveBeenCalled();
    geo.fail(1);
    geo.fail(1);
    expect(onProblem).toHaveBeenCalledExactlyOnceWith('denied');
    expect(await result.current.take()).toBeNull(); // sin esperar
    geo.fix(15); // se volvió a permitir: hay ubicación otra vez
    expect(await result.current.take()).toMatchObject({ accuracy: 15 });
  });

  it('conexión no segura o navegador sin ubicación: se informa y no se observa', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    const geo = fakeGeolocation();
    const onProblem = vi.fn();
    const { result } = renderHook(() => useWarmLocation(true, onProblem));
    expect(onProblem).toHaveBeenCalledWith('insecure');
    expect(geo.api.watchPosition).not.toHaveBeenCalled();
    expect(await result.current.take()).toBeNull();

    Reflect.deleteProperty(window, 'isSecureContext');
    Reflect.deleteProperty(navigator, 'geolocation');
    const unsupported = vi.fn();
    renderHook(() => useWarmLocation(true, unsupported));
    expect(unsupported).toHaveBeenCalledWith('unsupported');
  });

  it('con la pestaña oculta deja de observar y vuelve al mostrarse; al salir de la pantalla lo suelta', () => {
    const geo = fakeGeolocation();
    const { unmount } = renderHook(() => useWarmLocation(true, vi.fn()));
    setVisibility('hidden');
    expect(geo.api.clearWatch).toHaveBeenCalledWith(1);
    setVisibility('hidden'); // ya estaba en pausa
    expect(geo.api.clearWatch).toHaveBeenCalledOnce();
    setVisibility('visible');
    setVisibility('visible'); // ya observaba: no abre otra
    expect(geo.api.watchPosition).toHaveBeenCalledTimes(2);
    unmount();
    expect(geo.api.clearWatch).toHaveBeenLastCalledWith(2);
    expect(geo.watchers.size).toBe(0);
  });

  it('abrir la pantalla con la pestaña oculta espera a mostrarse', () => {
    visibility = 'hidden';
    const geo = fakeGeolocation();
    renderHook(() => useWarmLocation(true, vi.fn()));
    expect(geo.api.watchPosition).not.toHaveBeenCalled();
    setVisibility('visible');
    expect(geo.api.watchPosition).toHaveBeenCalledOnce();
  });
});
