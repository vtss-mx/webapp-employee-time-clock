import type { ComponentProps } from 'react';
import { Panel, PanelHeader, PanelSection } from './Panel';
import { RetryState } from './RetryState';
import { SkeletonCard } from './Skeleton';

interface ResourceFallbackProps {
  /** El error de `useResource` (nada mientras carga). */
  error: unknown;
  retry: () => void;
  /** Líneas del esqueleto mientras carga. */
  lines?: number;
  /** Encabezado del panel que envuelve «Reintentar» (título y regreso): la persona nunca se queda sin salida. */
  header: ComponentProps<typeof PanelHeader>;
}

/**
 * Lo que una pantalla de detalle dibuja mientras su registro no ha llegado: el esqueleto o, si la carga falló, la
 * página con su panel, su encabezado y el botón «Reintentar». El motivo ya lo mostró el popup de mensajes
 * (`useResource`); aquí solo queda la acción. Un solo lugar para todas las pantallas de detalle (regla 6 de la raíz).
 */
export function ResourceFallback({ error, retry, lines = 8, header }: ResourceFallbackProps) {
  if (!error) return <SkeletonCard lines={lines} />;
  return (
    <div className="page">
      <Panel>
        <PanelHeader {...header} />
        <PanelSection>
          <RetryState onRetry={retry} />
        </PanelSection>
      </Panel>
    </div>
  );
}
