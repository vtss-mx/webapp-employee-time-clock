import { Banknote, FileText, Hash, Receipt } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { paymentConfirm } from '../../../components/billing/billingConfirms';
import { CurrencyField } from '../../../components/billing/CurrencyField';
import { FormField, TextAreaField } from '../../../components/FormField';
import { FormFooter } from '../../../components/FormFooter';
import { SelectField } from '../../../components/shifts/formFields';
import { DateField, parseIso } from '../../../components/ui/DateField';
import { FilePicker } from '../../../components/ui/FilePicker';
import { NumberField } from '../../../components/ui/NumberField';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { RetryState } from '../../../components/ui/RetryState';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { useBillingAccount } from '../../../hooks/useBillingAccount';
import { useCatalogs } from '../../../hooks/useCatalogs';
import { useFormState } from '../../../hooks/useFormState';
import { t, useT } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { ApiError, fieldErrorsFrom } from '../../../services/apiClient';
import { billingService } from '../../../services/billingService';
import type { BillingAccount, CurrencyCode, PaymentResult } from '../../../types';
import { DEFAULT_CURRENCY, PAYMENT_LIMITS, RECEIPT_TYPES, validateReceipt } from '../../../utils/billing';
import { catalogOptions } from '../../../utils/catalogs';
import { businessToday, formatDate } from '../../../utils/format';
import { formatMoney, moneyValue } from '../../../utils/numbers';

/** Lo que se captura como texto (el comprobante va aparte: es un archivo). */
interface PaymentValues {
  amount: string;
  paid_on: string;
  method: string;
  reference: string;
  note: string;
  /** La de la empresa; solo se elige si aún no tiene plan ni movimientos (este pago la fija). */
  currency: CurrencyCode;
}

/** Errores del comprobante que da el backend (tamaño o tipo). */
const RECEIPT_CODES = new Set(['RECEIPT_TOO_LARGE', 'RECEIPT_TYPE_NOT_ALLOWED']);
const saveError = () => t('billing.payment.error');

/** Reglas del pago (UX: el backend las vuelve a validar). */
function validatePayment(values: PaymentValues, today: string): Partial<Record<keyof PaymentValues, string>> {
  const amount = moneyValue(values.amount);
  const { min, max } = PAYMENT_LIMITS.amount;
  return {
    amount: !values.amount
      ? t('billing.payment.errors.amountMissing')
      : amount < min || amount > max
        ? t('billing.payment.errors.amountRange', { max: formatMoney(max, values.currency) })
        : undefined,
    paid_on: !parseIso(values.paid_on) ? t('billing.payment.errors.paidOnMissing') : values.paid_on > today ? t('billing.payment.errors.paidOnFuture') : undefined,
    method: values.method ? undefined : t('billing.payment.errors.method'),
  };
}

/** Aviso al registrar: a qué cargos se aplicó, cuánto quedó a favor y si la empresa se reactivó (en la moneda del pago). */
function paymentNotice(result: PaymentResult) {
  const { currency } = result.payment;
  const details = result.applied.map((item) =>
    t('billing.payment.notice.applied', { sequence: item.sequence, date: formatDate(item.cut_on), amount: formatMoney(item.amount, currency) }),
  );
  if (moneyValue(result.payment.unapplied) > 0) details.push(t('billing.payment.notice.credit', { amount: formatMoney(result.payment.unapplied, currency) }));
  if (result.reactivated) details.push(t('billing.payment.notice.reactivated'));
  return {
    variant: 'success' as const,
    title: t('billing.payment.notice.title'),
    text: result.applied.length ? t('billing.payment.notice.text') : t('billing.payment.notice.allCredit'),
    details,
    detailsStyle: 'checks' as const,
  };
}

