import { createElement, lazy, type ComponentType, type LazyExoticComponent } from 'react';

/** Cargas diferidas que fallaron, con cómo prepararlas de nuevo. */
const failed = new Set<() => void>();

/**
 * "Reintentar" (ErrorBoundary): las cargas diferidas que fallaron se preparan de nuevo y el siguiente
 * dibujo vuelve a descargar su módulo. Se hace solo a petición: si se preparara otra en cuanto falla,
 * React (que vuelve a dibujar tras el rechazo) descargaría otra vez sin fin en lugar de mostrar el error.
 */
export function retryFailedLazy(): void {
  failed.forEach((prepare) => prepare());
  failed.clear();
}

/**
 * Componente de carga diferida que se puede reintentar. `React.lazy` guarda para siempre una carga
 * fallida: volver a dibujarlo repite el mismo error sin descargar nada, así que "Reintentar" del
 * ErrorBoundary no serviría. Con `retryFailedLazy` la carga fallida se reemplaza por una nueva.
 */
export function retryableLazy(load: () => Promise<{ default: ComponentType }>): ComponentType {
  let current: LazyExoticComponent<ComponentType>;
  const prepare = () => {
    current = lazy(() =>
      load().catch((error: unknown) => {
        failed.add(prepare);
        throw error;
      }),
    );
  };
  prepare();
  return function RetryableLazy() {
    return createElement(current);
  };
}
