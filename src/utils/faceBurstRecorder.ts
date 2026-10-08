/**
 * Quien toma la ráfaga de recortes del rostro mientras se escanea (antifraude 2a; reglas puras en `faceBurst.ts`).
 *
 * Sin congelar la pantalla en un iPhone: cada recorte es UN `drawImage` de la zona del rostro a un lienzo de espera
 * (copia en la GPU, sin leer píxeles: nada de `getImageData`), al ritmo de los cuadros NUEVOS del video
 * (`requestVideoFrameCallback`; sin él, un temporizador). La hoja se arma y se codifica una sola vez, al enviar, con
 * `OffscreenCanvas.convertToBlob` donde existe (fuera del hilo de la interfaz) o con `toBlob` (asíncrono). Antes de
 * conocer el reto se recorta con lo de la configuración (más grande y con más margen); al armar la hoja se reduce al
 * lado y al margen que pidió el servidor. Todo vive en memoria y se descarta al enviar.
 */
import type { BurstSpec } from '../types/capture';
import { config } from './config';
import { burstMeta, burstRegion, pickFrames, sheetSize, type BurstRegion, type BurstSegment, type FaceBox, type FaceBurst, type StagedFrame } from './faceBurst';
import { sleep } from './waits';

type Surface = OffscreenCanvas | HTMLCanvasElement;
type Context = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

/** Columnas del lienzo de espera (la hoja final tiene las suyas). */
const STAGE_COLUMNS = 10;
/** Un recorte cuenta si llega al menos al 90 % del intervalo de los cuadros por segundo (tolerancia del reloj). */
const RHYTHM_TOLERANCE = 0.9;
/** Si la hoja pasa del tamaño máximo, se vuelve a codificar UNA vez con esta calidad menos (nunca bajo 0.5). */
const QUALITY_STEP = 0.15;

