import { AlertTriangle, Ban, BadgeDollarSign, Building2, CalendarCheck, Coins, FlaskConical, HandCoins, PiggyBank, Receipt, SearchX, TrendingUp, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CompanyCell } from '../../../components/billing/CompanyCell';
import { CatalogStatusBadge } from '../../../components/StatusBadge';
import { Checkbox } from '../../../components/ui/Checkbox';
import { EmptyState } from '../../../components/ui/EmptyState';
import { KpiGrid, type Kpi } from '../../../components/ui/KpiCard';
import { ListToolbar } from '../../../components/ui/ListControls';
import { ListResults } from '../../../components/ui/ListResults';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { RetryState } from '../../../components/ui/RetryState';
import { useAutoRefresh } from '../../../hooks/useAutoRefresh';
import { useCatalogs } from '../../../hooks/useCatalogs';
import { useResource } from '../../../hooks/useResource';
import { useSearchList } from '../../../hooks/useSearchList';
import { t, useT } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { billingService } from '../../../services/billingService';
import type { BillingOverview, CompanyBillingRow, CurrencyCode, CurrencyTotals } from '../../../types';
import { currencyText, planSummary } from '../../../utils/billing';
import { formatDate } from '../../../utils/format';
import { formatCount, formatMoney, moneyValue } from '../../../utils/numbers';

/* Títulos de los popups de falla: se traducen al dibujarse (un popup abierto sigue al idioma activo). */
const overviewError = () => t('billing.overview.loadError');
const companiesError = () => t('billing.companies.loadError');

/**
 * Indicadores de dinero de UNA moneda (montos con IVA): nunca se suman monedas distintas ni se
 * convierten. Sin datos todavía (`totals` null), los indicadores muestran su esqueleto.
 */
function moneyKpis(totals: CurrencyTotals | null, lastCutOn: string | null, currency: CurrencyCode | null): Kpi[] {
  const money = (value: string | undefined) => (value === undefined ? undefined : moneyValue(value));
  const format = (value: number) => formatMoney(value, currency);
  const lastCut = totals ? (lastCutOn ? t('billing.overview.lastCutHint', { count: totals.last_cut_charges, date: formatDate(lastCutOn) }) : t('billing.overview.noCuts')) : undefined;
  return [
    { key: 'billed', label: t('billing.overview.billed'), icon: Receipt, value: money(totals?.billed_month), format },
    { key: 'collected', label: t('billing.overview.collected'), icon: HandCoins, value: money(totals?.collected_month), format, tile: 'icon-tile--success' },
    { key: 'outstanding', label: t('billing.overview.outstanding'), icon: Wallet, value: money(totals?.outstanding), format },
    {
      key: 'overdue',
      label: t('billing.balance.overdue'),
      icon: AlertTriangle,
      value: money(totals?.overdue),
      format,
      tile: 'icon-tile--danger',
      hint: totals ? t('billing.overview.overdueCompanies', { count: totals.overdue_companies }) : undefined,
    },
    { key: 'credit', label: t('billing.balance.credit'), icon: PiggyBank, value: money(totals?.credit), format, tile: 'icon-tile--success' },
    { key: 'forecast', label: t('billing.overview.forecast'), icon: TrendingUp, value: money(totals?.forecast), format, hint: t('billing.overview.forecastHint') },
    { key: 'last-cut', label: t('billing.overview.lastCut'), icon: CalendarCheck, value: money(totals?.last_cut_total), format, hint: lastCut },
  ];
}

/** El dinero de la plataforma: un bloque por moneda (con su nombre y cuántas empresas cobra), nunca sumadas. */
function MoneyByCurrency({ overview }: { overview: BillingOverview | null }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  if (!overview) return <KpiGrid kpis={moneyKpis(null, null, null)} />;
  if (!overview.currencies.length) {
    return <EmptyState compact icon={<Coins />} title={t('billing.overview.emptyTitle')} description={t('billing.overview.emptyDescription')} />;
  }
  return (
    <div className="stack">
      {overview.currencies.map((group) => (
        <section key={group.currency} className="currency-group stack" aria-label={currencyText(group.currency, nameOf)}>
          <h3 className="currency-group__title">
            <span className="currency-group__code">{currencyText(group.currency, nameOf)}</span>
            <small className="muted">{t('billing.overview.companiesWithPlan', { count: group.companies })}</small>
          </h3>
          <KpiGrid kpis={moneyKpis(group, overview.last_cut_on, group.currency)} />
        </section>
      ))}
    </div>
  );
}

/** Indicadores de las empresas: con y sin plan, vencidas, suspendidas y en demo (conteos, sin moneda). */
function companyKpis(overview: BillingOverview | null): Kpi[] {
  const companies = overview?.companies;
  return [
    {
      key: 'with-plan',
      label: t('billing.overview.withPlan'),
      icon: Building2,
      value: companies?.with_plan,
      hint: companies ? t('billing.overview.withoutPlan', { without: formatCount(companies.without_plan), total: formatCount(companies.total) }) : undefined,
    },
    { key: 'overdue', label: t('billing.overview.overdue'), icon: AlertTriangle, value: companies?.overdue, tile: 'icon-tile--warning' },
    { key: 'suspended', label: t('billing.overview.suspended'), icon: Ban, value: companies?.suspended, tile: 'icon-tile--danger' },
    { key: 'trial', label: t('billing.overview.inTrial'), icon: FlaskConical, value: companies?.in_trial },
  ];
}

