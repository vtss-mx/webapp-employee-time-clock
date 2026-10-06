import { Ban, Banknote, Building2, Pencil, Power, Receipt, ReceiptText, ScrollText, Wallet } from 'lucide-react';
import { useId } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { AccountStatus, BalanceCards, EstimateBlock, PlanFacts } from '../../../components/billing/AccountParts';
import { ChargesTab, PaymentsTab, StatementTab } from '../../../components/billing/AccountTabs';
import { reactivateConfirm } from '../../../components/billing/billingConfirms';
import { Button, ButtonLink } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Panel, PanelGrid, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { RetryState } from '../../../components/ui/RetryState';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { TabPanel, Tabs, type TabItem } from '../../../components/ui/Tabs';
import { useAction } from '../../../hooks/useAction';
import { useBillingAccount, useEstimate } from '../../../hooks/useBillingAccount';
import { useCatalogs } from '../../../hooks/useCatalogs';
import { t, useT } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { billingService } from '../../../services/billingService';
import type { BillingAccount } from '../../../types';
import { planSummary } from '../../../utils/billing';

type AccountTab = 'charges' | 'payments' | 'statement';
const TAB_KEYS: readonly AccountTab[] = ['charges', 'payments', 'statement'];
const tabFrom = (value: string | null): AccountTab => TAB_KEYS.find((tab) => tab === value) ?? 'charges';

/** Pestañas de la cuenta (sus nombres se piden al dibujar: siguen al idioma activo). */
function accountTabs(): Array<TabItem<AccountTab>> {
  return [
    { key: 'charges', label: t('billing.tabs.charges'), icon: <ReceiptText size={16} /> },
    { key: 'payments', label: t('billing.tabs.payments'), icon: <Wallet size={16} /> },
    { key: 'statement', label: t('billing.tabs.statement'), icon: <ScrollText size={16} /> },
  ];
}

/* Avisos que se traducen al dibujarse (un popup abierto sigue al idioma activo). */
const reactivateError = () => t('billing.reactivate.error');
const reactivated = () => [t('billing.reactivate.done'), t('billing.reactivate.doneText')] as const;

interface AccountActionsProps {
  account: BillingAccount;
  busy: boolean;
  onReactivate: () => void;
}

/** Registrar un pago, suspender (formulario con motivo) o reactivar (confirmación). */
function AccountActions({ account, busy, onReactivate }: AccountActionsProps) {
  const t = useT();
  const id = account.company_id;
  return (
    <>
      <ButtonLink to={paths.admin.newPayment(id)} variant="primary" icon={<Banknote size={18} />}>
        {t('billing.payment.submit')}
      </ButtonLink>
      {account.status === 'SUSPENDED' ? (
        <Button variant="success" icon={<Power size={18} />} loading={busy} onClick={onReactivate}>
          {t('billing.reactivate.action')}
        </Button>
      ) : (
        <ButtonLink to={paths.admin.suspendCompany(id)} variant="danger-outline" icon={<Ban size={18} />}>
          {t('billing.suspend.action')}
        </ButtonLink>
      )}
    </>
  );
}

/**
 * Cobranza de una empresa (ADMIN): su estado (suspendida con su motivo), su plan (con su moneda), su saldo,
 * el cargo del periodo en curso y, en pestañas (`?tab=`), sus cargos, sus pagos y su estado de cuenta, todo
 * en la moneda de la empresa. Registrar un pago y suspender son formularios; reactivar se confirma aquí mismo.
 */
export function CompanyBillingPage() {
  const t = useT();
  const companyId = Number(useParams().id);
  const idBase = useId();
  const [params, setParams] = useSearchParams();
  const tab = tabFrom(params.get('tab'));
  const { nameOf } = useCatalogs();
  const account = useBillingAccount(companyId);
  const plan = account.data?.plan ?? null;
  const estimate = useEstimate(companyId, plan !== null);
  const action = useAction();

  if (!account.data) {
    return (
      <div className="page">
        <Panel>
          <PanelHeader title={t('billing.title')} backTo={paths.admin.billing} backLabel={t('billing.title')} />
          <PanelSection>{account.error ? <RetryState onRetry={account.retry} /> : <SkeletonCard lines={6} />}</PanelSection>
        </Panel>
      </div>
    );
  }
  const data = account.data;
  const reactivate = () =>
    void action.run(() => billingService.reactivate(companyId, null), {
      confirm: () => reactivateConfirm(data, nameOf),
      errorTitle: reactivateError,
      success: reactivated,
      onSuccess: account.setData,
    });

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={data.company_name}
          backTo={paths.admin.billing}
          backLabel={t('billing.title')}
          subtitle={plan ? planSummary(plan, plan.currency, nameOf) : t('billing.account.noPlanSubtitle')}
          actions={<AccountActions account={data} busy={action.busy !== null} onReactivate={reactivate} />}
        />
        <PanelGrid>
          <PanelSection
            title={t('billing.account.status')}
            icon={<Building2 size={20} />}
            aside={
              <ButtonLink to={paths.admin.company(companyId)} size="sm" variant="ghost">
                {t('billing.account.viewCompany')}
              </ButtonLink>
            }
          >
            <AccountStatus account={data} />
          </PanelSection>
          <PanelSection
            title={t('billing.account.plan')}
            icon={<Receipt size={20} />}
            aside={
              <ButtonLink to={paths.admin.editCompany(companyId)} size="sm" variant="secondary" icon={<Pencil size={16} />}>
                {t('billing.account.editPlan')}
              </ButtonLink>
            }
          >
            {plan ? (
              <PlanFacts plan={plan} locked={data.currency_locked} />
            ) : (
              <EmptyState compact icon={<Receipt />} title={t('billing.account.noPlan')} description={t('billing.account.noPlanDescription')} />
            )}
          </PanelSection>
        </PanelGrid>
        <PanelSection title={t('billing.account.balance')} icon={<Wallet size={20} />}>
          <BalanceCards balance={data.balance} currency={data.currency} />
        </PanelSection>
        {plan && (
          <PanelSection>
            <EstimateBlock estimate={estimate} mode={plan.pricing_mode} />
          </PanelSection>
        )}
        <PanelSection>
          <Tabs
            items={accountTabs()}
            value={tab}
            onChange={(next) => setParams(next === 'charges' ? {} : { tab: next }, { replace: true })}
            label={t('billing.tabs.label')}
            idBase={idBase}
          />
          <TabPanel idBase={idBase} tab={tab}>
            {tab === 'charges' && <ChargesTab companyId={companyId} />}
            {tab === 'payments' && <PaymentsTab companyId={companyId} />}
            {tab === 'statement' && <StatementTab companyId={companyId} />}
          </TabPanel>
        </PanelSection>
      </Panel>
    </div>
  );
}
