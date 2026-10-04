import type { ReactNode } from 'react';
import { useResource } from '../../hooks/useResource';
import { Panel, PanelHeader, PanelSection } from '../ui/Panel';
import { RetryState } from '../ui/RetryState';
import { SkeletonCard } from '../ui/Skeleton';

interface LoadFailedProps {
  title: string;
  backTo: string;
  backLabel: string;
  onRetry: () => void;
}

/**
 * La pantalla no se pudo cargar: queda su encabezado (para regresar) y "Volver a cargar". El motivo
 * ya se explicó en el popup de error (sin avisos en línea).
 */
export function LoadFailed({ title, backTo, backLabel, onRetry }: LoadFailedProps) {
  return (
    <div className="page">
      <Panel>
        <PanelHeader title={title} backTo={backTo} backLabel={backLabel} />
        <PanelSection>
          <RetryState onRetry={onRetry} />
        </PanelSection>
      </Panel>
    </div>
  );
}

interface RecordLoaderProps<T> {
  /** Id del registro a editar; null en un alta (no hay nada que cargar). */
  id: number | null;
  load: (id: number, signal: AbortSignal) => Promise<T>;
  errorTitle: string;
  /** Encabezado si no se pudo cargar. */
  failed: Omit<LoadFailedProps, 'onRetry'>;
  /** El formulario: con el registro (edición) o con null (alta). */
  children: (record: T | null) => ReactNode;
}

/** Alta o edición en la misma ruta: en la edición primero se carga el registro (esqueleto o "Volver a cargar"). */
export function RecordLoader<T>({ id, load, errorTitle, failed, children }: RecordLoaderProps<T>) {
  const { data, error, retry } = useResource((signal) => (id === null ? Promise.resolve(null) : load(id, signal)), id ?? 'new', errorTitle);
  if (id === null) return children(null);
  if (data) return children(data);
  return error ? <LoadFailed {...failed} onRetry={retry} /> : <SkeletonCard lines={8} />;
}
