import { useContext } from 'react';
import { CatalogContext, type CatalogState } from '../context/CatalogContext';
import type { CatalogApi } from '../utils/catalogs';

/** Estado de la carga de los catálogos (cargando, error o listos). */
export function useCatalogState(): CatalogState {
  const context = useContext(CatalogContext);
  if (!context) throw new Error('useCatalogs debe usarse dentro de <CatalogProvider>');
  return context;
}

/**
 * Catálogos ya cargados, con búsquedas por código y listas de activos. Las pantallas con sesión
 * los tienen siempre: <CatalogGate> no las muestra hasta que llegan.
 */
export function useCatalogs(): CatalogApi {
  const state = useCatalogState();
  if (state.status !== 'ready') throw new Error('Los catálogos aún no se cargan: usa useCatalogs() dentro de <CatalogGate>');
  return state.catalogs;
}
