import { Building2, SearchX } from 'lucide-react';
import { useId, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CompanyCell } from '../../../components/billing/CompanyCell';
import { CatalogStatusBadge } from '../../../components/StatusBadge';
import { DailySection, StorageSection, UsageSummary } from '../../../components/usage/UsageParts';
import { ListToolbar } from '../../../components/ui/ListControls';
import { ListResults } from '../../../components/ui/ListResults';
import { Panel, PanelGrid, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { Select } from '../../../components/ui/Select';
import { useAutoRefresh } from '../../../hooks/useAutoRefresh';
import { useResource } from '../../../hooks/useResource';
import { useSearchList } from '../../../hooks/useSearchList';
import { useUsagePeriod } from '../../../hooks/useUsagePeriod';
import { t, useT } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { usageService } from '../../../services/usageService';
import type { CompanyUsageRow, UsageSort } from '../../../types';
import { headcountBreakdown, periodText } from '../../../utils/billing';
import { formatBytes, formatCount, formatDuration, formatRate } from '../../../utils/numbers';

const SORT_KEYS: readonly UsageSort[] = ['requests', 'bytes', 'duration', 'errors', 'storage'];

/** Órdenes del listado (sus nombres se piden al dibujar: siguen al idioma activo). */
const sortOptions = () => SORT_KEYS.map((value) => ({ value, label: t(`usage.sort.${value}`) }));

/* Títulos de los popups de falla: se traducen al dibujarse (un popup abierto sigue al idioma activo). */
const overviewError = () => t('usage.loadError');
const companiesError = () => t('usage.companies.loadError');

/** Celdas de una empresa en la lista de consumo. */
function CompanyCells({ row }: { row: CompanyUsageRow }) {
  const t = useT();
  return (
    <>
      <CompanyCell name={row.name} detail={t('usage.companies.active', { people: headcountBreakdown({ employees: row.active_employees, validators: row.active_validators }) })} />
      <td data-label={t('common.fields.status')}>
        <CatalogStatusBadge catalog="billing_statuses" code={row.status} />
      </td>
      <td data-label={t('usage.kpis.requests')}>
        {formatCount(row.requests)}
        <small className="muted table__note">{t('usage.companies.share', { share: formatRate(row.share) })}</small>
      </td>
      <td data-label={t('usage.columns.inOut')}>
        {formatBytes(row.bytes_in)} / {formatBytes(row.bytes_out)}
      </td>
      <td data-label={t('usage.columns.time')}>
        {formatDuration(row.duration_ms)}
        <small className="muted table__note">{t('usage.average', { time: formatDuration(row.avg_ms) })}</small>
      </td>
      <td data-label={t('usage.columns.errors')}>
        {formatCount(row.server_errors)} / {formatCount(row.client_errors)}
      </td>
      <td data-label={t('usage.kpis.storage')}>{formatBytes(row.storage_bytes)}</td>
    </>
  );
}

/**
 * Consumo de la plataforma (ADMIN): en el rango elegido (`?start=&end=`), las peticiones, los datos
 * que entran y salen, el tiempo de proceso y los errores, día por día; el almacenamiento por categoría;
 * y las empresas ordenadas por lo que más consumen, con su parte del total. Se actualiza sola mientras
 * se ve.
 */
export function UsagePage() {
  const t = useT();
  const navigate = useNavigate();
  const { search: currentQuery } = useLocation();
  const sortId = useId();
  const period = useUsagePeriod();
  const { start, end } = period.range;
  const [sort, setSort] = useState<UsageSort>('requests');
  const overview = useResource((signal) => usageService.overview({ start, end }, signal), `${start}|${end}`, overviewError);
  const list = useSearchList<CompanyUsageRow>((query, signal) => usageService.companies({ start, end, page: query.page, size: query.size, search: query.search, sort }, signal), {
    errorTitle: companiesError,
    filterKey: `${start}|${end}|${sort}`,
  });
  useAutoRefresh(() => {
    overview.retry();
    list.retry();
  });
  const data = overview.data;

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={t('usage.title')}
          subtitle={data ? t('usage.subtitle', { period: periodText(data.start, data.end), count: data.companies_with_traffic }) : t('common.states.loading')}
        />
        <UsageSummary period={period} data={data} error={overview.error} retry={overview.retry} />
        <PanelGrid>
          <DailySection data={data} />
          <StorageSection data={data} />
        </PanelGrid>
        <PanelSection title={t('usage.companies.title')} icon={<Building2 size={20} />}>
          <ListToolbar search={list.search} onSearch={list.setSearch} placeholder={t('usage.companies.searchPlaceholder')} label={t('usage.companies.searchLabel')} />
          <div className="toolbar">
            <span className="muted" id={sortId}>
              {t('usage.sort.label')}
            </span>
            <Select<UsageSort> value={sort} onChange={setSort} options={sortOptions()} aria-labelledby={sortId} />
          </div>
          <ListResults
            list={list}
            rowKey={(row) => row.company_id}
            pager={{ noun: { one: t('usage.companies.noun.one'), other: t('usage.companies.noun.other') } }}
            columns={[
              t('common.fields.company'),
              t('common.fields.status'),
              t('usage.kpis.requests'),
              t('usage.columns.inOut'),
              t('usage.columns.time'),
              t('usage.columns.errors'),
              t('usage.kpis.storage'),
            ]}
            onOpen={(row) => void navigate({ pathname: paths.admin.companyUsage(row.company_id), search: currentQuery })}
            empty={
              list.filtered
                ? { icon: <SearchX />, title: t('usage.companies.noMatchTitle'), description: t('usage.companies.noMatchDescription') }
                : { icon: <Building2 />, title: t('usage.companies.emptyTitle'), description: t('usage.otherRange') }
            }
            renderCells={(row) => <CompanyCells row={row} />}
          />
        </PanelSection>
      </Panel>
    </div>
  );
}
