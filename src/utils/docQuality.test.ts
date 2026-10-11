import { afterEach, describe, expect, it, vi } from 'vitest';
import { DOC_SAMPLE_SIDE, docFrameMetrics, docGuideRegion, evaluateDocFrame, frameShift, measureDocFrame, type DocFrameQuality } from './docQuality';

/** Imagen RGBA de `w`×`h` en gris, con el valor de cada píxel dado por `val`. */
function image(w: number, h: number, val: (x: number, y: number) => number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = val(x, y);
      data[i + 3] = 255;
    }
  }
  return data;
}

describe('docGuideRegion: región de la guía dentro del video', () => {
  it('centra la región con la relación de aspecto y la limita al recuadro de inset', () => {
    // Video más ancho (1600×900), aspecto de guía 1.4: manda el alto (900*0.82) y el ancho sale de él.
    const region = docGuideRegion(1600, 900, 1.4, 0.82);
    expect(region.height).toBeCloseTo(900 * 0.82, 3);
    expect(region.width).toBeCloseTo(900 * 0.82 * 1.4, 3);
    expect(region.x).toBeCloseTo((1600 - region.width) / 2, 3);
    expect(region.y).toBeCloseTo((900 - region.height) / 2, 3);
  });

  it('cuando manda el ancho, la altura sale de él', () => {
    const region = docGuideRegion(600, 2000, 1.4, 0.82);
    expect(region.width).toBeCloseTo(600 * 0.82, 3);
    expect(region.height).toBeCloseTo((600 * 0.82) / 1.4, 3);
  });
});

describe('docFrameMetrics: nitidez, brillo, reflejos, llenado y centrado', () => {
  it('imagen plana: sin nitidez, sin reflejos, sin contenido, sin cobertura y centrada', () => {
    const { quality, gray } = docFrameMetrics(image(8, 8, () => 128), 8, 8, 245);
    expect(quality.sharpness).toBe(0);
    expect(quality.brightness).toBeCloseTo(128, 5);
    expect(quality.glare).toBe(0);
    expect(quality.fill).toBe(0);
    expect(quality.coverage).toBe(0);
    expect(quality.center).toBe(0);
    expect(gray).toHaveLength(64);
  });

  it('borde vertical simétrico: con nitidez, contenido y reflejos, pero centrado; la cobertura mide el ancho de la caja', () => {
    const { quality } = docFrameMetrics(image(8, 8, (x) => (x < 4 ? 0 : 255)), 8, 8, 245);
    expect(quality.sharpness).toBeGreaterThan(0);
    expect(quality.fill).toBeGreaterThan(0);
    expect(quality.glare).toBeCloseTo(0.5, 5); // la mitad de los píxeles es 255
    expect(quality.brightness).toBeCloseTo(127.5, 5);
    expect(quality.center).toBe(0); // el contenido es simétrico
    expect(quality.coverage).toBeCloseTo(0.25, 5); // el borde ocupa solo dos columnas (la menor de las dos dimensiones)
  });

  it('contenido en una esquina: la caja de contenido queda descentrada y cubre poco', () => {
    const { quality } = docFrameMetrics(image(8, 8, (x, y) => (x < 3 && y < 3 ? 255 : 0)), 8, 8, 245);
    expect(quality.fill).toBeGreaterThan(0);
    expect(quality.center).toBeGreaterThan(0.1);
    expect(quality.coverage).toBeLessThan(0.55); // una esquina no llena la guía
  });

  it('una imagen diminuta (2×2) no tiene interior donde medir bordes: sin contenido ni cobertura, pero sí brillo y reflejos', () => {
    const { quality, gray } = docFrameMetrics(image(2, 2, () => 250), 2, 2, 245);
    expect(quality).toEqual({ sharpness: 0, brightness: 250, glare: 1, fill: 0, coverage: 0, center: 0 });
    expect(gray).toHaveLength(4);
  });

  it('una imagen sin píxeles (0×0, un video que aún no da cuadro) no divide entre cero: todo en cero', () => {
    const { quality, gray } = docFrameMetrics(new Uint8ClampedArray(0), 0, 0, 245);
    expect(quality).toEqual({ sharpness: 0, brightness: 0, glare: 0, fill: 0, coverage: 0, center: 0 });
    expect(gray).toHaveLength(0);
  });

  it('el nivel de reflejo decide qué píxel cuenta como reflejo', () => {
    expect(docFrameMetrics(image(8, 8, () => 200), 8, 8, 245).quality.glare).toBe(0);
    expect(docFrameMetrics(image(8, 8, () => 250), 8, 8, 245).quality.glare).toBe(1);
  });
});

