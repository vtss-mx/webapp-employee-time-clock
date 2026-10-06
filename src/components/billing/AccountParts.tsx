import { AlertTriangle, CalendarClock, CircleCheck, Lock, PiggyBank, RefreshCw, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import type { EstimateResource } from '../../hooks/useBillingAccount';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useT } from '../../i18n';
import type { BillingAccount, BillingBalance, BillingPlan, CurrencyCode, PeriodEstimate, PricingMode } from '../../types';
import { cadenceText, currencyText, daysText, discountText, headcountBreakdown, periodText, priceText, unitsText } from '../../utils/billing';
import { formatDate, formatDateTime } from '../../utils/format';
import { formatMoney, formatRate, moneyValue } from '../../utils/numbers';
import { CatalogStatusBadge } from '../StatusBadge';
import { Button } from '../ui/Button';
import { KpiGrid, type Kpi } from '../ui/KpiCard';
import { RangeMeter } from '../ui/RangeMeter';
import { RetryState } from '../ui/RetryState';
import { SkeletonCard } from '../ui/Skeleton';
import { ChargeLines, MoneyRows, totalsRows } from './MoneyRows';

/** Datos "Etiqueta: valor" en la cuadrícula de detalles de la app. */
export function FactList({ items, className = '' }: { items: ReadonlyArray<readonly [string, ReactNode]>; className?: string }) {
  return (
    <dl className={`details ${className}`.trim()}>
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Estado de cobranza: activa o suspendida (motivo, desde cuándo, quién y su detalle). */
export function AccountStatus({ account }: { account: BillingAccount }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  const { suspension } = account;
  return (
    <div className="billing-status">
      <div className="row">
        <CatalogStatusBadge catalog="billing_statuses" code={account.status} />
        {!account.company_active && <span className="badge badge--muted">{t('billing.account.companyInactive')}</span>}
      </div>
      {suspension && (
        <FactList
          className="billing-status__facts"
          items={[
            [t('billing.account.suspension.reason'), nameOf('suspension_reasons', suspension.reason)],
            [t('billing.account.suspension.since'), formatDateTime(suspension.suspended_at)],
            [t('billing.account.suspension.by'), suspension.suspended_by ?? t('billing.account.suspension.automatic')],
            [t('billing.account.suspension.detail'), suspension.note ?? t('billing.account.suspension.noDetail')],
          ]}
        />
      )}
      {!suspension && account.grace_until && <p className="muted">{t('billing.account.graceUntil', { date: formatDate(account.grace_until) })}</p>}
    </div>
  );
}

/** "MXN · Peso mexicano" con el candado cuando ya no se puede cambiar (tiene cargos o pagos). */
export function CurrencyFact({ currency, locked }: { currency: CurrencyCode; locked: boolean }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  return (
    <span className="currency-fact">
      {currencyText(currency, nameOf)}
      {locked && (
        <small className="muted currency-fact__lock" title={t('billing.currency.lockedHint')}>
          <Lock size={14} aria-hidden /> {t('billing.currency.locked')}
        </small>
      )}
    </span>
  );
}

/** El plan de cobro de la empresa, completo (con su moneda), su próximo corte y el pronóstico del periodo. */
export function PlanFacts({ plan, locked }: { plan: BillingPlan; locked: boolean }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  return (
    <FactList
      items={[
        [t('billing.plan.facts.mode'), nameOf('pricing_modes', plan.pricing_mode)],
        [t('billing.plan.labels.currency'), <CurrencyFact key="currency" currency={plan.currency} locked={locked} />],
        [t('billing.plan.labels.price'), priceText(plan.unit_price, plan.price_period, plan.currency, nameOf)],
        [t('billing.plan.labels.cadence'), cadenceText(plan.interval_months)],
        [t('billing.plan.labels.startsOn'), formatDate(plan.starts_on)],
        [t('billing.plan.labels.trial'), plan.trial_ends_on ? t('billing.plan.facts.trialUntil', { date: formatDate(plan.trial_ends_on) }) : t('billing.plan.noTrial')],
        [t('billing.plan.labels.discount'), discountText(plan.discount, plan.currency)],
        [t('billing.plan.labels.tax'), formatRate(plan.tax_rate, 2)],
        [t('billing.plan.labels.grace'), daysText(plan.grace_days)],
        [t('billing.plan.facts.nextCut'), formatDate(plan.next_cut_on)],
        [
          t('billing.plan.facts.forecast'),
          plan.forecast_total ? t('billing.amountWithTax', { amount: formatMoney(plan.forecast_total, plan.currency) }) : t('billing.plan.facts.forecastPending'),
        ],
      ]}
    />
  );
}

/** Saldo de la empresa en su moneda: por pagar, vencido, a favor y pagado; y cuándo se suspendería sola. */
export function BalanceCards({ balance, currency }: { balance: BillingBalance; currency: CurrencyCode | null }) {
  const t = useT();
  const money = (value: number) => formatMoney(value, currency);
  const overdue = moneyValue(balance.overdue) > 0;
  const kpis: Kpi[] = [
    {
      key: 'outstanding',
      label: t('billing.balance.outstanding'),
      icon: Wallet,
      value: moneyValue(balance.outstanding),
      format: money,
      hint: t('billing.balance.openCharges', { count: balance.open_charges }),
    },
    {
      key: 'overdue',
      label: t('billing.balance.overdue'),
      icon: AlertTriangle,
      value: moneyValue(balance.overdue),
      format: money,
      tile: overdue ? 'icon-tile--danger' : 'icon-tile--success',
      hint: overdue ? t('billing.balance.overdueSince', { count: balance.overdue_charges, date: formatDate(balance.oldest_due_on) }) : t('billing.balance.nothingOverdue'),
    },
    { key: 'credit', label: t('billing.balance.credit'), icon: PiggyBank, value: moneyValue(balance.credit), format: money, tile: 'icon-tile--success', hint: t('billing.balance.creditHint') },
    {
      key: 'paid',
      label: t('billing.balance.paid'),
      icon: CircleCheck,
      value: moneyValue(balance.paid),
      format: money,
      hint: balance.last_payment_on ? t('billing.balance.lastPayment', { date: formatDate(balance.last_payment_on) }) : t('billing.balance.noPayments'),
    },
  ];
  return (
    <div className="stack">
      <KpiGrid kpis={kpis} />
      {balance.suspends_on && (
        <p className="billing-fact billing-fact--danger">
          <CalendarClock size={18} aria-hidden /> {t('billing.balance.suspendsOn', { date: formatDate(balance.suspends_on) })}
        </p>
      )}
    </div>
  );
}

/** El periodo en curso: avance, empleados activos, lo devengado y el pronóstico del cargo con sus meses (en su moneda). */
export function EstimateView({ estimate, mode }: { estimate: PeriodEstimate; mode: PricingMode }) {
  const t = useT();
  const { currency } = estimate;
  return (
    <div className="estimate stack">
      <div className="row">
        <strong>{t('billing.estimate.charge', { sequence: estimate.sequence, period: periodText(estimate.period_start, estimate.period_end) })}</strong>
        <span className="muted">{t('billing.estimate.cutOn', { date: formatDate(estimate.cut_on) })}</span>
        {estimate.in_trial && (
          <span className="badge badge--info">
            {estimate.trial_ends_on ? t('billing.estimate.inTrialUntil', { date: formatDate(estimate.trial_ends_on) }) : t('billing.estimate.inTrial')}
          </span>
        )}
      </div>
      <RangeMeter
        label={t('billing.estimate.progress', { elapsed: estimate.days_elapsed, total: estimate.days_total })}
        value={estimate.days_elapsed}
        min={0}
        max={estimate.days_total}
        format={daysText}
        labels={{ min: t('billing.estimate.start'), max: t('billing.estimate.cut') }}
      />
      <FactList
        items={[
          // Lo que falta del periodo se estima con empleados y validadores activos (un validador cuenta como un empleado).
          [t('billing.estimate.activeToday'), headcountBreakdown({ employees: estimate.active_employees, validators: estimate.active_validators })],
          [t('billing.estimate.accrued'), `${formatMoney(estimate.accrued.subtotal, currency)} · ${unitsText(estimate.accrued.units, mode, estimate.accrued.validator_units)}`],
          [t('billing.estimate.toBill'), unitsText(estimate.forecast.units, mode, estimate.forecast.validator_units)],
          [t('billing.estimate.asOf'), formatDate(estimate.as_of)],
        ]}
      />
      <MoneyRows rows={totalsRows(estimate.forecast)} currency={currency} label={t('billing.estimate.forecast')} />
      <ChargeLines lines={estimate.lines} mode={mode} currency={currency} />
    </div>
  );
}

/** "Periodo en curso" con "Actualizar": el pronóstico lo recalcula el backend con los empleados de hoy. */
export function EstimateBlock({ estimate, mode }: { estimate: EstimateResource; mode: PricingMode }) {
  const t = useT();
  return (
    <section className="estimate-block stack">
      <div className="estimate-block__head">
        <h3>{t('billing.estimate.title')}</h3>
        <Button size="sm" variant="ghost" icon={<RefreshCw size={16} />} loading={estimate.loading} onClick={estimate.retry}>
          {t('common.actions.refresh')}
        </Button>
      </div>
      {estimate.data ? <EstimateView estimate={estimate.data} mode={mode} /> : estimate.error ? <RetryState onRetry={estimate.retry} /> : <SkeletonCard lines={4} />}
    </section>
  );
}
