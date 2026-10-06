import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Una opción de la pantalla guardada en la URL (`?tab=`, `?period=`): se puede compartir y sobrevive a recargar.
 * Un valor desconocido es el de por omisión, que no se escribe en la URL; cambiarla reemplaza la entrada del
 * historial (no se acumulan "atrás" por cada pestaña) y conserva los demás parámetros.
 */
export function useQueryOption<T extends string>(key: string, options: readonly T[], fallback: T): [T, (next: T) => void] {
  const [params, setParams] = useSearchParams();
  const value = options.find((option) => option === params.get(key)) ?? fallback;
  const change = useCallback(
    (next: T) =>
      setParams(
        (current) => {
          const query = new URLSearchParams(current);
          if (next === fallback) query.delete(key);
          else query.set(key, next);
          return query;
        },
        { replace: true },
      ),
    [setParams, key, fallback],
  );
  return [value, change];
}
