import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useErrorPopup } from '../hooks/useFeedback';
import { useRetryOnReconnect } from '../hooks/useRetryOnReconnect';
import { catalogService } from '../services/catalogService';
import { createCatalogApi, type CatalogApi } from '../utils/catalogs';

export type CatalogState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'ready'; catalogs: CatalogApi };

export const CatalogContext = createContext<CatalogState | null>(null);

/**
 * Catálogos de la BD (GET /api/catalogs), única fuente de todo lo que la interfaz muestra como
 * lista o etiqueta. Se cargan UNA vez por sesión al autenticarse, viven solo en memoria (nunca en
 * el navegador) y se descartan al cerrar la sesión. Un error de carga se avisa en el popup.
 */
export function CatalogProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [catalogs, setCatalogs] = useState<CatalogApi | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  // Se carga al autenticarse (y en cada reintento); al cerrar la sesión se cancela y se descarta.
  useEffect(() => {
    if (!isAuthenticated) {
      setCatalogs(null);
      setError(null);
      return;
    }
    const controller = new AbortController();
    catalogService
      .getAll(controller.signal)
      .then((data) => !controller.signal.aborted && setCatalogs(createCatalogApi(data)))
      .catch((cause: unknown) => !controller.signal.aborted && setError(cause));
    return () => controller.abort();
  }, [isAuthenticated, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);
  useErrorPopup(error, { title: 'No se pudieron cargar los catálogos', retry });
  useRetryOnReconnect(error, retry);

  const state = useMemo<CatalogState>(() => {
    if (catalogs) return { status: 'ready', catalogs };
    return error ? { status: 'error', retry } : { status: 'loading' };
  }, [catalogs, error, retry]);

  return <CatalogContext.Provider value={state}>{children}</CatalogContext.Provider>;
}
