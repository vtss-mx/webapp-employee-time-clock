import { sleep } from './waits';

/** Pausa antes de repetir una descarga de código que falló (p. ej. un corte breve de la red). */
const RETRY_DELAY_MS = 1_000;

/**
 * Importa un módulo diferido (`() => import(...)`) y, si la descarga falla, lo intenta una vez más
 * tras una pausa: un corte breve de red no deja sin cargar una pantalla o una función.
 */
export async function importWithRetry<T>(load: () => Promise<T>, delayMs = RETRY_DELAY_MS): Promise<T> {
  try {
    return await load();
  } catch {
    await sleep(delayMs);
    return load();
  }
}