/** Formulario del pago (la cuenta ya cargó): en la moneda de la empresa. */
function PaymentForm({ account }: { account: BillingAccount }) {
  const t = useT();
  const navigate = useNavigate();
  const { active, nameOf } = useCatalogs();
  const today = businessToday();
  const back = paths.admin.companyBilling(account.company_id);
  const methods = catalogOptions(active('payment_methods'));
  // Por omisión, el primer medio de pago activo del catálogo (sin ninguno, se pide elegirlo) y la moneda de la empresa.
  const form = useFormState<PaymentValues>(
    { amount: '', paid_on: today, method: methods[0]?.value ?? '', reference: '', note: '', currency: account.currency ?? DEFAULT_CURRENCY },
    { serverErrors: (error) => fieldErrorsFrom<PaymentValues>(error) },
  );
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptServerError, setReceiptServerError] = useState<string>();
  const { values } = form;
  const errors = form.visibleErrors(validatePayment(values, today));
  const receiptError = receiptServerError ?? validateReceipt(receipt);
  const set = (changes: Partial<PaymentValues>) => form.setValues({ ...values, ...changes });
  // Con plan o con movimientos la moneda es la de la empresa; sin ninguno, este pago la fija.
  const fixedCurrency = account.currency !== null;

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    const input = { ...values, receipt };
    form.saveIfValid(
      { ...validatePayment(values, today), receipt: receiptError },
      async () => {
        const result = await billingService.registerPayment(account.company_id, input).catch((error: unknown) => {
          if (error instanceof ApiError && RECEIPT_CODES.has(error.code)) setReceiptServerError(error.message);
          throw error;
        });
        void form.feedback.show(() => paymentNotice(result));
        void navigate(back, { replace: true });
      },
      saveError,
      () => paymentConfirm(account, input, nameOf),
    );
  };

  return (
    <Panel onSubmit={onSubmit}>
      <PanelHeader
        title={t('billing.payment.submit')}
        subtitle={t('billing.payment.subtitle', { name: account.company_name, amount: formatMoney(account.balance.outstanding, values.currency) })}
        backTo={back}
        backLabel={t('billing.title')}
      />
      <PanelSection title={t('billing.payment.section')} icon={<Banknote size={20} />}>
        <p className="muted">{t('billing.payment.intro')}</p>
        <div className="form-grid">
          <CurrencyField
            value={values.currency}
            onChange={(currency) => set({ currency })}
            hint={fixedCurrency ? t('billing.payment.currencyFixed', { currency: values.currency }) : t('billing.payment.currencyFirst')}
            error={errors.currency}
            disabled={form.saving || fixedCurrency}
          />
          <NumberField
            label={t('billing.payment.fields.amount')}
            value={values.amount}
            onChange={(amount) => set({ amount })}
            onBlur={() => form.touch('amount')}
            decimals={2}
            min={0}
            max={PAYMENT_LIMITS.amount.max}
            unit={values.currency}
            hint={t('billing.payment.amountHint')}
            error={errors.amount}
            required
            disabled={form.saving}
          />
          <DateField label={t('billing.payment.fields.paidOn')} name="paid_on" value={values.paid_on} max={today} onChange={(paid_on) => set({ paid_on })} error={errors.paid_on} required disabled={form.saving} />
          <SelectField
            label={t('billing.payment.fields.method')}
            value={values.method}
            options={methods}
            placeholder={t('billing.payment.methodPlaceholder')}
            onChange={(method) => set({ method })}
            error={errors.method}
            required
            disabled={form.saving}
          />
          <FormField
            label={t('billing.payment.fields.reference')}
            icon={<Hash size={18} />}
            value={values.reference}
            maxLength={PAYMENT_LIMITS.reference}
            placeholder={t('billing.payment.referencePlaceholder')}
            onChange={(e) => set({ reference: e.target.value })}
            hint={t('common.values.optional')}
            disabled={form.saving}
          />
          <TextAreaField
            label={t('common.fields.note')}
            className="form-grid__wide"
            value={values.note}
            onChange={(note) => set({ note })}
            maxLength={PAYMENT_LIMITS.note}
            counter
            hint={t('common.values.optional')}
            disabled={form.saving}
          />
        </div>
      </PanelSection>
      <PanelSection title={t('billing.payment.fields.receipt')} icon={<Receipt size={20} />}>
        <FilePicker
          label={t('billing.payment.receiptLabel')}
          value={receipt}
          onChange={(file) => {
            setReceipt(file);
            setReceiptServerError(undefined);
          }}
          accept={RECEIPT_TYPES.join(',')}
          icon={<FileText size={22} />}
          hint={t('billing.payment.receiptHint')}
          error={receiptError}
          disabled={form.saving}
          labels={{ drop: t('billing.payment.receiptDrop') }}
        />
      </PanelSection>
      <FormFooter submitLabel={t('billing.payment.submit')} submitIcon={<Banknote size={20} />} saving={form.saving} onCancel={() => void navigate(back)} />
    </Panel>
  );
}

/** Registrar un pago de una empresa (con su comprobante opcional). */
export function PaymentFormPage() {
  const companyId = Number(useParams().id);
  const account = useBillingAccount(companyId);
  return <div className="page">{account.data ? <PaymentForm account={account.data} /> : account.error ? <RetryState onRetry={account.retry} /> : <SkeletonCard lines={6} />}</div>;
}
