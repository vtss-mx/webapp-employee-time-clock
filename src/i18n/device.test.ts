import { afterEach, describe, expect, it, vi } from 'vitest';
import { deviceStore } from '../utils/deviceStore';
import { browserLocale, deviceLocale, initialLocale, rememberDeviceLocale } from './device';

/**
 * Idioma del dispositivo (inicio de sesión y anónimos): la última elección en IndexedDB, luego los
 * idiomas del navegador y al final es-MX. Nunca localStorage.
 */
const languages = (list: string[]) => {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(list);
  vi.spyOn(navigator, 'language', 'get').mockReturnValue(list[0] ?? '');
};

afterEach(() => vi.useRealTimers());

describe('idioma del dispositivo', () => {
  it('usa la última elección guardada en IndexedDB', async () => {
    const get = vi.spyOn(deviceStore, 'get').mockResolvedValue('en-US');
    expect(await deviceLocale()).toBe('en-US');
    expect(get).toHaveBeenCalledWith('locale');
    get.mockResolvedValue('ja-JP'); // un valor ajeno no cuenta
    expect(await deviceLocale()).toBeNull();
  });

  it('no espera para siempre a IndexedDB: tras el tiempo límite sigue sin elección', async () => {
    vi.useFakeTimers();
    vi.spyOn(deviceStore, 'get').mockReturnValue(new Promise(() => undefined));
    const pending = deviceLocale(1500);
    await vi.advanceTimersByTimeAsync(1500);
    expect(await pending).toBeNull();
  });

  it('recuerda la elección en el dispositivo', async () => {
    const set = vi.spyOn(deviceStore, 'set').mockResolvedValue();
    await rememberDeviceLocale('en-US');
    expect(set).toHaveBeenCalledWith('locale', 'en-US');
  });
});

describe('idioma del navegador', () => {
  it('toma el primer idioma que la app tiene (cada variante a su idioma; España → es-ES)', () => {
    expect(browserLocale(['ja-JP', 'en-GB', 'es'])).toBe('en-US');
    expect(browserLocale(['es-AR'])).toBe('es-MX');
    expect(browserLocale(['es-ES', 'es'])).toBe('es-ES');
    expect(browserLocale(['ja', 'ko'])).toBeNull();
    languages(['pt-BR', 'es-419']);
    expect(browserLocale()).toBe('pt-BR');
    languages(['fr-CA', 'de-AT', 'it']);
    expect(browserLocale()).toBe('fr-FR');
  });
});

describe('idioma al abrir la app', () => {
  it('dispositivo → navegador → es-MX', async () => {
    const get = vi.spyOn(deviceStore, 'get').mockResolvedValue('en-US');
    languages(['es-MX']);
    expect(await initialLocale()).toBe('en-US');
    get.mockResolvedValue(undefined);
    expect(await initialLocale()).toBe('es-MX');
    languages(['en-US']);
    expect(await initialLocale()).toBe('en-US');
    languages(['ja-JP']);
    expect(await initialLocale()).toBe('es-MX');
  });
});
