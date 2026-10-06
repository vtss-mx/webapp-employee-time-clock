import { Outlet } from 'react-router-dom';
import { PageLoader } from '../components/Spinner';
import { AppErrorScreen } from '../components/AppErrorScreen';
import { useCatalogState } from '../hooks/useCatalogs';

/**
 * Las pantallas con sesión esperan los catálogos (se cargan una vez por sesión). Si fallan, el
 * motivo técnico ya se avisó en el popup; aquí queda la pantalla de error de la app con "Reintentar".
 */
export function CatalogGate() {
  const state = useCatalogState();
  if (state.status === 'ready') return <Outlet />;
  if (state.status === 'error') return <AppErrorScreen onRetry={state.retry} />;
  return <PageLoader fullscreen />;
}
