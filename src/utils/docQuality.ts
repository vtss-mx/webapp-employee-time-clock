/*
 * Calidad de un cuadro del video para la captura con cámara del documento de identidad (`DocumentScanner`), análoga a
 * `frameQuality.ts` del registro facial: la revisión barata del navegador antes de tomar la foto. El servidor vuelve a
 * revisar la imagen y la lee con OCR; esto solo guía a la persona y dispara la captura automática cuando el documento
 * está bien encuadrado. Reutiliza la nitidez (varianza del Laplaciano) y el brillo de `frameQuality` y añade, para un
 * documento: reflejos (fracción de píxeles casi saturados), llenado (densidad de contenido —bordes y texto— dentro de
 * la guía, sin librería pesada de detección de bordes), cobertura (cuánto del lado de la guía ocupa la caja de
 * contenido) y centrado (dónde cae esa caja respecto a la guía).
 *
 * La captura automática exige una señal CLARAMENTE de documento, no solo un cuadro nítido y con luz (decisión del dueño,
 * 2026-10-08: dejaba de tomar fotos «a lo pendejo»): el contenido debe tener suficiente densidad (`fill`) Y llenar la
 * mayor parte de la guía (`coverage`), además de estar centrado, derecho, enfocado, con luz y sin reflejos. Así un
 * objeto pequeño, una mano o un logotipo suelto en una pared no disparan la foto; el obturador manual y el respaldo por
 * inactividad siguen disponibles (nunca un callejón sin salida).
 *
 * NO hay recorte ni enderezado automáticos (eso necesitaría detectar el cuadrilátero del documento, p. ej. con OpenCV.js:
 * una dependencia pesada, decisión del dueño): la guía es solo visual y la foto es el cuadro completo. Esto queda para
 * una v2.
 */
import { config } from './config';
import { frameQuality } from './frameQuality';

/** Lado del recorte en gris con que se mide (≈25 k píxeles: barato por cuadro, como el 96 px del rostro). */
export const DOC_SAMPLE_SIDE = 160;
/** Parte del video (lado) que abarca la región medida; debe coincidir con la guía que dibuja el CSS (`--doc-inset`). */
export const DOC_GUIDE_INSET = 0.82;
/** |Laplaciano| (0-255) que cuenta como «contenido» de un documento (un borde o un trazo de texto) al medir el llenado. */
const EDGE_MIN = 10;
/** Un renglón o una columna «tiene contenido» si su densidad de bordes llega a esta parte del máximo (para la caja). */
const CONTENT_GATE = 0.15;

/** Lo medido de un cuadro dentro de la guía. */
export interface DocFrameQuality {
  /** Varianza del Laplaciano (0 = plano/borroso). */
  sharpness: number;
  /** Brillo medio (0-255). */
  brightness: number;
  /** Fracción de píxeles casi saturados (reflejo). 0-1. */
  glare: number;
  /** Fracción de píxeles con borde/texto (densidad de contenido del documento). 0-1. */
  fill: number;
  /** Cuánto del lado de la guía ocupa la caja de contenido (el menor de ancho y alto): un documento llena la guía. 0-1. */
  coverage: number;
  /** Distancia del centro de la caja de contenido al centro de la guía, como parte del lado. 0-~0.5. */
  center: number;
}

/** Veredicto del cuadro: `ok` sirve (solo falta la quietud); los demás son la indicación que ve la persona. */
export type DocCheck = 'ok' | 'searching' | 'tooFar' | 'tooDark' | 'tooBright' | 'glare' | 'straighten' | 'blurry';
/** Indicación que se muestra (el bucle convierte `ok` en `holdStill`/`capturing` y `blurry` en `holdStill`). */
export type DocGuidance = 'searching' | 'tooFar' | 'tooDark' | 'tooBright' | 'glare' | 'straighten' | 'holdStill' | 'capturing';

/** Región del video (px) que mide la guía: centrada, con la relación de aspecto de la guía, dentro del recuadro de inset. */
export function docGuideRegion(videoWidth: number, videoHeight: number, aspect: number, inset: number = DOC_GUIDE_INSET): { x: number; y: number; width: number; height: number } {
  const width = Math.min(videoWidth * inset, videoHeight * inset * aspect);
  const height = width / aspect;
  return { x: (videoWidth - width) / 2, y: (videoHeight - height) / 2, width, height };
}

/** Extremos (primero y último índice) con contenido en un perfil de bordes; `null` si el perfil está vacío. */
function contentSpan(profile: Float32Array): { lo: number; hi: number } | null {
  let max = 0;
  for (let i = 0; i < profile.length; i++) if (profile[i] > max) max = profile[i];
  if (max === 0) return null;
  const gate = max * CONTENT_GATE;
  let lo = -1;
  let hi = -1;
  for (let i = 0; i < profile.length; i++) {
    if (profile[i] >= gate) {
      if (lo < 0) lo = i;
      hi = i;
    }
  }
  return { lo, hi };
}

