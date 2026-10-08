import { beforeEach, describe, expect, it, vi } from 'vitest';
import { faceFrameSharpness, frameQuality, isUsableFrame, MAX_BRIGHTNESS, measureVideoFrame, MIN_BRIGHTNESS, QUALITY_SIDE } from './frameQuality';

/** Una imagen RGBA gris uniforme (plana: sin bordes) o con un tablero de ajedrez (nítida). */
function image(width: number, height: number, draw: (x: number, y: number) => number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = draw(x, y);
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return data;
}

describe('frameQuality: nitidez y brillo de un cuadro', () => {
  it('una imagen plana no tiene nitidez; un tablero sí, y el brillo es el promedio', () => {
    const flat = frameQuality(image(8, 8, () => 120), 8, 8);
    expect(flat.sharpness).toBe(0);
    expect(flat.brightness).toBeCloseTo(120, 3);
    const checker = frameQuality(image(8, 8, (x, y) => ((x + y) % 2 ? 230 : 20)), 8, 8);
    expect(checker.sharpness).toBeGreaterThan(1000);
    expect(checker.brightness).toBeCloseTo(125, 0);
  });

  it('una imagen vacía o de una sola fila no rompe nada', () => {
    expect(frameQuality(new Uint8ClampedArray(0), 0, 0)).toEqual({ sharpness: 0, brightness: 0 });
    expect(frameQuality(image(4, 1, () => 50), 4, 1)).toEqual({ sharpness: 0, brightness: 50 });
  });

  it('sirve si es nítida y con luz, con los límites del servidor', () => {
    expect(isUsableFrame({ sharpness: 12, brightness: 128 }, 12)).toBe(true);
    expect(isUsableFrame({ sharpness: 11.9, brightness: 128 }, 12)).toBe(false);
    expect(isUsableFrame({ sharpness: 50, brightness: MIN_BRIGHTNESS - 1 }, 12)).toBe(false);
    expect(isUsableFrame({ sharpness: 50, brightness: MAX_BRIGHTNESS + 1 }, 12)).toBe(false);
  });
});

describe('measureVideoFrame: la zona del rostro a 96 px', () => {
  // El módulo crea UN lienzo de medición y lo reutiliza: la prueba cambia lo que su contexto responde.
  let context: Record<string, unknown> | null = null;
  const canvas = { width: 0, height: 0, getContext: vi.fn(() => context) } as unknown as HTMLCanvasElement;
  beforeEach(() => vi.spyOn(document, 'createElement').mockReturnValue(canvas));
  function canvasWith(ctx: Record<string, unknown> | null) {
    context = ctx;
    return canvas;
  }
  const video = { videoWidth: 640, videoHeight: 480 } as HTMLVideoElement;

  it('dibuja el rostro (o el centro) en el lienzo de medición y devuelve su calidad', () => {
    const drawImage = vi.fn();
    const data = image(QUALITY_SIDE, QUALITY_SIDE, (x) => (x % 2 ? 200 : 40));
    canvasWith({ drawImage, getImageData: vi.fn(() => ({ data })) });
    const quality = measureVideoFrame(video, { x: 100, y: 50, width: 200, height: 220 });
    expect(drawImage).toHaveBeenCalledWith(video, 100, 50, 200, 220, 0, 0, QUALITY_SIDE, QUALITY_SIDE);
    expect(quality?.sharpness).toBeGreaterThan(0);
    // Sin rostro conocido: el centro (la mitad del lado menor).
    measureVideoFrame(video, null);
    expect(drawImage).toHaveBeenLastCalledWith(video, 200, 120, 240, 240, 0, 0, QUALITY_SIDE, QUALITY_SIDE);
    expect(canvas.width).toBe(QUALITY_SIDE);
  });

  it('sin lienzo o con el lienzo bloqueado (protección de huellas) no se mide: null (no se descarta nada)', () => {
    canvasWith(null);
    expect(measureVideoFrame(video)).toBeNull();
    canvasWith({
      drawImage: vi.fn(),
      getImageData: vi.fn(() => {
        throw new Error('blocked');
      }),
    });
    expect(measureVideoFrame(video)).toBeNull();
  });

  it('faceFrameSharpness: enfoque del rostro (borde rojo/verde): sin video null, nítido true, borroso false, lienzo bloqueado null', () => {
    const box = { originX: 100, originY: 50, width: 200, height: 220 };
    expect(faceFrameSharpness(null, box, 12)).toBeNull(); // sin video: no se mide
    const sharp = image(QUALITY_SIDE, QUALITY_SIDE, (x, y) => ((x + y) % 2 ? 230 : 20)); // tablero: muy nítido, brillo medio
    canvasWith({ drawImage: vi.fn(), getImageData: vi.fn(() => ({ data: sharp })) });
    expect(faceFrameSharpness(video, box, 12)).toBe(true);
    const flat = image(QUALITY_SIDE, QUALITY_SIDE, () => 120); // plano: sin bordes → borroso
    canvasWith({ drawImage: vi.fn(), getImageData: vi.fn(() => ({ data: flat })) });
    expect(faceFrameSharpness(video, box, 12)).toBe(false);
    canvasWith(null); // lienzo bloqueado: no se descarta por calidad
    expect(faceFrameSharpness(video, box, 12)).toBeNull();
  });
});
