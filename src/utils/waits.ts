/**
 * Esperas de los reintentos automáticos (única implementación): una pausa que termina antes si se
 * cancela, y la espera a que vuelva la conexión.
 */

/** Pausa de `ms`; termina en cuanto `signal` se cancela (no se sigue esperando en vano). */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      window.clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const timer = window.setTimeout(done, ms);
    signal?.addEventListener('abort', done);
  });
}

/**
 * Se resuelve cuando el dispositivo tiene conexión: al instante si ya la tiene; si no, al llegar el
 * evento `online`. Así un reintento automático no gasta intentos (ni sube datos) mientras no hay red.
 */
export function whenOnline(): Promise<void> {
  if (navigator.onLine) return Promise.resolve();
  return new Promise((resolve) => window.addEventListener('online', () => resolve(), { once: true }));
}

/**
 * La tarea o, si tarda más de `ms`, el error de `late()` (única implementación de un tiempo límite sobre una promesa:
 * nada se queda colgado esperando a un servicio, a WebCrypto o a IndexedDB). La tarea sigue en segundo plano; su
 * resultado tardío se ignora.
 */
export function withinTime<T>(task: Promise<T>, ms: number, late: () => Error): Promise<T> {
  let timer = 0;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = window.setTimeout(() => reject(late()), ms);
  });
  return Promise.race([task, deadline]).finally(() => window.clearTimeout(timer));
}