/** Celdas de una empresa en la lista de cobranza (sus importes, en su moneda). */
function CompanyCells({ row }: { row: CompanyBillingRow }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  const { currency } = row;
  return (
    <>
      <CompanyCell name={row.name} detail={row.plan && currency ? planSummary(row.plan, currency, nameOf) : t('billing.account.noPlan')} />
      <td data-label={t('common.fields.status')}>
        <CatalogStatusBadge catalog="billing_statuses" code={row.status} />
        {row.suspension_reason && <small className="muted table__note">{nameOf('suspension_reasons', row.suspension_reason)}</small>}
      </td>
      <td data-label={t('billing.companies.columns.outstanding')}>
        {formatMoney(row.outstanding, currency)}
        <small className="muted table__note">{t('billing.balance.openCharges', { count: row.open_charges })}</small>
      </td>
      <td data-label={t('billing.balance.overdue')}>
        <span className={moneyValue(row.overdue) > 0 ? 'text-danger' : undefined}>{formatMoney(row.overdue, currency)}</span>
        {row.oldest_due_on && <small className="muted table__note">{t('billing.companies.overdueSince', { date: formatDate(row.oldest_due_on) })}</small>}
      </td>
      <td data-label={t('billing.companies.columns.credit')}>{formatMoney(row.credit, currency)}</td>
      <td data-label={t('billing.plan.facts.nextCut')}>
        {formatDate(row.next_cut_on)}
        {row.forecast_total && <small className="muted table__note">≈ {formatMoney(row.forecast_total, currency)}</small>}
      </td>
      <td data-label={t('billing.companies.columns.lastPayment')}>{formatDate(row.last_payment_on)}</td>
    </>
  );
}

/**
 * Cobranza de la plataforma (ADMIN): por cada moneda en uso, lo facturado y cobrado del mes, la cartera
 * (por cobrar, vencido, a favor), el pronóstico y el último corte (nunca se suman monedas distintas); y las
 * empresas con su saldo en su moneda (la más vencida primero), con búsqueda, estado y "solo con saldo
 * vencido". Se actualiza sola cada minuto mientras se ve.
 */
export function BillingPage() {
  const t = useT();
  const navigate = useNavigate();
  const { nameOf } = useCatalogs();
  const [overdueOnly, setOverdueOnly] = useState(false);
  const overview = useResource((signal) => billingService.overview(signal), 'billing-overview', overviewError);
  const list = useSearchList<CompanyBillingRow>(
    (query, signal) =>
      billingService.companies(
        {
          page: query.page,
          size: query.size,
          search: query.search,
          // El filtro de estado de la barra (activas / suspendidas) es el estado de cobranza.
          status: query.active === undefined ? undefined : query.active ? 'ACTIVE' : 'SUSPENDED',
          overdue: overdueOnly || undefined,
        },
        signal,
      ),
    { errorTitle: companiesError, filterKey: String(overdueOnly) },
  );
  useAutoRefresh(() => {
    overview.retry();
    list.retry();
  });
  const filtered = list.filtered || overdueOnly;

  return (
    <div className="page">
      <Panel>
        <PanelHeader title={t('billing.title')} subtitle={overview.data ? t('billing.overview.subtitle', { date: formatDate(overview.data.as_of) }) : t('common.states.loading')} />
        <PanelSection title={t('billing.overview.money')} icon={<BadgeDollarSign size={20} />}>
          {Boolean(overview.error) && !overview.data && <RetryState onRetry={overview.retry} />}
          <MoneyByCurrency overview={overview.data} />
        </PanelSection>
        <PanelSection title={t('billing.overview.companies')} icon={<Building2 size={20} />}>
          <KpiGrid kpis={companyKpis(overview.data)} />
          <ListToolbar
            search={list.search}
            onSearch={list.setSearch}
            placeholder={t('billing.companies.searchPlaceholder')}
            label={t('billing.companies.searchLabel')}
            filter={list.filter}
            onFilter={list.setFilter}
            labels={{ active: nameOf('billing_statuses', 'ACTIVE'), inactive: nameOf('billing_statuses', 'SUSPENDED') }}
          />
          <div className="toolbar">
            <Checkbox variant="inline" size="sm" label={t('billing.companies.overdueOnly')} checked={overdueOnly} onChange={setOverdueOnly} />
          </div>
          <ListResults
            list={list}
            rowKey={(row) => row.company_id}
            pager={{ noun: { one: t('billing.companies.noun.one'), other: t('billing.companies.noun.other') } }}
            columns={[
              t('common.fields.company'),
              t('common.fields.status'),
              t('billing.companies.columns.outstanding'),
              t('billing.balance.overdue'),
              t('billing.companies.columns.credit'),
              t('billing.plan.facts.nextCut'),
              t('billing.companies.columns.lastPayment'),
            ]}
            onOpen={(row) => void navigate(paths.admin.companyBilling(row.company_id))}
            empty={
              filtered
                ? { icon: <SearchX />, title: t('billing.companies.noMatchTitle'), description: t('billing.companies.noMatchDescription') }
                : { icon: <Building2 />, title: t('billing.companies.emptyTitle'), description: t('billing.companies.emptyDescription') }
            }
            renderCells={(row) => <CompanyCells row={row} />}
          />
        </PanelSection>
      </Panel>
    </div>
  );
}
