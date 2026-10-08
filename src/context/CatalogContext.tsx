import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useErrorPopup } from '../hooks/useFeedback';
import { useRetryOnReconnect } from '../hooks/useRetryOnReconnect';
import { t, useLocale } from '../i18n';
import { catalogService } from '../services/catalogService';
import { createCatalogApi, publishCatalogs, type CatalogApi } from '../utils/catalogs';

export type CatalogState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'ready'; catalogs: CatalogApi };

export const CatalogContext = createContext<CatalogState | null>(null);

/**
 * Catálogos de la BD (GET /api/catalogs), única fuente de todo lo que la interfaz muestra como
 * lista o etiqueta. Se cargan UNA vez por sesión al autenticarse, viven solo en memoria (nunca en
 * el navegador) y se descartan al cerrar la sesión. Un error de carga se avisa en el popup.
 * Sus textos (`name`, `description`, `message`, `phrase`...) llegan en el idioma de la petición: al
 * cambiar el idioma se vuelven a pedir y, mientras llegan, se siguen mostrando los anteriores (la
 * pantalla no se vacía ni se recarga).
 */
export function CatalogProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [catalogs, setCatalogs] = useState<CatalogApi | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const locale = useLocale();

  /**
   * Los catálogos nuevos se publican ANTES de dibujarse con ellos (`publishCatalogs`): `nameOf`/`byCode` buscan
   * siempre en los vigentes —también lo que guardó una búsqueda de una carga anterior, como un popup abierto, que
   * así cambia de idioma— y lo que se dibuja fuera de este proveedor (los popups) se vuelve a dibujar.
   */
  const show = useCallback((next: CatalogApi | null) => {
    publishCatalogs(next);
    setCatalogs(next);
  }, []);

  // Se carga al autenticarse, en cada reintento y al cambiar el idioma; al cerrar la sesión se cancela y se descarta.
  useEffect(() => {
    if (!isAuthenticated) {
      show(null);
      setError(null);
      return;
    }
    const controller = new AbortController();
    catalogService
      .getAll(controller.signal)
      .then((data) => !controller.signal.aborted && show(createCatalogApi(data)))
      .catch((cause: unknown) => !controller.signal.aborted && setError(cause));
    return () => controller.abort();
  }, [isAuthenticated, attempt, locale, show]);
  useEffect(() => () => publishCatalogs(null), []);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);
  useErrorPopup(error, { title: () => t('app.catalogsLoadFailed'), retry });
  useRetryOnReconnect(error, retry);

  const state = useMemo<CatalogState>(() => {
    if (catalogs) return { status: 'ready', catalogs };
    return error ? { status: 'error', retry } : { status: 'loading' };
  }, [catalogs, error, retry]);

  return <CatalogContext.Provider value={state}>{children}</CatalogContext.Provider>;
}
