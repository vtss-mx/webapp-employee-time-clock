import { isOutdated, reloadApp } from './versionService';

/**
 * Hora (ms) de la última recarga por versión nueva, en el estado del historial de ESTA pestaña
 * (`history.state`): sobrevive a la recarga y no usa almacenamiento del navegador.
 */
const RELOAD_MARK = 'tcReloadedAt';
/**
 * Tras recargar no se vuelve a recargar durante este tiempo: si la versión nueva tampoco carga (p. ej.
 * una publicación a medias), la pantalla muestra "Reintentar" en lugar de recargar en ciclo.
 */
const RELOAD_GUARD_MS = 5 * 60_000;

function historyState(): Record<string, unknown> {
  const state: unknown = window.history.state;
  return typeof state === 'object' && state !== null ? (state as Record<string, unknown>) : {};
}

/** Reserva la recarga: false si ya hubo una hace poco o si el historial no se puede marcar (no se podría evitar el ciclo). */
function claimReload(now: number): boolean {
  const last = Number(historyState()[RELOAD_MARK]);
  if (last > 0 && now - last < RELOAD_GUARD_MS) return false;
  try {
    window.history.replaceState({ ...historyState(), [RELOAD_MARK]: now }, '');
  } catch {
    return false;
  }
  return historyState()[RELOAD_MARK] === now;
}

/**
 * Un módulo de la aplicación no se pudo descargar (pantalla, detector facial, generador de QR...).
 * Solo si ya se publicó una versión nueva (los archivos de esta ya no existen en el servidor) se
 * recarga, una vez; si fue la red, no se recarga: el error llega a quien importó el módulo y ahí se
 * ofrece reintentar (recargar sin conexión dejaría la página del navegador sin la app).
 */
export async function reloadForNewVersion(): Promise<boolean> {
  if (!(await isOutdated()) || !claimReload(Date.now())) return false;
  reloadApp();
  return true;
}

/** La aplicación ya cargó bien sus pantallas: una falla futura (otra publicación) puede volver a recargar. */
export function clearReloadMark(): void {
  const { [RELOAD_MARK]: mark, ...rest } = historyState();
  if (mark !== undefined) window.history.replaceState(rest, '');
}
