/*
 * Calidad de un cuadro del video ANTES de contarlo como foto válida del registro facial (decisión del dueño,
 * 2026-10-06: «32 fotos válidas, no 32 intentos»; una borrosa, oscura o quemada no cuenta). Es la revisión barata del
 * navegador, igual a la que hará el servidor sobre cada foto (`FACE_MIN_SHARPNESS`, `FACE_MIN_BRIGHTNESS`,
 * `FACE_MAX_BRIGHTNESS` de `pipeline.py`): nitidez por la varianza del Laplaciano y brillo medio, sobre el rostro en
 * gris a 96 px (9 216 píxeles: ≈ 0.1 ms; el detector ya dice si el rostro está completo, centrado y de frente).
 */

/** Lo medido de un cuadro: nitidez (varianza del Laplaciano, 0 = plano) y brillo medio (0-255). */
export interface FrameQuality {
  sharpness: number;
  brightness: number;
}

/** Lado del recorte en gris con que se mide (el mismo para cualquier cámara: la nitidez es comparable). */
export const QUALITY_SIDE = 96;
/** Brillo medio aceptado (los mismos límites del servidor: 40 y 225 en 0-255). */
export const MIN_BRIGHTNESS = 40;
export const MAX_BRIGHTNESS = 225;

/** Nitidez y brillo de una imagen RGBA (`ImageData.data`) de `width` × `height`. */
export function frameQuality(data: Uint8ClampedArray, width: number, height: number): FrameQuality {
  const gray = new Float32Array(width * height);
  let sum = 0;
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    const value = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    gray[i] = value;
    sum += value;
  }
  // Laplaciano de 4 vecinos (|∇²|) en el interior; su varianza crece con los bordes nítidos.
  let count = 0;
  let mean = 0;
  let m2 = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = gray[i - width] + gray[i + width] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      count++;
      const delta = lap - mean;
      mean += delta / count;
      m2 += delta * (lap - mean);
    }
  }
  return { sharpness: count > 1 ? m2 / count : 0, brightness: gray.length ? sum / gray.length : 0 };
}

/** ¿El cuadro sirve como foto del registro? (nítido y con luz, con el mínimo de nitidez que fija la configuración). */
export function isUsableFrame(quality: FrameQuality, minSharpness: number): boolean {
  return quality.sharpness >= minSharpness && quality.brightness >= MIN_BRIGHTNESS && quality.brightness <= MAX_BRIGHTNESS;
}

/**
 * ¿El cuadro actual del video, en la caja del rostro (la del detector), está ENFOCADO y con luz? (decisión del dueño,
 * 2026-10-07: el borde de la guía va en rojo si no está enfocado). `null` si no se pudo medir (sin video o lienzo
 * bloqueado contra huellas): no se descarta por calidad (el servidor sigue revisando).
 */
export function faceFrameSharpness(video: HTMLVideoElement | null, box: { originX: number; originY: number; width: number; height: number }, minSharpness: number): boolean | null {
  if (!video) return null;
  const quality = measureVideoFrame(video, { x: box.originX, y: box.originY, width: box.width, height: box.height });
  return quality === null ? null : isUsableFrame(quality, minSharpness);
}

let canvas: HTMLCanvasElement | null = null;

/**
 * Mide el cuadro actual del video (la zona del rostro si se conoce, si no el centro). null si el lienzo no se puede leer
 * (el navegador lo bloquea contra huellas): entonces no se descarta nada por calidad (el servidor sigue revisando).
 */
export function measureVideoFrame(video: HTMLVideoElement, box?: { x: number; y: number; width: number; height: number } | null): FrameQuality | null {
  canvas ??= document.createElement('canvas');
  canvas.width = QUALITY_SIDE;
  canvas.height = QUALITY_SIDE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const side = Math.min(vw, vh) * 0.5;
  const region = box ?? { x: (vw - side) / 2, y: (vh - side) / 2, width: side, height: side };
  try {
    ctx.drawImage(video, region.x, region.y, region.width, region.height, 0, 0, QUALITY_SIDE, QUALITY_SIDE);
    const { data } = ctx.getImageData(0, 0, QUALITY_SIDE, QUALITY_SIDE);
    return frameQuality(data, QUALITY_SIDE, QUALITY_SIDE);
  } catch {
    return null;
  }
}
