import { afterEach, describe, expect, it, vi } from 'vitest';
import { knownLocation } from './geolocation';

// jsdom no tiene la API de permisos ni geolocalización: cada prueba pone las del navegador que simula.
const stub = (name: 'permissions' | 'geolocation', value: unknown) => Object.defineProperty(navigator, name, { value, configurable: true });
const permission = (state: PermissionState) => ({ query: vi.fn(() => Promise.resolve({ state })) });

afterEach(() => {
  Reflect.deleteProperty(navigator, 'permissions');
  Reflect.deleteProperty(navigator, 'geolocation');
});

describe('knownLocation: referencia de cercanía sin abrir el aviso del navegador', () => {
  it('con el permiso ya dado usa una lectura reciente (rápida, sin GPS)', async () => {
    const permissions = permission('granted');
    let options: PositionOptions | undefined;
    stub('permissions', permissions);
    stub('geolocation', {
      getCurrentPosition: (ok: PositionCallback, _fail: PositionErrorCallback, opts: PositionOptions) => {
        options = opts;
        ok({ coords: { latitude: 29.07, longitude: -110.95, accuracy: 30 } } as GeolocationPosition);
      },
    });
    await expect(knownLocation()).resolves.toEqual({ latitude: 29.07, longitude: -110.95, accuracy: 30 });
    expect(permissions.query).toHaveBeenCalledWith({ name: 'geolocation' });
    expect(options).toEqual({ enableHighAccuracy: false, timeout: 3000, maximumAge: 600_000 });
  });

  it.each(['prompt', 'denied'] as const)('sin el permiso ya dado (%s) no la pide: nunca abre el aviso', async (state) => {
    const getCurrentPosition = vi.fn();
    stub('permissions', permission(state));
    stub('geolocation', { getCurrentPosition });
    await expect(knownLocation()).resolves.toBeNull();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('si el dispositivo no la da (apagada, tarda) responde null', async () => {
    stub('permissions', permission('granted'));
    stub('geolocation', { getCurrentPosition: (_ok: PositionCallback, fail: PositionErrorCallback) => fail({ code: 3 } as GeolocationPositionError) });
    await expect(knownLocation({ timeoutMs: 50, maxAgeMs: 0 })).resolves.toBeNull();
  });

  it('sin la API de permisos o sin geolocalización responde null (nunca lanza)', async () => {
    await expect(knownLocation()).resolves.toBeNull();
    stub('permissions', permission('granted'));
    await expect(knownLocation()).resolves.toBeNull();
    stub('permissions', { query: () => Promise.reject(new TypeError('geolocation no es un permiso conocido')) });
    await expect(knownLocation()).resolves.toBeNull();
  });
});
