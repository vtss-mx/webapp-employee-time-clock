import { Outlet } from 'react-router-dom';
import { PageLoader } from '../components/Spinner';
import { RetryState } from '../components/ui/RetryState';
import { useCatalogState } from '../hooks/useCatalogs';

/**
 * Las pantallas con sesión esperan los catálogos (se cargan una vez por sesión). Si fallan, el
 * motivo ya se avisó en el popup y aquí solo queda volver a intentarlo.
 */
export function CatalogGate() {
  const state = useCatalogState();
  if (state.status === 'ready') return <Outlet />;
  if (state.status === 'error') {
    return (
      <div className="page page--narrow">
        <RetryState onRetry={state.retry} />
      </div>
    );
  }
  return <PageLoader text="Preparando tu espacio de trabajo..." />;
}
