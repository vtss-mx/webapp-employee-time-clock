import type { AvatarCrop } from '../types/avatar';
import { config } from './config';

/**
 * Reglas puras del recorte de la foto de perfil (sin React ni DOM): la vista es el acercamiento y el centro del
 * cuadrado en píxeles de la imagen (ya orientada, como la dibuja el navegador). El backend recibe el cuadrado
 * (`cropBox`) y vuelve a validarlo; aquí solo se evita pedir algo que rechazaría.
 */

/** Ancho y alto de la imagen (`naturalWidth`/`naturalHeight`: con la orientación del teléfono aplicada). */
export interface Natural {
  width: number;
  height: number;
}

/** Acercamiento (1 = el cuadrado más grande que cabe) y centro del recorte. */
export interface CropView {
  zoom: number;
  cx: number;
  cy: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const shortSide = ({ width, height }: Natural) => Math.min(width, height);

/** ¿La imagen alcanza el lado mínimo que acepta el servidor? */
export function bigEnough(natural: Natural): boolean {
  return shortSide(natural) >= config.avatarMinSidePx;
}

/** Acercamiento máximo: hasta `avatarMaxZoom`, sin que el recorte baje del lado mínimo del servidor. */
export function maxZoom(natural: Natural): number {
  return clamp(shortSide(natural) / config.avatarMinSidePx, 1, config.avatarMaxZoom);
}

/** Lado del cuadrado (px de la imagen) con un acercamiento. */
export function sideOf(natural: Natural, zoom: number): number {
  return shortSide(natural) / zoom;
}

/** La vista dentro de sus límites: el cuadrado nunca sale de la imagen. */
export function clampView(natural: Natural, view: CropView): CropView {
  const zoom = clamp(view.zoom, 1, maxZoom(natural));
  const half = sideOf(natural, zoom) / 2;
  return { zoom, cx: clamp(view.cx, half, natural.width - half), cy: clamp(view.cy, half, natural.height - half) };
}

/** Al elegir una foto: el cuadrado más grande, al centro. */
export function initialView(natural: Natural): CropView {
  return { zoom: 1, cx: natural.width / 2, cy: natural.height / 2 };
}

/** Mover la foto `dx`, `dy` píxeles de la pantalla dentro de un recuadro de `viewport` píxeles. */
export function panView(natural: Natural, view: CropView, dx: number, dy: number, viewport: number): CropView {
  const perPixel = sideOf(natural, view.zoom) / Math.max(1, viewport);
  return clampView(natural, { ...view, cx: view.cx - dx * perPixel, cy: view.cy - dy * perPixel });
}

/** Otro acercamiento con el mismo centro. */
export function zoomView(natural: Natural, view: CropView, zoom: number): CropView {
  return clampView(natural, { ...view, zoom });
}

/** El cuadrado que se envía: píxeles enteros, siempre dentro de la imagen. */
export function cropBox(natural: Natural, view: CropView): AvatarCrop {
  const size = Math.max(1, Math.floor(sideOf(natural, view.zoom)));
  const x = clamp(Math.round(view.cx - size / 2), 0, natural.width - size);
  const y = clamp(Math.round(view.cy - size / 2), 0, natural.height - size);
  return { x, y, size };
}

/**
 * Posición de la imagen dentro del recuadro cuadrado, en porcentajes del recuadro (no hace falta medirlo: sirve
 * igual en un teléfono que en una pantalla grande y en la vista previa de la confirmación).
 */
export function imagePlacement(natural: Natural, view: CropView): { width: string; left: string; top: string } {
  const side = sideOf(natural, view.zoom);
  const percent = (value: number) => `${((value / side) * 100).toFixed(3)}%`;
  return { width: percent(natural.width), left: percent(side / 2 - view.cx), top: percent(side / 2 - view.cy) };
}
