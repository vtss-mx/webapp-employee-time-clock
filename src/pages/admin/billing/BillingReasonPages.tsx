import { Ban, FileX2, Undo2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { suspendConfirm, voidChargeConfirm, voidPaymentConfirm } from '../../../components/billing/billingConfirms';
import { ReasonFormPanel } from '../../../components/ReasonFormPanel';
import { RetryState } from '../../../components/ui/RetryState';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { useBillingAccount } from '../../../hooks/useBillingAccount';
import { useCatalogs } from '../../../hooks/useCatalogs';
import { useFeedback } from '../../../hooks/useFeedback';
import { useResource } from '../../../hooks/useResource';
import { t, useT, type LazyText } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { billingService } from '../../../services/billingService';
import type { Payment } from '../../../types';
import type { ConfirmSource } from '../../../types/confirm';
import { periodText, validateBillingReason } from '../../../utils/billing';
import { formatDate } from '../../../utils/format';
import { hasKeys } from '../../../utils/guards';
import { formatMoney } from '../../../utils/numbers';

interface BillingReasonFormProps {
  title: string;
  subtitle: string;
  /** A dónde regresa (al cancelar y al terminar). */
  backTo: string;
  backLabel: string;
  intro: ReactNode;
  icon: ReactNode;
  submit: { label: string; icon: ReactNode; disabledTitle?: string; disabled?: boolean };
  confirm: (reason: string) => ConfirmSource;
  send: (reason: string) => Promise<unknown>;
  errorTitle: LazyText;
  /** Aviso al terminar (título y detalle), armado al dibujarse: sigue al idioma activo. */
  success: () => readonly [string, string];
}

/* Títulos de los popups de falla: se traducen al dibujarse (un popup abierto sigue al idioma activo). */
const chargeError = () => t('billing.charge.loadError');

/**
 * Formulario con motivo de la cobranza (anular un pago o un cargo, suspender una empresa): el motivo
 * es obligatorio (5 a 300 caracteres, como el backend), se confirma antes de enviar y al terminar se
 * avisa y se regresa.
 */
function BillingReasonForm({ title, subtitle, backTo, backLabel, intro, icon, submit, confirm, send, errorTitle, success }: BillingReasonFormProps) {
  const t = useT();
  const navigate = useNavigate();
  const feedback = useFeedback();
  return (
    <ReasonFormPanel
      title={title}
      subtitle={subtitle}
      backTo={backTo}
      backLabel={backLabel}
      intro={intro}
      icon={icon}
      field={{ label: t('common.fields.reason'), placeholder: t('billing.reason.placeholder'), required: true }}
      validate={validateBillingReason}
      submit={{ ...submit, variant: 'danger' }}
      confirm={confirm}
      errorTitle={errorTitle}
      onSend={async (reason) => {
        await send(reason);
        void feedback.success(() => success()[0], () => success()[1]);
        void navigate(backTo, { replace: true });
      }}
      onCancel={() => void navigate(backTo)}
    />
  );
}

/** Suspender una empresa: se cierran AHORA todas sus sesiones y nadie entra hasta reactivarla. */
export function SuspendCompanyPage() {
  const t = useT();
  const companyId = Number(useParams().id);
  const { nameOf } = useCatalogs();
  const account = useBillingAccount(companyId);
  if (!account.data) return account.error ? <RetryState onRetry={account.retry} /> : <SkeletonCard lines={4} />;
  const data = account.data;
  return (
    <BillingReasonForm
      title={t('billing.suspend.title')}
      subtitle={data.company_name}
      backTo={paths.admin.companyBilling(companyId)}
      backLabel={t('billing.title')}
      icon={<Ban size={20} />}
      intro={t('billing.suspend.intro')}
      submit={{ label: t('billing.suspend.action'), icon: <Ban size={18} />, disabled: data.status === 'SUSPENDED', disabledTitle: t('billing.suspend.already') }}
      confirm={(reason) => () => suspendConfirm(data, reason, nameOf)}
      send={(reason) => billingService.suspend(companyId, reason)}
      errorTitle={() => t('billing.suspend.error')}
      success={() => [t('billing.suspend.done'), t('billing.suspend.doneText')]}
    />
  );
}

/** Anular un cargo: ya no se cobra y lo que se le había aplicado queda a favor. */
export function VoidChargePage() {
  const t = useT();
  const params = useParams();
  const companyId = Number(params.id);
  const chargeId = Number(params.chargeId);
  const { nameOf } = useCatalogs();
  const charge = useResource((signal) => billingService.charge(companyId, chargeId, signal), `${companyId}|${chargeId}`, chargeError);
  if (!charge.data) return charge.error ? <RetryState onRetry={charge.retry} /> : <SkeletonCard lines={4} />;
  const data = charge.data;
  return (
    <BillingReasonForm
      title={t('billing.charge.voidTitleOf', { sequence: data.sequence })}
      subtitle={`${periodText(data.period_start, data.period_end)} · ${formatMoney(data.total, data.currency)}`}
      backTo={paths.admin.charge(companyId, chargeId)}
      backLabel={t('billing.charges.name', { sequence: data.sequence })}
      icon={<FileX2 size={20} />}
      intro={t('billing.charge.voidIntro')}
      submit={{ label: t('billing.charge.voidTitle'), icon: <FileX2 size={18} />, disabled: data.status === 'VOID', disabledTitle: t('billing.charge.alreadyVoid') }}
      confirm={(reason) => () => voidChargeConfirm(data, reason, nameOf)}
      send={(reason) => billingService.voidCharge(companyId, chargeId, reason)}
      errorTitle={() => t('billing.charge.voidError')}
      success={() => [t('billing.charge.voided'), t('billing.charge.voidedText', { sequence: data.sequence })]}
    />
  );
}

const isPayment = hasKeys<Payment>('id', 'amount', 'paid_on', 'method', 'status');

/**
 * Anular un pago: los cargos que cubría vuelven a quedar por pagar. Sus datos llegan desde la lista de
 * pagos (estado de la navegación); abierto desde un enlace, se identifica por su número.
 */
export function VoidPaymentPage() {
  const t = useT();
  const params = useParams();
  const companyId = Number(params.id);
  const paymentId = Number(params.paymentId);
  const { nameOf } = useCatalogs();
  const state: unknown = useLocation().state;
  const given = (state as { payment?: unknown } | null)?.payment;
  const payment = isPayment(given) && given.id === paymentId ? given : null;
  const back = `${paths.admin.companyBilling(companyId)}?tab=payments`;
  return (
    <BillingReasonForm
      title={t('billing.payments.voidTitle')}
      subtitle={
        payment
          ? [formatMoney(payment.amount, payment.currency), formatDate(payment.paid_on), nameOf('payment_methods', payment.method)].join(' · ')
          : t('billing.payments.name', { id: paymentId })
      }
      backTo={back}
      backLabel={t('billing.tabs.payments')}
      icon={<Undo2 size={20} />}
      intro={t('billing.payments.voidIntro')}
      submit={{ label: t('billing.payments.voidTitle'), icon: <Undo2 size={18} />, disabled: payment?.status === 'VOID', disabledTitle: t('billing.payments.alreadyVoid') }}
      confirm={(reason) => () => voidPaymentConfirm(paymentId, payment, reason, nameOf)}
      send={(reason) => billingService.voidPayment(companyId, paymentId, reason)}
      errorTitle={() => t('billing.payments.voidError')}
      success={() => [t('billing.payments.voided'), t('billing.payments.voidedText')]}
    />
  );
}
