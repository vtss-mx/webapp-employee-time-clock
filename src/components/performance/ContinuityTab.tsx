import { AlertTriangle, CalendarClock, DatabaseBackup, ShieldCheck } from 'lucide-react';
import { usePagedList } from '../../hooks/usePagedList';
import { t, useT } from '../../i18n';
import { continuityService } from '../../services/continuityService';
import type { Continuity, DrillStatus, RestoreDrill } from '../../types/continuity';
import type { StatusTone } from '../../types/index';
import { commitmentRows, drillMeasures, drillState, drillTargets, drillWhen, DRILL_TONE, rpoUnreachable } from '../../utils/continuity';
import { formatDateTime } from '../../utils/format';
import { EmptyState } from '../ui/EmptyState';
import { ListResults } from '../ui/ListResults';
import { RetryState } from '../ui/RetryState';
import { PerfBlock } from './PerformanceParts';

const TONE_CLASS: Record<StatusTone, string> = {
  muted: 'badge--muted',
  info: 'badge--info',
  success: 'badge--success',
  warning: 'badge--warning',
  danger: 'badge--danger',
};
const COLUMNS = ['kind', 'when', 'result', 'measures'] as const;
const drillsError = () => t('continuity.drillsError');

/** El nombre de un tipo de ensayo; uno que esta versión no conoce se dibuja con su código (es un dato). */
function kindName(kind: string): string {
  return kind === 'PITR' || kind === 'BUCKET_DUMP' ? t(`continuity.kinds.${kind}`) : kind;
}

/**
 * El estado de un tipo de ensayo. **Nunca ensayado = vencido** y se dice con todas sus letras, en rojo: un
 * compromiso de recuperación que nunca se probó no es un compromiso.
 */
function DrillCard({ status }: { status: DrillStatus }) {
  const t = useT();
  const state = drillState(status);
  return (
    <li className={`drill drill--${state}`}>
      <span className="drill__head">
        <strong>{kindName(status.kind)}</strong>
        <span className={`badge ${TONE_CLASS[DRILL_TONE[state]]}`}>{t(`continuity.states.${state}`)}</span>
      </span>
      <span className="muted small">{drillWhen(status)}</span>
      {status.last_success && <span className="muted small">{drillMeasures(status.last_success).join(' · ')}</span>}
      {status.last_attempt && !status.last_attempt.success && (
        <span className="inline-note small">
          <AlertTriangle size={16} color="var(--warning)" /> {t('continuity.lastFailed', { date: formatDateTime(status.last_attempt.started_at) })}
        </span>
      )}
    </li>
  );
}

/** Una fila del historial: qué se ensayó, cuándo, cómo salió y lo que midió frente a lo comprometido entonces. */
function DrillCells({ drill }: { drill: RestoreDrill }) {
  const t = useT();
  const measures = drillMeasures(drill);
  return (
    <>
      <td className="table__primary">{kindName(drill.kind)}</td>
      <td data-label={t('continuity.columns.when')}>
        {formatDateTime(drill.finished_at ?? drill.started_at)}
        <small className="muted table__note">{drill.actor}</small>
      </td>
      <td data-label={t('continuity.columns.result')}>
        <span className={`badge ${TONE_CLASS[drill.success && drill.met_targets ? 'success' : drill.success ? 'warning' : 'danger']}`}>
          {t(drill.success ? (drill.met_targets ? 'continuity.results.met' : 'continuity.results.missed') : 'continuity.results.failed')}
        </span>
        <small className="muted table__note">{drillTargets(drill)}</small>
      </td>
      <td data-label={t('continuity.columns.measures')} className="table__wide">
        {measures.length ? measures.join(' · ') : <span className="muted">{t('continuity.notMeasured')}</span>}
        {drill.notes && <small className="muted table__note">{drill.notes}</small>}
      </td>
    </>
  );
}

/** El compromiso declarado y lo que de verdad está encendido hoy. */
function Commitment({ data }: { data: Continuity }) {
  const t = useT();
  return (
    <PerfBlock title={t('continuity.commitment')} icon={<ShieldCheck size={18} />} intro={t('continuity.commitmentIntro')}>
      <dl className="details">
        {commitmentRows(data).map((row) => (
          <div key={row.key}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {rpoUnreachable(data) && (
        <p className="inline-note small">
          <AlertTriangle size={16} color="var(--danger)" /> {t('continuity.rpoUnreachable')}
        </p>
      )}
    </PerfBlock>
  );
}

/** Historial de ensayos (paginado en el servidor): los fallidos también, que son los que hay que ver. */
function DrillHistory() {
  const t = useT();
  const list = usePagedList((query, signal) => continuityService.drills(query, signal), { errorTitle: drillsError, pageSize: 10 });
  return (
    <PerfBlock title={t('continuity.history')} icon={<CalendarClock size={18} />} intro={t('continuity.historyIntro')}>
      <ListResults
        list={list}
        columns={COLUMNS.map((column) => t(`continuity.columns.${column}`))}
        pager={{ variant: 'compact', siblings: 0, noun: { one: t('continuity.noun.one'), other: t('continuity.noun.other') } }}
        empty={{ icon: <DatabaseBackup />, title: t('continuity.empty.title'), description: t('continuity.empty.description'), compact: true }}
        renderCells={(drill) => <DrillCells drill={drill} />}
      />
    </PerfBlock>
  );
}

/**
 * Continuidad del servicio (sección de «Rendimiento», solo el ADMIN; migración 0097 del backend): el compromiso
 * declarado de recuperación (RTO y RPO), si los respaldos al bucket y la recuperación a un punto en el tiempo
 * están encendidos HOY, el estado de cada mecanismo de ensayo y el historial de lo que se midió.
 *
 * **Nada se escribe desde aquí**: un ensayo lo registra el proceso que de verdad restauró. Una evidencia que se
 * puede teclear sin haber restaurado nada no es evidencia, así que la pantalla no ofrece ningún botón.
 */
export function ContinuityTab({ data, error, retry }: { data: Continuity | null; error: unknown; retry: () => void }) {
  const t = useT();
  if (!data) return error ? <RetryState onRetry={retry} /> : null;
  return (
    <div className="stack">
      {data.overdue_count > 0 && (
        <p className="inline-note small">
          <AlertTriangle size={16} color="var(--danger)" /> {t('continuity.overdue', { count: data.overdue_count })}
        </p>
      )}
      <Commitment data={data} />
      <PerfBlock title={t('continuity.drills')} icon={<DatabaseBackup size={18} />} intro={t('continuity.drillsIntro')}>
        {data.drills.length === 0 ? (
          <EmptyState icon={<DatabaseBackup />} title={t('continuity.noKinds.title')} description={t('continuity.noKinds.description')} compact />
        ) : (
          <ul className="drill-list">
            {data.drills.map((status) => (
              <DrillCard key={status.kind} status={status} />
            ))}
          </ul>
        )}
      </PerfBlock>
      <DrillHistory />
    </div>
  );
}
