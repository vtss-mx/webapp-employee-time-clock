import { CalendarRange, FileX2, ListOrdered, Receipt, Tag, Wallet } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { FactList } from '../../../components/billing/AccountParts';
import { ChargeLines, MoneyRows, totalsRows } from '../../../components/billing/MoneyRows';
import { CatalogStatusBadge } from '../../../components/StatusBadge';
import { ButtonLink } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Panel, PanelGrid, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { RetryState } from '../../../components/ui/RetryState';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { useCatalogs } from '../../../hooks/useCatalogs';
import { useResource } from '../../../hooks/useResource';
import { t, useT } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { billingService } from '../../../services/billingService';
import type { ChargeDetail } from '../../../types';
import { currencyText, daysText, periodText, priceText, unitsText } from '../../../utils/billing';
import { formatDate, formatDateTime } from '../../../utils/format';
import { formatMoney, formatRate } from '../../../utils/numbers';

const chargeError = () => t('billing.charge.loadError');

/** Pagos que se aplicaron al cargo (a lo más unos cuantos: no se paginan), en su moneda. */
function Allocations({ charge }: { charge: ChargeDetail }) {
  const t = useT();
  if (!charge.allocations.length) {
    return <EmptyState compact icon={<Wallet />} title={t('billing.charge.noAllocations')} description={t('billing.charge.noAllocationsDescription')} />;
  }
  return (
    <ul className="allocation-list">
      {charge.allocations.map((allocation) => (
        <li key={allocation.payment_id}>
          <span className="person__info">
            <strong>{formatDate(allocation.paid_on)}</strong>
            <small>{allocation.reference ?? t('billing.charge.noReference')}</small>
          </span>
          <strong>{formatMoney(allocation.amount, charge.currency)}</strong>
        </li>
      ))}
    </ul>
  );
}

/**
 * Detalle de un cargo: su periodo, estado y vencimiento; el precio con que se emitió (copia del plan
 * de ese momento), lo que se cobró por mes, los totales (con lo pagado y el saldo) y los pagos que se le
 * aplicaron. Uno que no está anulado se puede anular (formulario con motivo).
 */
export function ChargeDetailPage() {
  const t = useT();
  const params = useParams();
  const companyId = Number(params.id);
  const chargeId = Number(params.chargeId);
  const { nameOf } = useCatalogs();
  const { data: charge, error, retry } = useResource((signal) => billingService.charge(companyId, chargeId, signal), `${companyId}|${chargeId}`, chargeError);
  const back = paths.admin.companyBilling(companyId);

  if (!charge) {
    return (
      <div className="page">
        <Panel>
          <PanelHeader title={t('billing.charge.title')} backTo={back} backLabel={t('billing.title')} />
          <PanelSection>{error ? <RetryState onRetry={retry} /> : <SkeletonCard lines={5} />}</PanelSection>
        </Panel>
      </div>
    );
  }

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={t('billing.charges.name', { sequence: charge.sequence })}
          backTo={back}
          backLabel={t('billing.title')}
          subtitle={
            <>
              <CatalogStatusBadge catalog="charge_statuses" code={charge.status} /> {periodText(charge.period_start, charge.period_end)}
              {charge.overdue && <span className="badge badge--danger">{t('billing.charges.overdue')}</span>}
            </>
          }
          actions={
            charge.status !== 'VOID' && (
              <ButtonLink to={paths.admin.voidCharge(companyId, charge.id)} variant="danger-outline" icon={<FileX2 size={18} />}>
                {t('billing.charge.voidTitle')}
              </ButtonLink>
            )
          }
        />
        <PanelGrid>
          <PanelSection title={t('billing.charge.period')} icon={<CalendarRange size={20} />}>
            <FactList
              items={[
                [t('billing.charge.cut'), formatDate(charge.cut_on)],
                [t('billing.charge.issued'), formatDate(charge.issued_on)],
                [t('billing.charges.columns.due'), formatDate(charge.due_on)],
                [t('billing.charge.billableDays'), daysText(charge.billable_days)],
                [t('billing.charge.billed'), unitsText(charge.units, charge.pricing_mode, charge.validator_units)],
              ]}
            />
          </PanelSection>
          <PanelSection title={t('billing.charge.appliedPrice')} icon={<Tag size={20} />}>
            <FactList
              items={[
                [t('billing.plan.facts.mode'), nameOf('pricing_modes', charge.pricing_mode)],
                [t('billing.plan.labels.currency'), currencyText(charge.currency, nameOf)],
                [t('billing.plan.labels.price'), priceText(charge.unit_price, charge.price_period, charge.currency, nameOf)],
                [t('billing.plan.labels.tax'), formatRate(charge.tax_rate, 2)],
              ]}
            />
          </PanelSection>
        </PanelGrid>
        <PanelSection title={t('billing.charge.lines')} icon={<ListOrdered size={20} />}>
          <ChargeLines lines={charge.lines} mode={charge.pricing_mode} currency={charge.currency} />
        </PanelSection>
        <PanelGrid>
          <PanelSection title={t('billing.charge.totals')} icon={<Receipt size={20} />}>
            <MoneyRows
              rows={[...totalsRows(charge), { label: t('billing.charge.paid'), value: charge.paid, kind: 'muted' }, { label: t('billing.charges.columns.balance'), value: charge.balance, kind: 'total' }]}
              currency={charge.currency}
              label={t('billing.charge.totalsLabel')}
            />
          </PanelSection>
          <PanelSection title={t('billing.charge.allocations')} icon={<Wallet size={20} />}>
            <Allocations charge={charge} />
          </PanelSection>
        </PanelGrid>
        {charge.status === 'VOID' && (
          <PanelSection title={t('billing.charge.voidedSection')} icon={<FileX2 size={20} />}>
            <FactList
              items={[
                [t('billing.charge.voidedAt'), formatDateTime(charge.voided_at)],
                [t('billing.charge.voidedBy'), charge.voided_by ?? '—'],
                [t('common.fields.reason'), charge.void_reason ?? '—'],
              ]}
            />
          </PanelSection>
        )}
      </Panel>
    </div>
  );
}