describe('frameShift: desplazamiento medio entre cuadros (quietud)', () => {
  it('sin cuadro anterior o con otro tamaño es Infinity; cuadros iguales no se mueven; dos vacíos son 0', () => {
    expect(frameShift(null, new Float32Array([1, 2]))).toBe(Infinity);
    expect(frameShift(new Float32Array([1]), new Float32Array([1, 2]))).toBe(Infinity);
    expect(frameShift(new Float32Array([5, 5]), new Float32Array([5, 5]))).toBe(0);
    expect(frameShift(new Float32Array([]), new Float32Array([]))).toBe(0);
  });

  it('promedia la diferencia absoluta píxel a píxel', () => {
    expect(frameShift(new Float32Array([0, 0]), new Float32Array([4, 8]))).toBe(6);
  });
});

describe('evaluateDocFrame: qué falta en el cuadro', () => {
  const ok = (over: Partial<DocFrameQuality> = {}): DocFrameQuality => ({ sharpness: 50, brightness: 128, glare: 0, fill: 0.5, coverage: 0.8, center: 0, ...over });

  it.each([
    ['ok', ok()],
    ['searching', ok({ fill: 0.02 })],
    ['tooFar', ok({ fill: 0.07 })],
    ['tooDark', ok({ brightness: 40 })],
    ['tooBright', ok({ brightness: 240 })],
    ['glare', ok({ glare: 0.1 })],
    // Contenido suficiente pero que no llena la guía (un objeto pequeño o el documento lejos): «Acércate».
    ['tooFar', ok({ coverage: 0.3 })],
    ['straighten', ok({ center: 0.3 })],
    ['blurry', ok({ sharpness: 2 })],
  ] as const)('%s', (expected, quality) => {
    expect(evaluateDocFrame(quality)).toBe(expected);
  });
});

describe('measureDocFrame: mide la región del video (o null si el lienzo está bloqueado)', () => {
  const PIXELS = image(DOC_SAMPLE_SIDE, DOC_SAMPLE_SIDE, () => 128);
  const video = document.createElement('video');
  const region = { x: 0, y: 0, width: 200, height: 140 };
  afterEach(() => vi.restoreAllMocks());

  it('dibuja la región y devuelve las métricas con el gris del cuadro', () => {
    const draw = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: draw,
      getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: PIXELS, width: w, height: h }),
    } as unknown as CanvasRenderingContext2D);
    const measured = measureDocFrame(video, region, 245);
    expect(draw).toHaveBeenCalledWith(video, 0, 0, 200, 140, 0, 0, DOC_SAMPLE_SIDE, DOC_SAMPLE_SIDE);
    expect(measured?.quality.brightness).toBeCloseTo(128, 5);
    expect(measured?.gray).toHaveLength(DOC_SAMPLE_SIDE * DOC_SAMPLE_SIDE);
  });

  it('sin contexto 2D devuelve null', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(measureDocFrame(video, region, 245)).toBeNull();
  });

  it('un lienzo bloqueado (drawImage o getImageData lanza) devuelve null', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: () => {
        throw new Error('blocked');
      },
      getImageData: () => ({ data: PIXELS, width: DOC_SAMPLE_SIDE, height: DOC_SAMPLE_SIDE }),
    } as unknown as CanvasRenderingContext2D);
    expect(measureDocFrame(video, region, 245)).toBeNull();
  });
});
