import { useCallback, useEffect, useRef, useState } from 'react';
import { usePolling } from './usePolling';

interface Options {
  enabled: boolean;
  intervalMs: number;
  /** Evento de ventana con que otra pantalla avisa que el número cambió (se vuelve a consultar ya). */
  changedEvent: string;
}

/**
 * Un número que se consulta periódicamente y al avisar que cambió: la base de los contadores del
 * menú (validaciones pendientes, errores pendientes). `load` debe ser estable (función de módulo).
 * null: aún no se sabe o el contador no está activo.
 */
export function usePolledCount(load: (signal?: AbortSignal) => Promise<number>, { enabled, intervalMs, changedEvent }: Options): number | null {
  const [count, setCount] = useState<number | null>(null);
  // La consulta periódica y la de un aviso pueden ir a la vez: solo cuenta la más reciente (una
  // respuesta vieja que llega tarde no regresa el número a un valor anterior).
  const latest = useRef(0);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const turn = ++latest.current;
    const value = await load(signal);
    if (turn === latest.current) setCount(value);
  }, [load]);

  usePolling(refresh, { intervalMs, enabled });

  useEffect(() => {
    if (!enabled) return;
    const onChange = () => void refresh().catch(() => undefined);
    window.addEventListener(changedEvent, onChange);
    return () => window.removeEventListener(changedEvent, onChange);
  }, [enabled, refresh, changedEvent]);

  return count;
}
