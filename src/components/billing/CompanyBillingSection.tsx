import { ArrowRight, Pencil, Receipt } from 'lucide-react';
import { useBillingAccount, useEstimate } from '../../hooks/useBillingAccount';
import { useHasScreen } from '../../hooks/useHasScreen';
import { useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { ButtonLink } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { PanelSection } from '../ui/Panel';
import { RetryState } from '../ui/RetryState';
import { SkeletonCard } from '../ui/Skeleton';
import { AccountStatus, BalanceCards, EstimateBlock, PlanFacts } from './AccountParts';

/**
 * "Cobranza" en la ficha de una empresa: su estado (suspendida, con el motivo), su plan, su saldo y el
 * cargo del periodo en curso. "Abrir cobranza" (cargos, pagos, estado de cuenta, suspender) solo se
 * ofrece si el backend le dio esa pantalla al usuario.
 */
export function CompanyBillingSection({ companyId }: { companyId: number }) {
  const t = useT();
  const canOpen = useHasScreen('ADMIN_BILLING');
  const account = useBillingAccount(companyId);
  const plan = account.data?.plan ?? null;
  const estimate = useEstimate(companyId, plan !== null);

  return (
    <PanelSection
      title={t('billing.title')}
      icon={<Receipt size={20} />}
      aside={
        canOpen && (
          <ButtonLink to={paths.admin.companyBilling(companyId)} size="sm" variant="secondary" iconRight={<ArrowRight size={16} />}>
            {t('billing.account.open')}
          </ButtonLink>
        )
      }
    >
      {!account.data ? (
        account.error ? (
          <RetryState onRetry={account.retry} />
        ) : (
          <SkeletonCard lines={4} />
        )
      ) : (
        <div className="billing-summary stack">
          <AccountStatus account={account.data} />
          {plan ? (
            <PlanFacts plan={plan} locked={account.data.currency_locked} />
          ) : (
            <EmptyState
              compact
              icon={<Receipt />}
              title={t('billing.account.noPlan')}
              description={t('billing.account.noPlanSection')}
              action={
                <ButtonLink to={paths.admin.editCompany(companyId)} size="sm" variant="primary" icon={<Pencil size={16} />}>
                  {t('billing.account.addPlan')}
                </ButtonLink>
              }
            />
          )}
          <BalanceCards balance={account.data.balance} currency={account.data.currency} />
          {plan && <EstimateBlock estimate={estimate} mode={plan.pricing_mode} />}
        </div>
      )}
    </PanelSection>
  );
}
