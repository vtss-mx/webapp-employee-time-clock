import { useEffect, useRef } from 'react';

interface PollingOptions {
  /** Intervalo base entre consultas. */
  intervalMs: number;
  enabled?: boolean;
  /** Intervalo máximo tras errores consecutivos (backoff exponencial). */
  maxBackoffMs?: number;
  /** Ejecutar inmediatamente al montar. */
  immediate?: boolean;
}

const MIN_GAP_MS = 5_000;

/**
 * Consulta periódica pensada para miles de clientes simultáneos:
 * - jitter ±20 %: evita que todos los navegadores consulten en el mismo segundo;
 * - se pausa con la pestaña oculta y consulta al volver (sin ráfagas: mínimo 5 s entre consultas);
 * - backoff exponencial ante errores (servidor saturado o sin red);
 * - nunca hay dos consultas en curso a la vez;
 * - la consulta recibe una señal que se cancela al desmontar (no queda reintentando sin pantalla).
 */
export function usePolling(task: (signal: AbortSignal) => Promise<unknown>, options: PollingOptions): void {
  const { intervalMs, enabled = true, maxBackoffMs = 5 * 60_000, immediate = true } = options;
  const taskRef = useRef(task);
  taskRef.current = task;

  useEffect(() => {
    if (!enabled) return;
    let timer: number | undefined;
    let failures = 0;
    let running = false;
    let lastRun = 0;
    let disposed = false;
    // Al salir de la pantalla se cancela la consulta en curso (y sus reintentos): no sigue en segundo plano.
    const controller = new AbortController();

    const schedule = () => {
      window.clearTimeout(timer);
      if (disposed || document.visibilityState === 'hidden') return;
      const base = Math.min(intervalMs * 2 ** failures, maxBackoffMs);
      const jitter = base * (0.8 + Math.random() * 0.4);
      timer = window.setTimeout(() => void run(), jitter);
    };

    const run = async () => {
      if (running || disposed) return;
      running = true;
      lastRun = Date.now();
      try {
        await taskRef.current(controller.signal);
        failures = 0;
      } catch {
        failures = Math.min(failures + 1, 8);
      } finally {
        running = false;
        schedule();
      }
    };

    const wake = () => {
      if (document.visibilityState === 'hidden') {
        window.clearTimeout(timer);
        return;
      }
      if (Date.now() - lastRun >= MIN_GAP_MS) void run();
      else schedule();
    };

    if (immediate) void run();
    else schedule();
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('online', wake);
    return () => {
      disposed = true;
      controller.abort();
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
      window.removeEventListener('online', wake);
    };
  }, [enabled, intervalMs, maxBackoffMs, immediate]);
}
