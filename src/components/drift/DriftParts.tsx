import { Building2, GitCommitVertical, SearchX, TrendingDown } from 'lucide-react';
import { usePagedList } from '../../hooks/usePagedList';
import { useSearchList } from '../../hooks/useSearchList';
import { t, useT } from '../../i18n';
import { driftService } from '../../services/driftService';
import type { CompanyDriftRow, DriftPlatform, DriftRow, DriftStatus, EngineVersion } from '../../types/drift';
import { COMPANY_TONE, STATUS_TONE, changeText, measure, psiText, rateText, tailKey } from '../../utils/drift';
import { formatDateTime } from '../../utils/format';
import { formatCount } from '../../utils/numbers';
import { EmptyState } from '../ui/EmptyState';
import { ListToolbar } from '../ui/ListControls';
import { ListResults } from '../ui/ListResults';

/** Clase de cada tono (la misma paleta que los catálogos con tono). */
const TONE_CLASS = { muted: 'badge--muted', info: 'badge--info', success: 'badge--success', warning: 'badge--warning', danger: 'badge--danger' } as const;

const signalsError = () => t('drift.loadError');
const SIGNAL_COLUMNS = ['signal', 'platform', 'samples', 'median', 'tail', 'psi', 'status'] as const;
const COMPANY_COLUMNS = ['company', 'attempts', 'cases', 'caseRate', 'reviews', 'quick', 'status'] as const;
/** Código de cada componente de la bitácora del motor (como lo anota el servidor) → su llave del diccionario. */
const COMPONENT_KEYS: Record<string, 'riskEngine' | 'faceModels' | 'api' | 'webapp' | undefined> = { risk_engine: 'riskEngine', face_models: 'faceModels', api: 'api', webapp: 'webapp' };

/** El estado de una señal, con su nombre del diccionario y su tono. */
export function DriftStatusBadge({ status }: { status: DriftStatus }) {
  const t = useT();
  return <span className={`badge ${TONE_CLASS[STATUS_TONE[status]]}`}>{t(`drift.status.${status}`)}</span>;
}

/** Una señal × plataforma de la semana: sus medidas frente a la semana anterior. */
function SignalCells({ row }: { row: DriftRow }) {
  const t = useT();
  return (
    <>
      <td className="table__primary">{row.signal_name}</td>
      <td data-label={t('drift.columns.platform')}>{t(`drift.platforms.${row.platform}`)}</td>
      <td data-label={t('drift.columns.samples')}>
        {formatCount(row.samples)}
        <small className="muted table__note">{t('drift.samplesBaseline', { count: row.baseline_samples })}</small>
      </td>
      <td data-label={t('drift.columns.median')}>
        {measure(row.median)}
        <small className="muted table__note">{t('drift.baseline', { value: measure(row.baseline_median) })}</small>
      </td>
      <td data-label={t('drift.columns.tail')}>
        {measure(row.tail)} <small className="muted">{changeText(row.tail_change)}</small>
        <small className="muted table__note">
          {t(tailKey(row))} · {t('drift.baseline', { value: measure(row.baseline_tail) })}
        </small>
      </td>
      <td data-label={t('drift.columns.psi')}>{psiText(row.psi)}</td>
      <td data-label={t('drift.columns.status')}>
        <DriftStatusBadge status={row.status} />
      </td>
    </>
  );
}

interface SignalsTabProps {
  week: string | null;
  platform: DriftPlatform | 'all';
  status: DriftStatus | 'all';
}

/** Señales × plataforma de la semana elegida, con sus filtros (la lista la pagina el backend). */
export function DriftSignalsTab({ week, platform, status }: SignalsTabProps) {
  const t = useT();
  const list = usePagedList(
    (query, signal) =>
      driftService.signals(
        { ...query, week: week ?? undefined, platform: platform === 'all' ? undefined : platform, status: status === 'all' ? undefined : status },
        signal,
      ),
    { errorTitle: signalsError, filterKey: `${week ?? ''}|${platform}|${status}` },
  );
  const filtered = platform !== 'all' || status !== 'all';
  return (
    <ListResults
      list={list}
      columns={SIGNAL_COLUMNS.map((column) => t(`drift.columns.${column}`))}
      pager={{ noun: { one: t('drift.noun.one'), other: t('drift.noun.other') } }}
      empty={
        filtered
          ? { icon: <SearchX />, title: t('drift.noMatch.title'), description: t('drift.noMatch.description'), compact: true }
          : { icon: <TrendingDown />, title: t('drift.empty.title'), description: t('drift.empty.description'), compact: true }
      }
      renderCells={(row) => <SignalCells row={row} />}
    />
  );
}

