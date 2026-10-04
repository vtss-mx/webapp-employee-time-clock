import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useErrorPopup } from './useFeedback';
import { useRetryOnReconnect } from './useRetryOnReconnect';

/**
 * Lo que una pantalla necesita para mostrarse (la empresa, el empleado, el panel...): se pide al
 * montar y al cambiar `key`, el error se explica en un popup con "Reintentar" y `retry` lo vuelve
 * a pedir (también solo, al recuperar la conexión). Varias peticiones a la vez:
 * `useResource((signal) => Promise.all([...]), ...)`.
 *
 * Cada petición recibe una señal (`AbortSignal`) que se cancela al cambiar de registro, al
 * reintentar o al salir de la pantalla: la petición anterior se aborta (no sigue ocupando la red ni
 * el servidor) y lo que responda tarde ya no toca el estado.
 */
export function useResource<T>(fetch: (signal: AbortSignal) => Promise<T>, key: string | number, errorTitle: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reload, setReload] = useState(0);
  const fetchRef = useRef(fetch);
  useLayoutEffect(() => {
    fetchRef.current = fetch;
  });

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setError(null);
    fetchRef
      .current(signal)
      .then((value) => !signal.aborted && setData(value))
      .catch((err: unknown) => !signal.aborted && setError(err));
    return () => controller.abort();
  }, [key, reload]);

  const retry = useCallback(() => setReload((n) => n + 1), []);
  useErrorPopup(error, { title: errorTitle, retry });
  useRetryOnReconnect(error, retry);
  return { data, setData, error, retry };
}