/**
 * Caja de contenido respecto a la guía: qué tan descentrada está (`center`, 0-~0.5) y cuánto del lado ocupa
 * (`coverage`, el menor de ancho y alto, 0-1). Sin contenido, centrada y con cobertura 0 (el llenado ya lo descarta).
 */
function contentBox(rowEdges: Float32Array, colEdges: Float32Array, width: number, height: number): { center: number; coverage: number } {
  const rows = contentSpan(rowEdges);
  const cols = contentSpan(colEdges);
  if (!rows || !cols) return { center: 0, coverage: 0 };
  const cx = (cols.lo + cols.hi) / 2;
  const cy = (rows.lo + rows.hi) / 2;
  const center = Math.max(Math.abs(cx - (width - 1) / 2) / width, Math.abs(cy - (height - 1) / 2) / height);
  const coverage = Math.min((cols.hi - cols.lo + 1) / width, (rows.hi - rows.lo + 1) / height);
  return { center, coverage };
}

/**
 * Métricas de una imagen RGBA (`ImageData.data`) de `width` × `height`, más el gris para comparar la quietud entre
 * cuadros. La nitidez y el brillo reutilizan `frameQuality`; reflejos, llenado y centrado se calculan aquí.
 */
export function docFrameMetrics(data: Uint8ClampedArray, width: number, height: number, glareLevel: number): { quality: DocFrameQuality; gray: Float32Array } {
  const { sharpness, brightness } = frameQuality(data, width, height);
  const gray = new Float32Array(width * height);
  let glareCount = 0;
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    const value = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    gray[i] = value;
    if (value >= glareLevel) glareCount++;
  }
  // Densidad de bordes (|Laplaciano| de 4 vecinos) en el interior, con el perfil por renglón y columna para la caja.
  const rowEdges = new Float32Array(height);
  const colEdges = new Float32Array(width);
  let edges = 0;
  let interior = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = Math.abs(gray[i - width] + gray[i + width] + gray[i - 1] + gray[i + 1] - 4 * gray[i]);
      interior++;
      if (lap > EDGE_MIN) {
        edges++;
        rowEdges[y]++;
        colEdges[x]++;
      }
    }
  }
  const fill = interior ? edges / interior : 0;
  const { center, coverage } = contentBox(rowEdges, colEdges, width, height);
  return { quality: { sharpness, brightness, glare: gray.length ? glareCount / gray.length : 0, fill, coverage, center }, gray };
}

let canvas: HTMLCanvasElement | null = null;

/**
 * Mide la región de la guía del cuadro actual del video. `null` si el lienzo no se puede leer (el navegador lo bloquea
 * contra huellas): entonces no se mide (el obturador manual sigue disponible; el servidor revisa la imagen).
 */
export function measureDocFrame(video: HTMLVideoElement, region: { x: number; y: number; width: number; height: number }, glareLevel: number): { quality: DocFrameQuality; gray: Float32Array } | null {
  canvas ??= document.createElement('canvas');
  canvas.width = DOC_SAMPLE_SIDE;
  canvas.height = DOC_SAMPLE_SIDE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  try {
    ctx.drawImage(video, region.x, region.y, region.width, region.height, 0, 0, DOC_SAMPLE_SIDE, DOC_SAMPLE_SIDE);
    const { data } = ctx.getImageData(0, 0, DOC_SAMPLE_SIDE, DOC_SAMPLE_SIDE);
    return docFrameMetrics(data, DOC_SAMPLE_SIDE, DOC_SAMPLE_SIDE, glareLevel);
  } catch {
    return null;
  }
}

/** Desplazamiento medio (0-255) entre dos cuadros en gris; `Infinity` si no hay cuadro anterior o cambió el tamaño. */
export function frameShift(previous: Float32Array | null, next: Float32Array): number {
  if (!previous || previous.length !== next.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < next.length; i++) sum += Math.abs(next[i] - previous[i]);
  return next.length ? sum / next.length : 0;
}

/**
 * ¿Sirve el cuadro para tomar la foto? Orden: que haya documento y llene la guía (densidad `fill` + cobertura
 * `coverage`, la señal de que es un documento y no un objeto cualquiera) → luz → sin reflejos → derecho → enfocado. Lo
 * que falla es la indicación que ve la persona (los límites viven en `config`, como la calidad facial).
 */
export function evaluateDocFrame(quality: DocFrameQuality): DocCheck {
  if (quality.fill < config.docScanMinFill) return quality.fill < config.docScanMinFill * 0.4 ? 'searching' : 'tooFar';
  if (quality.brightness < config.docScanMinBrightness) return 'tooDark';
  if (quality.brightness > config.docScanMaxBrightness) return 'tooBright';
  if (quality.glare > config.docScanGlareMax) return 'glare';
  // El contenido existe pero no llena la guía: es un objeto pequeño o el documento está lejos, no un documento completo.
  if (quality.coverage < config.docScanMinCoverage) return 'tooFar';
  if (quality.center > config.docScanCenterMax) return 'straighten';
  if (quality.sharpness < config.docScanMinSharpness) return 'blurry';
  return 'ok';
}
