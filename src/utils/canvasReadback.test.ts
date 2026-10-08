import { afterEach, describe, expect, it, vi } from 'vitest';
import { canvasReadbackBlocked } from './canvasReadback';

/** Un OffscreenCanvas cuyo contexto lee lo que la prueba diga (como lo entregaría cada navegador). */
function offscreen(read: (() => Uint8ClampedArray) | null) {
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      getContext() {
        return read ? { fillStyle: '', fillRect: () => undefined, getImageData: () => ({ data: read() }) } : null;
      }
    },
  );
}

/** 16 × 16 píxeles del color de la prueba, con `altered` de ellos cambiados por `shift` niveles. */
function pixels(altered = 0, shift = 0): Uint8ClampedArray {
  const data = new Uint8ClampedArray(16 * 16 * 4);
  for (let i = 0; i < 256; i++) data.set([16, 160 + (i < altered ? shift : 0), 64, 255], i * 4);
  return data;
}

afterEach(() => vi.unstubAllGlobals());

describe('lectura de los lienzos (protección contra huellas digitales)', () => {
  it('la imagen real (o con el retoque de Firefox o de Brave) sirve', () => {
    offscreen(() => pixels());
    expect(canvasReadbackBlocked()).toBe(false);
    offscreen(() => pixels(8, 80)); // Firefox: unos cuantos píxeles al azar
    expect(canvasReadbackBlocked()).toBe(false);
    offscreen(() => pixels(256, 3)); // Brave: los bits más bajos
    expect(canvasReadbackBlocked()).toBe(false);
  });

  it('datos al azar (resistFingerprinting: Tor, Mullvad, LibreWolf) o una lectura prohibida no sirven', () => {
    offscreen(() => pixels(200, 90));
    expect(canvasReadbackBlocked()).toBe(true);
    offscreen(() => {
      throw new DOMException('bloqueado', 'SecurityError');
    });
    expect(canvasReadbackBlocked()).toBe(true);
  });

  it('sin OffscreenCanvas o sin contexto 2D no se puede medir: no se acusa nada', () => {
    vi.stubGlobal('OffscreenCanvas', undefined);
    expect(canvasReadbackBlocked()).toBe(false);
    offscreen(null);
    expect(canvasReadbackBlocked()).toBe(false);
  });
});
