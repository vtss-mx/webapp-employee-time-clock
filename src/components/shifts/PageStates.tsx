import type { ReactNode } from 'react';
import { useResource } from '../../hooks/useResource';
import type { LazyText } from '../../i18n';
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
  /** Título del popup si no carga; con una función (`() => t('…')`) sigue al idioma activo. */
  errorTitle: LazyText;
  /** Encabezado si no se pudo cargar. */
  failed: Omit<LoadFailedProps, 'onRetry'>;
  /**
   * El formulario: con el registro (edición) o con null (alta). `replace` cambia el registro mostrado sin
   * volver a pedirlo (p. ej. el que devolvió el servidor al restaurarlo de «Eliminados»).
   */
  children: (record: T | null, replace: (record: T) => void) => ReactNode;
}

/** Alta o edición en la misma ruta: en la edición primero se carga el registro (esqueleto o "Volver a cargar"). */
export function RecordLoader<T>({ id, load, errorTitle, failed, children }: RecordLoaderProps<T>) {
  const { data, setData, error, retry } = useResource((signal) => (id === null ? Promise.resolve(null) : load(id, signal)), id ?? 'new', errorTitle);
  if (id === null) return children(null, setData);
  if (data) return children(data, setData);
  return error ? <LoadFailed {...failed} onRetry={retry} /> : <SkeletonCard lines={8} />;
}
