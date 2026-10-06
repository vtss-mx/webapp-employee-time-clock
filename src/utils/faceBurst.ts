/**
 * Ráfaga corta de recortes del rostro (antifraude 2a, decisión D11 del dueño del producto; `docs/rd` §2.2).
 *
 * Mientras se escanea, la app recorta la zona del rostro unas diez veces por segundo: un tramo QUIETO (de frente, mientras
 * se valida la toma) y un tramo de MOVIMIENTO (el primer movimiento del reto). Los recortes viajan con las capturas en
 * UNA hoja JPEG (una cuadrícula de `tile` px) y su descripción; el servidor mide con ellos continuidad, micromovimiento
 * natural y pulso, y los descarta (nunca se guardan). Lo que pide (lado, cuántos, calidad, margen) lo dice el reto
 * (`BurstSpec`).
 *
 * Funciones puras: la zona a recortar, qué recortes van a la hoja y su descripción (versión 1 del contrato del
 * backend, `app/schemas/capture.py`).
 */
import type { BurstSpec } from '../types/capture';

export type BurstSegment = 'H' | 'M';

/** Un recorte guardado: su lugar en el lienzo de espera, cuándo se tomó (ms) y su tramo. */
export interface StagedFrame {
  slot: number;
  t: number;
  segment: BurstSegment;
}

/** Zona cuadrada del video que se recorta (px del video). */
export interface BurstRegion {
  x: number;
  y: number;
  side: number;
}

/** Caja del rostro en px del video. */
export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** La hoja lista para enviarse con las capturas. */
export interface FaceBurst {
  image: Blob;
  meta: string;
}

/** Columnas de la hoja (una cuadrícula ancha y baja: 40 recortes de 112 px caben en 896 × 560 px). */
export const SHEET_COLUMNS = 8;
/** Sin rostro medido (detección manual), se recorta el centro: esta fracción del lado menor del video. */
const CENTER_FRACTION = 0.6;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** La zona cuadrada alrededor del rostro (`margin` veces su lado), dentro del cuadro; sin rostro, el centro. */
export function burstRegion(box: FaceBox | null | undefined, width: number, height: number, margin: number): BurstRegion {
  const limit = Math.min(width, height);
  const side = Math.max(1, Math.round(Math.min(limit, box ? Math.max(box.width, box.height) * margin : limit * CENTER_FRACTION)));
  const cx = box ? box.x + box.width / 2 : width / 2;
  const cy = box ? box.y + box.height / 2 : height / 2;
  return { x: Math.round(clamp(cx - side / 2, 0, width - side)), y: Math.round(clamp(cy - side / 2, 0, height - side)), side };
}

/**
 * Los recortes de la hoja: los ÚLTIMOS `hold` del tramo quieto (contiguos, los más cercanos al destello: el pulso
 * necesita una serie sin huecos) y los PRIMEROS `move` del de movimiento.
 */
export function pickFrames(frames: readonly StagedFrame[], spec: BurstSpec): StagedFrame[] {
  const holds = frames.filter((frame) => frame.segment === 'H');
  const moves = frames.filter((frame) => frame.segment === 'M');
  return [...holds.slice(Math.max(0, holds.length - spec.hold)), ...moves.slice(0, spec.move)];
}

/** Medidas de la hoja para `count` recortes. */
export function sheetSize(spec: BurstSpec, count: number): { width: number; height: number; columns: number } {
  const columns = Math.max(1, Math.min(SHEET_COLUMNS, count));
  return { width: columns * spec.tile, height: Math.ceil(count / columns) * spec.tile, columns };
}

/** La descripción de la hoja: lado, columnas, el instante de cada recorte (ms desde el primero) y su tramo. */
export function burstMeta(spec: BurstSpec, frames: readonly StagedFrame[]): string {
  const start = frames[0]?.t ?? 0;
  return JSON.stringify({
    v: 1,
    tile: spec.tile,
    cols: sheetSize(spec, frames.length).columns,
    t: frames.map((frame) => Math.round(frame.t - start)),
    s: frames.map((frame) => frame.segment).join(''),
  });
}
