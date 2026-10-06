import { useCallback, useLayoutEffect, useRef } from 'react';
import { config } from '../utils/config';
import { usePolling } from './usePolling';

/**
 * Vuelve a pedir lo que muestra una pantalla cada `intervalMs` mientras se ve (tableros de cobranza y
 * consumo): usa la consulta periódica compartida (`usePolling`), así que se pausa con la pestaña
 * oculta, actualiza al volver y reparte las consultas de muchos navegadores (jitter). `refresh` es el
 * `retry` de `useResource`/`usePagedList`: los datos visibles se conservan mientras llega lo nuevo y una
 * falla se avisa como cualquier carga.
 */
export function useAutoRefresh(refresh: () => void, intervalMs: number = config.businessRefreshMs, enabled = true): void {
  const latest = useRef(refresh);
  useLayoutEffect(() => {
    latest.current = refresh;
  });
  const tick = useCallback(() => {
    latest.current();
    return Promise.resolve();
  }, []);
  usePolling(tick, { intervalMs, enabled, immediate: false });
}
