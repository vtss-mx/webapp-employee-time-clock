import { describe, expect, it } from 'vitest';
import { bigEnough, clampView, cropBox, imagePlacement, initialView, maxZoom, panView, sideOf, zoomView } from './avatarCrop';
import { config } from './config';

const landscape = { width: 1000, height: 600 };

describe('recorte de la foto de perfil (reglas puras)', () => {
  it('empieza con el cuadrado más grande al centro y lo envía en píxeles enteros dentro de la imagen', () => {
    const view = initialView(landscape);
    expect(view).toEqual({ zoom: 1, cx: 500, cy: 300 });
    expect(cropBox(landscape, view)).toEqual({ x: 200, y: 0, size: 600 });
    expect(imagePlacement(landscape, view)).toEqual({ width: '166.667%', left: '-33.333%', top: '0.000%' });
  });

  it('acercar achica el cuadrado sin bajar del lado mínimo del servidor ni pasar el tope', () => {
    expect(maxZoom(landscape)).toBe(600 / config.avatarMinSidePx);
    expect(maxZoom({ width: 8000, height: 6000 })).toBe(config.avatarMaxZoom);
    expect(maxZoom({ width: 100, height: 100 })).toBe(1);
    const closer = zoomView(landscape, initialView(landscape), 2);
    expect(sideOf(landscape, closer.zoom)).toBe(300);
    expect(cropBox(landscape, closer)).toEqual({ x: 350, y: 150, size: 300 });
    expect(zoomView(landscape, closer, 99).zoom).toBe(maxZoom(landscape));
    expect(zoomView(landscape, closer, 0.2).zoom).toBe(1);
  });

  it('mover la foto nunca saca el cuadrado de la imagen (también al alejar en una orilla)', () => {
    const closer = zoomView(landscape, initialView(landscape), 2);
    // Arrastrar 100 px a la izquierda en un recuadro de 300 px mueve el cuadrado 100 px de la imagen a la derecha.
    expect(panView(landscape, closer, -100, 0, 300)).toMatchObject({ cx: 600, cy: 300 });
    expect(panView(landscape, closer, -10_000, 10_000, 300)).toMatchObject({ cx: 850, cy: 150 });
    expect(panView(landscape, closer, 5, 5, 0).cx).toBeLessThan(closer.cx); // recuadro sin medir: 1 px
    const corner = clampView(landscape, { zoom: 2, cx: 850, cy: 150 });
    expect(zoomView(landscape, corner, 1)).toMatchObject({ zoom: 1, cx: 700, cy: 300 });
  });

  it('una imagen menor que el lado mínimo no alcanza', () => {
    expect(bigEnough(landscape)).toBe(true);
    expect(bigEnough({ width: 1000, height: config.avatarMinSidePx - 1 })).toBe(false);
  });
});
