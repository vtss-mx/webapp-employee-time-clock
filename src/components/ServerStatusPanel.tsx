import { Activity, Gauge, ListOrdered, RefreshCw, Server, ShieldOff } from 'lucide-react';
import { useResource } from '../hooks/useResource';
import { t, useT } from '../i18n';
import { errorReportService } from '../services/errorReportService';
import type { ServerStatus, StorageTask } from '../types';
import { formatDateTime } from '../utils/format';
import { formatCount, formatDuration } from '../utils/numbers';
import { Button } from './ui/Button';
import { KpiGrid, type Kpi } from './ui/KpiCard';
import { PanelSection } from './ui/Panel';
import { RetryState } from './ui/RetryState';

/** Color de cada estado del servidor (su texto, en `systemErrors.server.status`). */
const STATUS_TONES: Record<ServerStatus['status'], string> = { ok: 'badge--success', degraded: 'badge--warning', unavailable: 'badge--danger' };
/** Dependencias conocidas (código del backend → su texto); una nueva se muestra con su código. */
const COMPONENTS: Partial<Record<string, 'database' | 'faceEngine'>> = { database: 'database', face_engine: 'faceEngine' };
const TIERS: Partial<Record<string, 'critical' | 'normal' | 'background'>> = { CRITICAL: 'critical', NORMAL: 'normal', BACKGROUND: 'background' };

const componentName = (name: string) => {
  const key = COMPONENTS[name];
  return key ? t(`systemErrors.server.components.${key}`) : name;
};
const tierName = (tier: string) => {
  const key = TIERS[tier];
  return key ? t(`systemErrors.server.tiers.${key}`) : tier;
};
const loadError = () => t('systemErrors.server.loadError');

/** Un conteo del bucket: a lo más `cap` ("10,000+"). */
function capped(value: number, cap: number): string {
  return value >= cap ? `${formatCount(cap)}+` : formatCount(value);
}

/**
 * Una tarea del bucket (hoy la cola de borrado) en una línea: lo pendiente, su última vuelta correcta y su
 * último error. Conteos con tope.
 */
function taskSummary(task: StorageTask, cap: number): string {
  return [
    t('systemErrors.server.pending', { value: capped(task.pending, cap) }),
    task.last_success_at && t('systemErrors.server.lastSuccess', { date: formatDateTime(task.last_success_at) }),
    task.last_error && t('systemErrors.server.lastError', { date: formatDateTime(task.last_error_at), error: task.last_error }),
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Estado del servidor para el ADMIN de la plataforma: dependencias (con el error de cada una), la
 * capacidad adaptativa del proceso que respondió (límite vigente, fila, descartes y las APIs con más
 * demanda) y el bucket de imágenes cifradas (guardadas por tipo, cola de borrado y último error).
 * Las sondas públicas solo dicen si está listo; el detalle vive aquí.
 */
export function ServerStatusPanel() {
  const t = useT();
  const { data, error, retry } = useResource((signal) => errorReportService.server(signal), 'server-status', loadError);
  const admission = data?.admission;

  const kpis: Kpi[] = [
    { key: 'limit', label: t('systemErrors.server.kpis.limit'), icon: Gauge, value: admission?.limit, tile: '' },
    { key: 'in-flight', label: t('systemErrors.server.kpis.inFlight'), icon: Activity, value: admission?.in_flight, tile: 'icon-tile--success' },
    { key: 'waiting', label: t('systemErrors.server.kpis.waiting'), icon: ListOrdered, value: admission?.waiting, tile: '' },
    { key: 'shed', label: t('systemErrors.server.kpis.shed'), icon: ShieldOff, value: admission?.shed, tile: 'icon-tile--warning' },
  ];
  const badge = data && <span className={`badge ${STATUS_TONES[data.status]}`}>{t(`systemErrors.server.status.${data.status}`)}</span>;
  const bound = (value: number | undefined) => (value === undefined ? '…' : formatCount(value));

  return (
    <PanelSection title={t('systemErrors.server.title')} icon={<Server size={20} />} aside={badge}>
      <p className="muted small">{t('systemErrors.server.intro', { min: bound(admission?.bounds[0]), max: bound(admission?.bounds[1]) })}</p>
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
                {t('systemErrors.server.component', { name: componentName(name), status: component.status === 'ok' ? t('systemErrors.server.available') : component.status })}
              </strong>
              {component.error && <small className="muted">{component.error}</small>}
            </li>
          ))}
          {data.admission.top_demand.map((api) => (
            <li key={api.api}>
              <strong>{api.api}</strong>
              <small className="muted">
                {[
                  t('systemErrors.server.priority', { tier: tierName(api.tier) }),
                  t('systemErrors.server.recent', { count: api.recent_requests }),
                  api.latency_ms != null && formatDuration(api.latency_ms),
                  api.shed > 0 && t('systemErrors.server.shed', { count: api.shed }),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </small>
            </li>
          ))}
        </ul>
      )}
      {data && (
        <ul className="log-list log-list--stacked">
          <li>
            <strong>
              {t('systemErrors.server.storage', {
                where: data.storage.configured ? `gs://${data.storage.bucket}/${data.storage.prefix}/` : t('systemErrors.server.storageOff'),
              })}
            </strong>
            <small className="muted">
              {data.storage.configured ? t('systemErrors.server.storageOn') : t('systemErrors.server.storageReason', { reason: data.storage.reason ?? '' })}
            </small>
          </li>
          {data.storage.images.map((image) => (
            <li key={image.kind}>
              <strong>{image.label}</strong>
              <small className="muted">{t('systemErrors.server.stored', { value: capped(image.stored, data.storage.count_cap) })}</small>
            </li>
          ))}
          {data.storage.tasks.map((task) => (
            <li key={task.task}>
              <strong>{task.label}</strong>
              <small className="muted">{taskSummary(task, data.storage.count_cap)}</small>
            </li>
          ))}
        </ul>
      )}
      {data && (
        <Button variant="ghost" size="sm" icon={<RefreshCw size={16} />} onClick={retry}>
          {t('common.actions.refresh')}
        </Button>
      )}
    </PanelSection>
  );
}
