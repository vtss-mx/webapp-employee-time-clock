import { Activity, Gauge, ListOrdered, RefreshCw, Server, ShieldOff } from 'lucide-react';
import { useResource } from '../hooks/useResource';
import { errorReportService } from '../services/errorReportService';
import type { ServerStatus } from '../types';
import { Button } from './ui/Button';
import { KpiGrid, type Kpi } from './ui/KpiCard';
import { PanelSection } from './ui/Panel';
import { RetryState } from './ui/RetryState';

const STATUS: Record<ServerStatus['status'], { label: string; tone: string }> = {
  ok: { label: 'Operando', tone: 'badge--success' },
  degraded: { label: 'Funciones limitadas', tone: 'badge--warning' },
  unavailable: { label: 'Sin base de datos', tone: 'badge--danger' },
};
const COMPONENTS: Record<string, string> = { database: 'Base de datos', face_engine: 'Motor facial' };
const TIERS: Record<string, string> = { CRITICAL: 'crítica', NORMAL: 'normal', BACKGROUND: 'de fondo' };

/**
 * Estado del servidor para el ADMIN de la plataforma: dependencias (con el error de cada una) y la
 * capacidad adaptativa del proceso que respondió (límite vigente, fila, descartes y las APIs con más
 * demanda). Las sondas públicas solo dicen si está listo; el detalle vive aquí.
 */
export function ServerStatusPanel() {
  const { data, error, retry } = useResource((signal) => errorReportService.server(signal), 'server-status', 'No se pudo cargar el estado del servidor');
  const admission = data?.admission;

  const kpis: Kpi[] = [
    { key: 'limit', label: 'Límite adaptativo (a la vez)', icon: Gauge, value: admission?.limit, tile: '' },
    { key: 'in-flight', label: 'Atendiendo ahora', icon: Activity, value: admission?.in_flight, tile: 'icon-tile--success' },
    { key: 'waiting', label: 'En fila', icon: ListOrdered, value: admission?.waiting, tile: '' },
    { key: 'shed', label: 'Descartadas (503 reintentable)', icon: ShieldOff, value: admission?.shed, tile: 'icon-tile--warning' },
  ];
  const badge = data && <span className={`badge ${STATUS[data.status].tone}`}>{STATUS[data.status].label}</span>;

  return (
    <PanelSection title="Estado del servidor" icon={<Server size={20} />} aside={badge}>
      <p className="muted small">
        El límite de peticiones a la vez se ajusta solo a la latencia real (entre {admission?.bounds[0] ?? '…'} y {admission?.bounds[1] ?? '…'}); lo
        crítico (identificar, iniciar sesión) pasa primero y, al saturarse, se descarta primero lo menos importante.
      </p>
      {Boolean(error) && !data ? (
        <RetryState onRetry={retry} />
      ) : (
        <KpiGrid kpis={kpis} />
      )}
      {data && (
        <ul className="log-list log-list--stacked">
          {Object.entries(data.components).map(([name, component]) => (
            <li key={name}>
              <strong>
                {COMPONENTS[name] ?? name}: {component.status === 'ok' ? 'disponible' : component.status}
              </strong>
              {component.error && <small className="muted">{component.error}</small>}
            </li>
          ))}
          {data.admission.top_demand.map((api) => (
            <li key={api.api}>
              <strong>{api.api}</strong>
              <small className="muted">
                {[
                  `prioridad ${TIERS[api.tier] ?? api.tier}`,
                  `${api.recent_requests.toLocaleString('es-MX')} peticiones recientes`,
                  api.latency_ms != null && `${api.latency_ms.toLocaleString('es-MX')} ms`,
                  api.shed > 0 && `${api.shed.toLocaleString('es-MX')} descartadas`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </small>
            </li>
          ))}
        </ul>
      )}
      {data && (
        <Button variant="ghost" size="sm" icon={<RefreshCw size={16} />} onClick={retry}>
          Actualizar
        </Button>
      )}
    </PanelSection>
  );
}
