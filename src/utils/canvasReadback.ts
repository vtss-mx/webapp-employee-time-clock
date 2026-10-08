/**
 * ¿El navegador entrega la imagen REAL de un lienzo? (compatibilidad universal, `docs/rd/compatibilidad-biometria.md`).
 *
 * Todo el flujo facial y el lector de QR leen los píxeles de la cámara a través de un lienzo: la detección del rostro,
 * su luz, las capturas que van al servidor y la imagen del QR. Algunos navegadores alteran esa lectura para impedir la
 * huella digital del navegador:
 * - "resistFingerprinting" de Firefox (Tor Browser, Mullvad Browser, LibreWolf) entrega datos AL AZAR: no hay rostro
 *   que encontrar ni QR que leer, y la persona se quedaría frente a "Coloca tu rostro" sin saber por qué.
 * - La protección de huellas de Firefox (ventanas privadas desde la 120 y normales desde la 151) cambia unos cuantos
 *   píxeles y Brave cambia apenas sus bits más bajos: no estorban (ni al detector ni a los candados del servidor).
 *
 * Por eso se mide solo lo que rompe: se pinta un color liso y se lee de vuelta; si más de una cuarta parte de los
 * píxeles llega lejos de ese color, la lectura está alterada. Usa `OffscreenCanvas` (todos los navegadores que soporta la
 * app): sin él, o sin contexto 2D, no se acusa nada (no se puede medir).
 */

/** Color de la prueba (RGB). */
const PROBE: readonly [number, number, number] = [16, 160, 64];
/** Lado del lienzo de prueba (px). */
const SIDE = 16;
/** Diferencia por canal que ya no es un retoque (el ruido de Firefox o de Brave cambia unos cuantos niveles). */
const TOLERANCE = 24;
/** Fracción de píxeles alterados desde la que la lectura no sirve. */
const ALTERED_SHARE = 0.25;

/** true si el navegador altera la lectura de los lienzos al grado de no poder ver la cámara. */
export function canvasReadbackBlocked(): boolean {
  if (typeof OffscreenCanvas === 'undefined') return false;
  const context = new OffscreenCanvas(SIDE, SIDE).getContext('2d', { willReadFrequently: true });
  if (!context) return false;
  context.fillStyle = `rgb(${PROBE.join(', ')})`;
  context.fillRect(0, 0, SIDE, SIDE);
  let data: Uint8ClampedArray;
  try {
    data = context.getImageData(0, 0, SIDE, SIDE).data;
  } catch {
    return true; // el navegador prohíbe leerlo
  }
  let altered = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (PROBE.some((value, channel) => Math.abs(data[i + channel] - value) > TOLERANCE)) altered++;
  }
  return altered > ALTERED_SHARE * SIDE * SIDE;
}