function CompanyCells({ row }: { row: CompanyDriftRow }) {
  const t = useT();
  return (
    <>
      <td className="table__primary">{row.company_name}</td>
      <td data-label={t('drift.companies.columns.attempts')}>{formatCount(row.attempts)}</td>
      <td data-label={t('drift.companies.columns.cases')}>{formatCount(row.fraud_cases)}</td>
      <td data-label={t('drift.companies.columns.caseRate')}>{rateText(row.case_rate)}</td>
      <td data-label={t('drift.companies.columns.reviews')}>{formatCount(row.reviews)}</td>
      <td data-label={t('drift.companies.columns.quick')}>
        {rateText(row.quick_rate)}
        <small className="muted table__note">{t('drift.companies.quickDetail', { quick: formatCount(row.quick_approvals), approved: formatCount(row.approved) })}</small>
      </td>
      <td data-label={t('drift.companies.columns.status')}>
        <span className={`badge ${TONE_CLASS[COMPANY_TONE[row.status]]}`}>{t(`drift.companies.status.${row.status}`)}</span>
      </td>
    </>
  );
}

/** Las empresas de la semana: casos por intento y revisiones aprobadas sin mirar (búsqueda por nombre). */
export function DriftCompaniesTab({ week, quickSeconds }: { week: string | null; quickSeconds: number | undefined }) {
  const t = useT();
  const list = useSearchList((query, signal) => driftService.companies({ page: query.page, size: query.size, search: query.search, week: week ?? undefined }, signal), {
    errorTitle: signalsError,
    filterKey: week ?? '',
  });
  return (
    <div className="stack">
      {quickSeconds !== undefined && <p className="muted small">{t('drift.companies.intro', { seconds: quickSeconds })}</p>}
      <ListToolbar search={list.search} onSearch={list.setSearch} placeholder={t('drift.companies.columns.company')} label={t('drift.companies.columns.company')} />
      <ListResults
        list={list}
        columns={COMPANY_COLUMNS.map((column) => t(`drift.companies.columns.${column}`))}
        pager={{ noun: { one: t('drift.companies.noun.one'), other: t('drift.companies.noun.other') } }}
        empty={
          list.filtered
            ? { icon: <SearchX />, title: t('drift.noMatch.title'), description: t('drift.noMatch.description'), compact: true }
            : { icon: <Building2 />, title: t('drift.companies.empty.title'), description: t('drift.companies.empty.description'), compact: true }
        }
        renderCells={(row) => <CompanyCells row={row} />}
      />
    </div>
  );
}

/** La bitácora del motor: los cambios de versión anotados (vienen con el resumen, acotados por el servidor). */
export function DriftVersions({ versions }: { versions: EngineVersion[] }) {
  const t = useT();
  // Los componentes que el servidor anota hoy, con su nombre; uno nuevo se muestra tal cual (su código es un dato).
  const componentName = (component: string) => {
    const key = COMPONENT_KEYS[component];
    return key ? t(`drift.versions.components.${key}`) : component;
  };
  return (
    <div className="stack">
      <p className="muted small">{t('drift.versions.intro')}</p>
      {versions.length === 0 ? (
        <EmptyState icon={<GitCommitVertical />} title={t('drift.versions.empty.title')} description={t('drift.versions.empty.description')} compact />
      ) : (
        <div className="table-wrap">
          <table className="table table--readonly">
            <thead>
              <tr>
                <th>{t('drift.versions.columns.component')}</th>
                <th>{t('drift.versions.columns.version')}</th>
                <th>{t('drift.versions.columns.notedAt')}</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr key={version.id}>
                  <td className="table__primary">{componentName(version.component)}</td>
                  <td data-label={t('drift.versions.columns.version')}>
                    <code>{version.version}</code>
                  </td>
                  <td data-label={t('drift.versions.columns.notedAt')}>{formatDateTime(version.noted_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