/** Un lienzo fuera de la pantalla: `OffscreenCanvas` donde existe, si no un `<canvas>` sin montar. */
export function createSurface(width: number, height: number): Surface {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Su contexto 2D, pedido según el tipo de lienzo: `getContext('2d')` sobre la unión de los dos tipos depende del orden en
 * que TypeScript resuelve sus sobrecargas (otro módulo que usa `OffscreenCanvas` antes lo llevaba a la firma genérica).
 */
function context(surface: Surface): Context | null {
  return 'convertToBlob' in surface ? surface.getContext('2d') : surface.getContext('2d');
}

/** El lienzo como JPEG (null si el navegador no pudo codificarlo). */
export function encodeSurface(surface: Surface, quality: number): Promise<Blob | null> {
  if ('convertToBlob' in surface) return surface.convertToBlob({ type: 'image/jpeg', quality }).catch(() => null);
  return new Promise((resolve) => surface.toBlob((blob) => resolve(blob), 'image/jpeg', quality));
}

export class FaceBurstRecorder {
  private stage: Surface | null = null;
  private frames: StagedFrame[] = [];
  private segment: BurstSegment | null = null;
  private region: BurstRegion | null = null;
  private box: FaceBox | null = null;
  private moved = false;
  private last = -Infinity;
  private frameHandle = 0;
  private timer: number | undefined;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly video: () => HTMLVideoElement | null,
    private readonly surfaces: (width: number, height: number) => Surface = createSurface,
  ) {}

  /** Empieza (de cero) el tramo quieto con la zona del rostro en reposo (sin caja: el centro del video). */
  start(box?: FaceBox | null): void {
    this.reset();
    this.box = box ?? null;
    this.record('H');
  }

  /** Pasa al tramo de movimiento (una vez por toma, y solo si hubo tramo quieto). */
  move(): void {
    if (this.moved || this.frames.length === 0) return;
    this.moved = true;
    this.record('M');
  }

  /** Deja de recortar (antes del destello: sus colores cambian la piel; y al capturar el movimiento). */
  pause(): void {
    this.segment = null;
    this.cancel();
  }

  /** Espera (como mucho `config.faceBurstHoldWaitMs`) a que el tramo quieto tenga los recortes que pide el reto. */
  async settle(spec: BurstSpec | null | undefined, signal?: AbortSignal): Promise<void> {
    const deadline = Date.now() + config.faceBurstHoldWaitMs;
    while (spec && this.segment === 'H' && this.count('H') < spec.hold && Date.now() < deadline) {
      await sleep(1000 / config.faceBurstFps, signal);
    }
  }

  /** La hoja y su descripción para el reto (null si no la pide, no hay recortes suficientes o no se pudo codificar). */
  async take(spec: BurstSpec | null | undefined): Promise<FaceBurst | null> {
    this.pause();
    const picked = spec ? pickFrames(this.frames, spec) : [];
    if (!spec || !this.stage || picked.length < spec.min_frames) return null;
    const { width, height, columns } = sheetSize(spec, picked.length);
    const sheet = this.surfaces(width, height);
    const ctx = context(sheet);
    if (!ctx) return null;
    const size = config.faceBurstStagingPx;
    // La zona se recortó con el margen de espera; la hoja lleva el del servidor (el centro de cada recorte).
    const inner = size * Math.min(1, spec.margin / config.faceBurstStagingMargin);
    const offset = (size - inner) / 2;
    picked.forEach((frame, i) => {
      const sx = (frame.slot % STAGE_COLUMNS) * size + offset;
      const sy = Math.floor(frame.slot / STAGE_COLUMNS) * size + offset;
      ctx.drawImage(this.stage as Surface, sx, sy, inner, inner, (i % columns) * spec.tile, Math.floor(i / columns) * spec.tile, spec.tile, spec.tile);
    });
    let image = await encodeSurface(sheet, spec.quality);
    if (image && image.size > spec.max_bytes) image = await encodeSurface(sheet, Math.max(0.5, spec.quality - QUALITY_STEP));
    return image && image.size <= spec.max_bytes ? { image, meta: burstMeta(spec, picked) } : null;
  }

  /** Olvida la toma (otro escaneo empieza de cero). */
  reset(): void {
    this.pause();
    this.frames = [];
    this.moved = false;
    this.region = null;
    this.last = -Infinity;
    this.notify();
  }

  /**
   * Avisa cada recorte nuevo y cada reinicio (para `useSyncExternalStore`): el anillo del visor cuenta las fotos
   * ligeras del tramo quieto sin que la pantalla tenga que preguntar.
   */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  /** Recortes del tramo quieto que lleva la toma (las fotos ligeras mientras la persona mira a la cámara). */
  readonly held = (): number => this.count('H');

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  private count(segment: BurstSegment): number {
    return this.frames.filter((frame) => frame.segment === segment).length;
  }

  private record(segment: BurstSegment): void {
    this.cancel();
    this.segment = segment;
    this.schedule();
  }

  private schedule(): void {
    const video = this.video();
    if (!video || this.segment === null) return;
    if (typeof video.requestVideoFrameCallback === 'function') {
      this.frameHandle = video.requestVideoFrameCallback((now) => this.tick(now));
    } else {
      this.timer = window.setTimeout(() => this.tick(performance.now()), 1000 / config.faceBurstFps);
    }
  }

  private cancel(): void {
    window.clearTimeout(this.timer);
    const video = this.video();
    if (this.frameHandle && video && typeof video.cancelVideoFrameCallback === 'function') video.cancelVideoFrameCallback(this.frameHandle);
    this.frameHandle = 0;
  }

  /** Un cuadro nuevo del video: se recorta si ya toca (ritmo de la ráfaga) y queda espacio. */
  private tick(now: number): void {
    if (this.segment === null) return;
    if (now - this.last >= (RHYTHM_TOLERANCE * 1000) / config.faceBurstFps && this.frames.length < config.faceBurstMaxFrames) {
      this.crop(now, this.segment);
    }
    this.schedule();
  }

  private crop(now: number, segment: BurstSegment): void {
    const video = this.video();
    if (!video?.videoWidth || !video.videoHeight) return;
    const size = config.faceBurstStagingPx;
    this.region ??= burstRegion(this.box, video.videoWidth, video.videoHeight, config.faceBurstStagingMargin);
    this.stage ??= this.surfaces(STAGE_COLUMNS * size, Math.ceil(config.faceBurstMaxFrames / STAGE_COLUMNS) * size);
    const ctx = context(this.stage);
    if (!ctx) return;
    const slot = this.frames.length;
    const { x, y, side } = this.region;
    ctx.drawImage(video, x, y, side, side, (slot % STAGE_COLUMNS) * size, Math.floor(slot / STAGE_COLUMNS) * size, size, size);
    this.frames.push({ slot, t: now, segment });
    this.last = now;
    this.notify();
  }
}
