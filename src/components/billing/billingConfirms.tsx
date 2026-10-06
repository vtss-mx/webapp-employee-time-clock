import { Ban, Banknote, FileX2, Power, Undo2 } from 'lucide-react';
import { t } from '../../i18n';
import type { BillingAccount, ChargeDetail, Payment, PaymentInput } from '../../types';
import type { ConfirmDetail, ConfirmInput } from '../../types/confirm';
import { currencyText, daysText, periodText } from '../../utils/billing';
import type { CatalogApi } from '../../utils/catalogs';
import { formatDate } from '../../utils/format';
import { formatMoney } from '../../utils/numbers';

/**
 * Confirmaciones de la cobranza (decisión del dueño del producto: nada cambia por accidente). Cada una
 * dice qué pasará, sobre quién, en qué moneda y qué no se puede deshacer; los nombres de estados,
 * motivos, medios de pago y monedas salen de los catálogos. Se arman al dibujarse (quien las pide pasa una
 * función): una confirmación abierta sigue al idioma activo.
 */

type NameOf = CatalogApi['nameOf'];

/** Suspender: se cierran AHORA todas las sesiones de la empresa y nadie entra hasta reactivarla. */
export function suspendConfirm(account: BillingAccount, reason: string, nameOf: NameOf): ConfirmInput {
  return {
    tone: 'danger',
    icon: <Ban size={30} />,
    eyebrow: t('billing.title'),
    title: t('billing.confirm.suspend.title', { name: account.company_name }),
    message: t('billing.confirm.suspend.message'),
    changes: [{ label: t('common.fields.status'), before: nameOf('billing_statuses', 'ACTIVE'), after: nameOf('billing_statuses', 'SUSPENDED') }],
    details: [
      { label: t('common.fields.reason'), value: reason },
      { label: t('billing.balance.outstanding'), value: formatMoney(account.balance.outstanding, account.currency) },
      { label: t('billing.balance.overdue'), value: formatMoney(account.balance.overdue, account.currency) },
    ],
    note: t('billing.confirm.suspend.note'),
    confirmLabel: t('billing.confirm.suspend.confirm'),
    confirmIcon: <Ban size={18} />,
  };
}

/** Reactivar: el acceso vuelve ya y el periodo de gracia empieza de nuevo. */
export function reactivateConfirm(account: BillingAccount, nameOf: NameOf): ConfirmInput {
  const details: ConfirmDetail[] = [{ label: t('billing.balance.overdue'), value: formatMoney(account.balance.overdue, account.currency) }];
  if (account.suspension) details.unshift({ label: t('billing.confirm.reactivate.suspensionReason'), value: nameOf('suspension_reasons', account.suspension.reason) });
  return {
    tone: 'success',
    icon: <Power size={30} />,
    eyebrow: t('billing.title'),
    title: t('billing.confirm.reactivate.title', { name: account.company_name }),
    message: account.plan ? t('billing.confirm.reactivate.messageGrace', { grace: daysText(account.plan.grace_days) }) : t('billing.confirm.reactivate.message'),
    changes: [{ label: t('common.fields.status'), before: nameOf('billing_statuses', 'SUSPENDED'), after: nameOf('billing_statuses', 'ACTIVE') }],
    details,
    confirmLabel: t('billing.confirm.reactivate.confirm'),
    confirmIcon: <Power size={18} />,
  };
}

/** Registrar un pago: qué se registra (con su moneda, la de la empresa) y a qué se aplica. */
export function paymentConfirm(account: BillingAccount, payment: PaymentInput, nameOf: NameOf): ConfirmInput {
  const amount = formatMoney(payment.amount, payment.currency);
  const details: ConfirmDetail[] = [
    { label: t('common.fields.company'), value: account.company_name },
    { label: t('billing.payment.fields.amount'), value: amount },
    { label: t('billing.plan.labels.currency'), value: currencyText(payment.currency, nameOf) },
    { label: t('billing.payment.fields.paidOn'), value: formatDate(payment.paid_on) },
    { label: t('billing.payment.fields.method'), value: nameOf('payment_methods', payment.method) },
  ];
  if (payment.reference.trim()) details.push({ label: t('billing.payment.fields.reference'), value: payment.reference.trim() });
  if (payment.note.trim()) details.push({ label: t('common.fields.note'), value: payment.note.trim() });
  details.push({ label: t('billing.payment.fields.receipt'), value: payment.receipt?.name ?? t('billing.payment.noReceipt') });
  return {
    kind: 'create',
    icon: <Banknote size={30} />,
    title: t('billing.confirm.payment.title', { amount }),
    message: t('billing.confirm.payment.message'),
    detailsTitle: t('billing.confirm.payment.detailsTitle'),
    details,
    note: account.suspension?.reason === 'NON_PAYMENT' ? t('billing.confirm.payment.reactivates') : undefined,
    confirmLabel: t('billing.payment.submit'),
    confirmIcon: <Banknote size={18} />,
  };
}

/** Anular un pago: los cargos que cubría vuelven a quedar por pagar. Sin sus datos (se abrió de un enlace), su número. */
export function voidPaymentConfirm(paymentId: number, payment: Payment | null, reason: string, nameOf: NameOf): ConfirmInput {
  const what = payment
    ? [formatMoney(payment.amount, payment.currency), formatDate(payment.paid_on), nameOf('payment_methods', payment.method)].join(' · ')
    : t('billing.payments.name', { id: paymentId });
  return {
    tone: 'danger',
    icon: <Undo2 size={30} />,
    eyebrow: t('billing.title'),
    title: payment ? t('billing.confirm.voidPayment.titleAmount', { amount: formatMoney(payment.amount, payment.currency) }) : t('billing.confirm.voidPayment.title'),
    message: t('billing.confirm.voidPayment.message'),
    details: [
      { label: t('billing.payments.columns.payment'), value: what },
      { label: t('common.fields.reason'), value: reason },
    ],
    note: t('billing.confirm.voidPayment.note'),
    confirmLabel: t('billing.payments.voidTitle'),
    confirmIcon: <Undo2 size={18} />,
  };
}

/** Anular un cargo: ya no se cobra y lo que se le había aplicado queda a favor. */
export function voidChargeConfirm(charge: ChargeDetail, reason: string, nameOf: NameOf): ConfirmInput {
  return {
    tone: 'danger',
    icon: <FileX2 size={30} />,
    eyebrow: t('billing.title'),
    title: t('billing.confirm.voidCharge.title', { sequence: charge.sequence }),
    message: t('billing.confirm.voidCharge.message'),
    changes: [{ label: t('common.fields.status'), before: nameOf('charge_statuses', charge.status), after: nameOf('charge_statuses', 'VOID') }],
    details: [
      { label: t('billing.charges.columns.period'), value: periodText(charge.period_start, charge.period_end) },
      { label: t('billing.totals.total'), value: formatMoney(charge.total, charge.currency) },
      { label: t('billing.charge.paid'), value: formatMoney(charge.paid, charge.currency) },
      { label: t('common.fields.reason'), value: reason },
    ],
    note: t('common.notes.irreversible'),
    confirmLabel: t('billing.charge.voidTitle'),
    confirmIcon: <FileX2 size={18} />,
  };
}
