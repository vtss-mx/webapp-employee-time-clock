import { BrainCircuit, ScanFace, Sparkles, Users } from 'lucide-react';
import { useResource } from '../hooks/useResource';
import { t, useLocale } from '../i18n';
import { adminService } from '../services/adminService';
import { timeAgo } from '../utils/format';
import { formatCount } from '../utils/numbers';
import { KpiGrid, type Kpi } from './ui/KpiCard';
import { PanelSection } from './ui/Panel';
import { RetryState } from './ui/RetryState';

/**
 * Consola del ADMIN (política de la empresa): cómo evoluciona su reconocimiento facial. Cada
 * identificación segura enseña a la galería de cada empleado y lo que deja de servir se retira solo
 * (lo decide el backend); aquí solo se dibuja lo que reporta. La empresa no ve ni configura nada de
 * esto. `enabled` es el interruptor de la política: al cambiarlo se vuelve a pedir.
 */
export function FaceLearningPanel({ companyId, enabled }: { companyId: number; enabled: boolean }) {
  useLocale(); // textos con `t` al dibujarse: un cambio de idioma los traduce
  const { data, error, retry } = useResource(
    (signal) => adminService.faceLearning(companyId, signal),
    `${companyId}:${enabled}`,
    () => t('face.learning.errorTitle'),
  );

  const kpis: Kpi[] = [
    { key: 'employees', label: t('face.learning.employees'), icon: Users, value: data?.employees_learning, tile: 'icon-tile--success' },
    { key: 'samples', label: t('face.learning.samples'), icon: Sparkles, value: data?.learned_samples, tile: '' },
    { key: 'resolved', label: t('face.learning.resolved'), icon: ScanFace, value: data?.learned_identifications, tile: '' },
  ];
  const status = data && (
    <span className={`badge ${data.enabled ? 'badge--success' : 'badge--warning'}`}>{data.enabled ? t('face.learning.learning') : t('face.learning.paused')}</span>
  );

  return (
    <PanelSection title={t('face.learning.title')} icon={<BrainCircuit size={20} />} aside={status}>
      <p className="muted small">{t('face.learning.intro')}</p>
      {Boolean(error) && !data ? (
        <RetryState onRetry={retry} />
      ) : (
        <KpiGrid kpis={kpis} />
      )}
      {data && (
        <p className="small muted">
          {data.last_learned_at
            ? t('face.learning.last', { ago: timeAgo(data.last_learned_at), learning: formatCount(data.employees_learning), approved: formatCount(data.approved_employees) })
            : t('face.learning.never')}
        </p>
      )}
      {data && !data.enabled && (
        <div className="callout">
          <span className="icon-tile icon-tile--warning">
            <BrainCircuit size={22} />
          </span>
          <div className="callout__body">
            <strong>{t('face.learning.pausedTitle')}</strong>
            <p className="muted small">{t('face.learning.pausedText')}</p>
          </div>
        </div>
      )}
    </PanelSection>
  );
}
