import { Route, UserRound, Users } from 'lucide-react';
import { useCatalogs } from '../../hooks/useCatalogs';
import { usePagedList } from '../../hooks/usePagedList';
import { t, useT } from '../../i18n';
import { usageService } from '../../services/usageService';
import type { CompanyUsage, UsageCounters } from '../../types';
import { headcountBreakdown, priceText } from '../../utils/billing';
import { BYTES_PER_MB, formatBytes, formatCount, formatDuration, formatMoney, formatRate, moneyValue } from '../../utils/numbers';
import type { DayRange } from '../../utils/usage';
import { FactList } from '../billing/AccountParts';
import { BarList } from '../ui/BarList';
import { EmptyState } from '../ui/EmptyState';
import { ListResults } from '../ui/ListResults';

/* Títulos de los popups de falla: se traducen al dibujarse (un popup abierto sigue al idioma activo). */
const usersError = () => t('usage.users.loadError');
const routesError = () => t('usage.routes.loadError');

/** Columnas comunes a usuarios y rutas (se piden al dibujar). */
const counterColumns = () => [t('usage.kpis.requests'), t('usage.columns.inOut'), t('usage.columns.time'), t('usage.columns.errors')];

/** Celdas de consumo comunes a usuarios y rutas: peticiones, datos, tiempo y errores. */
function CounterCells({ counters }: { counters: UsageCounters }) {
  const t = useT();
  return (
    <>
      <td data-label={t('usage.kpis.requests')}>{formatCount(counters.requests)}</td>
      <td data-label={t('usage.columns.inOut')}>
        {formatBytes(counters.bytes_in)} / {formatBytes(counters.bytes_out)}
      </td>
      <td data-label={t('usage.columns.time')}>
        {formatDuration(counters.duration_ms)}
        <small className="muted table__note">{t('usage.average', { time: formatDuration(counters.avg_ms) })}</small>
      </td>
      <td data-label={t('usage.columns.errors')}>
        {formatCount(counters.server_errors)} / {formatCount(counters.client_errors)}
      </td>
    </>
  );
}

/**
 * Lo que cuesta la empresa frente a lo que consume, en SU moneda (la de su plan): su plan, el pronóstico
 * del cargo en curso y, como ESTIMACIÓN, ese pronóstico entre las peticiones y los datos del rango elegido
 * (los periodos pueden no coincidir: es una referencia, no un cobro). Los datos, por MB (regla 17).
 */
export function CostFigures({ usage }: { usage: CompanyUsage }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  const { billing, totals } = usage;
  if (!billing) {
    return <EmptyState compact icon={<UserRound />} title={t('billing.account.noPlan')} description={t('usage.cost.noPlan')} />;
  }
  const { currency } = billing;
  const forecast = billing.forecast_total ? moneyValue(billing.forecast_total) : null;
  const megabytes = (totals.bytes_in + totals.bytes_out) / BYTES_PER_MB;
  const estimate = (divisor: number, per: string) =>
    forecast !== null && divisor > 0 ? t('usage.cost.estimate', { amount: formatMoney(forecast / divisor, currency), per }) : t('usage.cost.notEnough');
  return (
    <div className="stack">
      <FactList
        items={[
          [t('usage.cost.active'), headcountBreakdown({ employees: usage.active_employees, validators: usage.active_validators })],
          [t('usage.cost.plan'), `${nameOf('pricing_modes', billing.pricing_mode)} · ${priceText(billing.unit_price, billing.price_period, currency, nameOf)}`],
          [t('usage.cost.forecast'), forecast !== null ? t('billing.amountWithTax', { amount: formatMoney(forecast, currency) }) : t('billing.plan.facts.forecastPending')],
          [t('usage.cost.perThousandRequests', { thousand: formatCount(1000) }), estimate(totals.requests / 1000, t('usage.cost.perThousand', { thousand: formatCount(1000) }))],
          [t('usage.cost.perMegabyte'), estimate(megabytes, t('usage.cost.perMb'))],
        ]}
      />
      <p className="muted small">{t('usage.cost.note')}</p>
    </div>
  );
}

/** Las rutas de la API más usadas por la empresa (las 5 con más peticiones del rango). */
export function TopRoutes({ usage }: { usage: CompanyUsage }) {
  const t = useT();
  if (!usage.top_routes.length) {
    return <EmptyState compact icon={<Route />} title={t('usage.routes.emptyTitle')} description={t('usage.otherRange')} />;
  }
  return (
    <BarList
      label={t('usage.routes.top')}
      format={formatCount}
      items={usage.top_routes.map((route) => ({
        key: route.route,
        label: <code>{route.route}</code>,
        value: route.requests,
        detail: t('usage.average', { time: formatDuration(route.avg_ms) }),
        title: route.route,
      }))}
    />
  );
}

/** Usuarios de la empresa con su consumo (más peticiones primero) y su parte del total de la empresa. */
export function UsersTab({ companyId, range }: { companyId: number; range: DayRange }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  const list = usePagedList((page, signal) => usageService.users(companyId, { ...range, ...page }, signal), {
    errorTitle: usersError,
    filterKey: `${companyId}|${range.start}|${range.end}`,
  });
  return (
    <ListResults
      list={list}
      rowKey={(user) => user.user_id}
      pager={{ noun: { one: t('usage.users.noun.one'), other: t('usage.users.noun.other') } }}
      columns={[t('usage.users.user'), t('usage.users.role'), ...counterColumns(), t('usage.users.share')]}
      empty={{ icon: <Users />, title: t('usage.users.emptyTitle'), description: t('usage.otherRange'), compact: true }}
      renderCells={(user) => (
        <>
          <td className="table__primary">
            <span className="person__info">
              <strong className="truncate">{user.name ?? user.email ?? t('usage.users.unknown', { id: user.user_id })}</strong>
              <small className="truncate">{user.name ? user.email : t('usage.users.notEmployee')}</small>
            </span>
          </td>
          <td data-label={t('usage.users.role')}>{nameOf('roles', user.role, '—')}</td>
          <CounterCells counters={user} />
          <td data-label={t('usage.users.share')}>{formatRate(user.share)}</td>
        </>
      )}
    />
  );
}

/** Rutas de la API que usó la empresa (más peticiones primero), con su tiempo máximo. */
export function RoutesTab({ companyId, range }: { companyId: number; range: DayRange }) {
  const t = useT();
  const list = usePagedList((page, signal) => usageService.routes(companyId, { ...range, ...page }, signal), {
    errorTitle: routesError,
    filterKey: `${companyId}|${range.start}|${range.end}`,
  });
  return (
    <ListResults
      list={list}
      rowKey={(route) => route.route}
      pager={{ noun: { one: t('usage.routes.noun.one'), other: t('usage.routes.noun.other') } }}
      columns={[t('usage.routes.route'), ...counterColumns(), t('usage.routes.max')]}
      empty={{ icon: <Route />, title: t('usage.routes.emptyTitle'), description: t('usage.otherRange'), compact: true }}
      renderCells={(route) => (
        <>
          <td className="table__primary table__wide">
            <code className="truncate">{route.route}</code>
          </td>
          <CounterCells counters={route} />
          <td data-label={t('usage.routes.max')}>{formatDuration(route.max_ms)}</td>
        </>
      )}
    />
  );
}
