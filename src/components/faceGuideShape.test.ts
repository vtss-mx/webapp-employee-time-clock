import { describe, expect, it } from 'vitest';
import { GUIDE_VIEWBOX, guideTarget, HAIRLINE_PATH, HEAD_PATH, SHOULDERS_PATH, TARGET_BOX } from './faceGuideShape';

/*
 * La guía del rostro (decisión del dueño, 2026-10-07): la geometría que se dibuja es la que se exige. Aquí, cómo la caja
 * objetivo del dibujo (cuadro de 200) se lleva a píxeles del video con la geometría real de la página.
 */
const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => '' }) as DOMRect;

describe('faceGuideShape: la guía y su caja objetivo', () => {
  it('el contorno es un rostro (óvalo con mentón, cabello y hombros) y la caja objetivo cabe dentro del óvalo', () => {
    expect(HEAD_PATH.startsWith('M100 24') && HEAD_PATH.endsWith('Z')).toBe(true); // cerrado y centrado en x = 100
    expect(HAIRLINE_PATH.startsWith('M60 82')).toBe(true);
    expect(SHOULDERS_PATH.split('M')).toHaveLength(3); // dos trazos
    expect(TARGET_BOX.x).toBeGreaterThanOrEqual(44); // dentro del ancho del óvalo (x 44-156)
    expect(TARGET_BOX.x + TARGET_BOX.width).toBeLessThanOrEqual(156);
    expect(TARGET_BOX.y + TARGET_BOX.height).toBeLessThanOrEqual(172); // hasta el mentón
    expect(GUIDE_VIEWBOX).toBe(200);
  });

  it('sin geometría de la página, la guía es el círculo inscrito y centrado en el video', () => {
    const video = { videoWidth: 640, videoHeight: 480 };
    const target = guideTarget(video, null, null);
    // Círculo de 480 px (unidad 2.4): la caja objetivo escalada y desplazada al centro del video.
    expect(target).toEqual({ x: 80 + 50 * 2.4, y: 66 * 2.4, width: 240, height: 106 * 2.4 });
    expect(guideTarget(video, rect(0, 0, 0, 0), rect(0, 0, 300, 300))).toEqual(target); // un video sin tamaño en la página
    expect(guideTarget(video, rect(0, 0, 300, 0), rect(0, 0, 300, 300))).toEqual(target); // un video sin alto
    expect(guideTarget(video, rect(0, 0, 300, 400), rect(0, 0, 0, 0))).toEqual(target); // la guía aún sin medir
    // En vertical (teléfono) el círculo inscrito es el ancho del video.
    expect(guideTarget({ videoWidth: 480, videoHeight: 640 }, null, null)).toEqual({ x: 50 * 2.4, y: 80 + 66 * 2.4, width: 240, height: 106 * 2.4 });
  });

  it('con la página medida, la caja se lleva del círculo dibujado a los píxeles del video (object-fit: cover)', () => {
    // Video de 640 × 480 mostrado en 300 × 400 (vertical): se escala a 400/480 = 0.8333 y se recorta a los lados.
    const video = { videoWidth: 640, videoHeight: 480 };
    const videoRect = rect(100, 50, 300, 400);
    const guideRect = rect(130, 150, 240, 240); // círculo de 240 px, centrado en el video (x 100-400)
    const target = guideTarget(video, videoRect, guideRect);
    const scale = 400 / 480;
    const unit = 240 / 200;
    const offsetX = 100 + (300 - 640 * scale) / 2;
    expect(target.x).toBeCloseTo((130 + 50 * unit - offsetX) / scale);
    expect(target.y).toBeCloseTo((150 + 66 * unit - 50) / scale);
    expect(target.width).toBeCloseTo((100 * unit) / scale);
    expect(target.height).toBeCloseTo((106 * unit) / scale);
    // La caja queda horizontalmente centrada en el video: el espejo de la cámara frontal no la cambia.
    expect(target.x + target.width / 2).toBeCloseTo(320);
  });

  it('con el video dibujado respecto al círculo (su relación de aspecto, lado corto = 1.3 diámetros, mismo centro) la guía cae en el centro del cuadro sin recorte que compensar', () => {
    // Flujo 16:9 de una computadora portátil; círculo de 500 px centrado en (600, 400). El video mide 1.3 × 500 = 650 de
    // alto y 650 × 16/9 ≈ 1155.6 de ancho, centrado en el mismo punto, aunque sobresalga del visor (que lo recorta).
    const video = { videoWidth: 1280, videoHeight: 720 };
    const diameter = 500;
    const short = diameter * 1.3;
    const videoRect = rect(600 - (short * 16) / 9 / 2, 400 - short / 2, (short * 16) / 9, short);
    const guideRect = rect(600 - diameter / 2, 400 - diameter / 2, diameter, diameter);
    const target = guideTarget(video, videoRect, guideRect);
    const scale = short / 720; // = videoRect.width / 1280: los dos factores coinciden
    const unit = diameter / 200;
    expect(target.width).toBeCloseTo((100 * unit) / scale);
    expect(target.height).toBeCloseTo((106 * unit) / scale);
    expect(target.x + target.width / 2).toBeCloseTo(640); // centrado en el cuadro
    // El centro vertical de la caja objetivo queda donde la guía lo dibuja (bajo el centro del óvalo), en píxeles del video.
    expect(target.y + target.height / 2).toBeCloseTo(360 + ((66 + 53 - 100) * unit) / scale);
    // Un flujo vertical de teléfono (9:16): el lado corto es el ancho y la cuenta es la misma.
    const portrait = guideTarget({ videoWidth: 720, videoHeight: 1280 }, rect(600 - short / 2, 400 - (short * 16) / 9 / 2, short, (short * 16) / 9), guideRect);
    expect(portrait.width).toBeCloseTo(target.width);
    expect(portrait.x + portrait.width / 2).toBeCloseTo(360);
  });
});
