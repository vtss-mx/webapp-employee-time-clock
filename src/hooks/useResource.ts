import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useErrorPopup } from './useFeedback';

/**
 * Lo que una pantalla necesita para mostrarse (la empresa, el empleado o el validador del que se
 * trata): se pide al cambiar `key`, el error se explica en un popup con "Reintentar" y `retry`
 * lo vuelve a pedir. Una respuesta que llega tarde (se cambió de registro) se descarta.
 */
export function useResource<T>(fetch: () => Promise<T>, key: string | number, errorTitle: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reload, setReload] = useState(0);
  const fetchRef = useRef(fetch);
  useLayoutEffect(() => {
    fetchRef.current = fetch;
  });

  useEffect(() => {
    let current = true;
    setError(null);
    fetchRef
      .current()
      .then((value) => current && setData(value))
      .catch((err: unknown) => current && setError(err));
    return () => {
      current = false;
    };
  }, [key, reload]);

  const retry = useCallback(() => setReload((n) => n + 1), []);
  useErrorPopup(error, { title: errorTitle, retry });
  return { data, setData, error, retry };
}
