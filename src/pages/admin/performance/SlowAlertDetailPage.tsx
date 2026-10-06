import { Activity, Bug, CheckCheck, ChartLine, ClipboardList, ListChecks, RotateCcw, ScrollText } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { FactList } from '../../../components/performance/PerformanceParts';
import { CatalogStatusBadge } from '../../../components/StatusBadge';
import { Button, ButtonLink } from '../../../components/ui/Button';
import { CopyField } from '../../../components/ui/CopyField';
import { Panel, PanelGrid, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { RetryState } from '../../../components/ui/RetryState';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { useAction } from '../../../hooks/useAction';
import { useCatalogs } from '../../../hooks/useCatalogs';
import { useHasScreen } from '../../../hooks/useHasScreen';
import { useResource } from '../../../hooks/useResource';
import { notifySlowAlertsChanged } from '../../../hooks/useSlowAlerts';
import { t, useT } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { performanceService } from '../../../services/performanceService';
import type { SlowAlertDetail, SlowAlertSample, SlowAlertStatus } from '../../../types/performance';
import type { ConfirmInput } from '../../../types/confirm';
import type { CatalogApi } from '../../../utils/catalogs';
import { formatDateTime } from '../../../utils/format';
import { formatBytes, formatCount, formatDuration } from '../../../utils/numbers';
import { metricLink, tabLink } from '../../../utils/performance';

/** Seguimiento posible (las acciones son de la app; los nombres de cada estado, del catálogo). */
const STATUSES: readonly SlowAlertStatus[] = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'];
const ICONS: Record<SlowAlertStatus, typeof CheckCheck> = { OPEN: RotateCcw, ACKNOWLEDGED: ListChecks, RESOLVED: CheckCheck };
const loadError = () => t('performance.alert.loadError');
const statusError = () => t('performance.alert.statusError');
const alertsTab = () => tabLink('alerts', '24h');

/** Cambiar el seguimiento: "antes → después" con los nombres del catálogo y de qué alerta se trata. */
function statusConfirm(alert: SlowAlertDetail, next: SlowAlertStatus, nameOf: CatalogApi['nameOf']): ConfirmInput {
  const resolved = next === 'RESOLVED';
  const after = nameOf('slow_alert_statuses', next);
  const Icon = ICONS[next];
  return {
    kind: 'edit',
    tone: resolved ? 'success' : 'primary',
    icon: <Icon size={30} />,
    eyebrow: t('performance.alert.confirm.eyebrow'),
    title: t('performance.alert.confirm.title', { route: alert.route }),
    message: resolved ? t('performance.alert.confirm.resolved') : t('performance.alert.confirm.message'),
    changes: [{ label: t('performance.alerts.columns.status'), before: nameOf('slow_alert_statuses', alert.status), after }],
    details: [
      { label: t('performance.alert.count'), value: formatCount(alert.count) },
      { label: t('performance.alert.lastMs'), value: formatDuration(alert.last_ms) },
      { label: t('performance.alert.lastSeen'), value: formatDateTime(alert.last_seen_at) },
    ],
    confirmLabel: t(`performance.alert.actions.${next}`),
    confirmIcon: <Icon size={18} />,
  };
}

/** Contexto de la última petición lenta (sin secretos ni cuerpos: lo que el backend guardó). */
function SampleFacts({ sample }: { sample: SlowAlertSample }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  const query = sample.query && Object.entries(sample.query);
  return (
    <FactList
      items={[
        { label: t('performance.alert.sampleFields.request'), value: <code className="perf-name">{`${sample.method} ${sample.path}`}</code> },
        {
          label: t('performance.alert.sampleFields.query'),
          value: query?.length ? <code className="perf-name">{query.map(([key, value]) => `${key}=${value}`).join(' · ')}</code> : t('performance.alert.sampleFields.noQuery'),
        },
        { label: t('performance.alert.sampleFields.status'), value: sample.status },
        { label: t('performance.alert.sampleFields.duration'), value: formatDuration(sample.duration_ms) },
        { label: t('performance.alert.sampleFields.database'), value: formatDuration(sample.db_ms) },
        { label: t('performance.alert.sampleFields.queries'), value: formatCount(sample.db_queries) },
        { label: t('performance.alert.sampleFields.data'), value: `${formatBytes(sample.bytes_in)} / ${formatBytes(sample.bytes_out)}` },
        {
          label: t('performance.alert.sampleFields.user'),
          value: sample.user
            ? t('performance.alert.sampleFields.userValue', { id: sample.user.id, role: nameOf('roles', sample.user.role, t('performance.alert.sampleFields.none')) })
            : t('performance.alert.sampleFields.noSession'),
        },
        {
          label: t('performance.alert.sampleFields.company'),
          value: sample.company_id === null ? t('performance.alert.sampleFields.none') : t('performance.alert.sampleFields.companyValue', { id: sample.company_id }),
        },
      ]}
    />
  );
}

/** Los datos de la alerta: cuántas lentas, sus tiempos, el umbral, cuándo y cuántas veces se reabrió. */
function AlertFacts({ alert }: { alert: SlowAlertDetail }) {
  const t = useT();
  return (
    <FactList
      items={[
        { label: t('performance.alert.count'), value: formatCount(alert.count) },
        { label: t('performance.alert.lastMs'), value: formatDuration(alert.last_ms) },
        { label: t('performance.alert.average'), value: formatDuration(alert.avg_ms) },
        { label: t('performance.alert.max'), value: formatDuration(alert.max_ms) },
        { label: t('performance.alert.threshold'), value: formatDuration(alert.threshold_ms) },
        { label: t('performance.alert.lastStatus'), value: alert.last_status ?? '—' },
        { label: t('performance.alert.firstSeen'), value: formatDateTime(alert.first_seen_at) },
        { label: t('performance.alert.lastSeen'), value: formatDateTime(alert.last_seen_at) },
        { label: t('performance.alert.openedAt'), value: formatDateTime(alert.opened_at) },
        { label: t('performance.alert.reopened'), value: formatCount(alert.reopened) },
      ]}
    />
  );
}

/**
 * Una alerta de petición lenta: su seguimiento (reabrir, en atención, resuelta; cada cambio se confirma con
 * "antes → después" y actualiza el contador del menú), sus datos, la ruta en las últimas 24 h, el rastreo de la
 * última (y su error registrado, si lo hay) y el contexto de esa petición.
 */
export function SlowAlertDetailPage() {
  const t = useT();
  const alertId = Number(useParams().id);
  const { nameOf } = useCatalogs();
  const canSeeErrors = useHasScreen('ADMIN_ERRORS');
  const { data: alert, setData, error, retry } = useResource((signal) => performanceService.alert(alertId, signal), alertId, loadError);
  const { busy, run } = useAction<SlowAlertStatus>();

  if (!alert) {
    return (
      <div className="page">
        <Panel>
          <PanelHeader title={t('performance.alert.title')} backTo={alertsTab()} backLabel={t('performance.tabs.alerts')} />
          <PanelSection>{error ? <RetryState onRetry={retry} /> : <SkeletonCard lines={8} />}</PanelSection>
        </Panel>
      </div>
    );
  }

  const change = (next: SlowAlertStatus) =>
    run(() => performanceService.setAlertStatus(alert.id, next), {
      busy: next,
      confirm: () => statusConfirm(alert, next, nameOf),
      errorTitle: statusError,
      onSuccess: (saved) => {
        setData(saved);
        // La apertura que la persona misma provocó (reabrir) no se le anuncia en vivo.
        notifySlowAlertsChanged(saved.opened_at);
      },
    });

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={alert.route}
          subtitle={t('performance.alert.subtitle', { threshold: formatDuration(alert.threshold_ms) })}
          backTo={alertsTab()}
          backLabel={t('performance.tabs.alerts')}
          actions={<CatalogStatusBadge catalog="slow_alert_statuses" code={alert.status} />}
        />
        <PanelSection title={t('performance.alert.followUp')} icon={<ListChecks size={20} />}>
          <p className="muted small">
            {alert.status_changed_by
              ? t('performance.alert.lastChange', { who: alert.status_changed_by, date: formatDateTime(alert.status_changed_at) })
              : t('performance.alert.noFollowUp')}{' '}
            {t('performance.alert.reopenNote')}
          </p>
          <div className="button-row">
            {STATUSES.filter((status) => status !== alert.status).map((status) => {
              const Icon = ICONS[status];
              return (
                <Button
                  key={status}
                  variant={status === 'RESOLVED' ? 'success' : 'secondary'}
                  icon={<Icon size={18} />}
                  loading={busy === status}
                  disabled={busy !== null}
                  onClick={() => void change(status)}
                >
                  {t(`performance.alert.actions.${status}`)}
                </Button>
              );
            })}
          </div>
        </PanelSection>
        <PanelGrid>
          <PanelSection title={t('performance.alert.data')} icon={<ClipboardList size={20} />}>
            <AlertFacts alert={alert} />
          </PanelSection>
          <PanelSection title={t('performance.alert.route')} icon={<Activity size={20} />}>
            <FactList
              items={[
                { label: t('performance.alert.requestsDay'), value: formatCount(alert.requests_24h) },
                { label: t('performance.alert.p95Day'), value: formatDuration(alert.p95_ms_24h) },
              ]}
            />
            <div className="button-row">
              <ButtonLink to={metricLink('HTTP', alert.route, '24h')} variant="secondary" icon={<ChartLine size={18} />}>
                {t('performance.alert.metric')}
              </ButtonLink>
              {alert.error_report_id !== null && canSeeErrors && (
                <ButtonLink to={paths.admin.error(alert.error_report_id)} variant="ghost" icon={<Bug size={18} />}>
                  {t('performance.alert.errorReport')}
                </ButtonLink>
              )}
            </div>
            {alert.last_trace_id && (
              <div className="stack">
                <span className="small muted">{t('performance.alert.trace')}</span>
                <CopyField value={alert.last_trace_id} label={t('performance.alert.copyTrace')} />
              </div>
            )}
          </PanelSection>
        </PanelGrid>
        <PanelSection title={t('performance.alert.sample')} icon={<ScrollText size={20} />}>
          {alert.sample ? <SampleFacts sample={alert.sample} /> : <p className="muted">{t('performance.alert.sampleEmpty')}</p>}
        </PanelSection>
      </Panel>
    </div>
  );
}
