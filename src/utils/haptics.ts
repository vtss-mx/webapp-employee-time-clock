/**
 * Vibración breve como confirmación táctil (teléfonos Android). En iOS y en computadoras la
 * API no existe y no hace nada.
 */
export function haptic(kind: 'success' | 'error'): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(kind === 'success' ? 18 : [40, 60, 40]);
  } catch {
    /* sin soporte o bloqueado por el navegador */
  }
}
