import type {
  BillingAccount,
  BillingCompaniesQuery,
  BillingOverview,
  BillingPlanInput,
  Charge,
  ChargeDetail,
  ChargeStatus,
  ChargeVoidResult,
  CompanyBillingRow,
  Headcount,
  Page,
  PageQuery,
  Payment,
  PaymentInput,
  PaymentResult,
  PaymentStatus,
  PaymentVoidResult,
  PeriodEstimate,
  PlanPreview,
  ReceiptFile,
  StatementEntry,
} from '../types';
import { config } from '../utils/config';
import { hasKeys, isPage } from '../utils/guards';
import { apiRequest } from './apiClient';

const isAccount = hasKeys<BillingAccount>('company_id', 'status', 'currency', 'currency_locked', 'plan', 'balance');
const isPreview = hasKeys<PlanPreview>('currency', 'first', 'recurring', 'monthly_equivalent');
const isOverview = hasKeys<BillingOverview>('last_cut_on', 'currencies', 'companies');
const isRow = hasKeys<CompanyBillingRow>('company_id', 'name', 'status', 'currency', 'outstanding');
const isEstimate = hasKeys<PeriodEstimate>('currency', 'period_start', 'period_end', 'accrued', 'forecast', 'lines');
const isCharge = hasKeys<Charge>('id', 'sequence', 'currency', 'status', 'total', 'balance');
const isChargeDetail = hasKeys<ChargeDetail>('id', 'sequence', 'currency', 'status', 'lines', 'allocations');
const isPayment = hasKeys<Payment>('id', 'currency', 'amount', 'paid_on', 'method', 'status');
const isPaymentResult = hasKeys<PaymentResult>('payment', 'applied', 'account', 'reactivated');
const isPaymentVoid = hasKeys<PaymentVoidResult>('payment', 'account');
const isChargeVoid = hasKeys<ChargeVoidResult>('charge', 'account');
const isReceipt = hasKeys<ReceiptFile>('file_name', 'content_type', 'data');
const isEntry = hasKeys<StatementEntry>('date', 'kind', 'id', 'currency', 'debit', 'credit', 'balance');

const base = (companyId: number) => `/admin/billing/companies/${companyId}`;

/** Multipart del pago: los datos (con su moneda, la de la empresa) y, si hay, el comprobante (el navegador pone el boundary). */
function paymentForm({ amount, currency, paid_on, method, reference, note, receipt }: PaymentInput): FormData {
  const form = new FormData();
  form.append('amount', amount);
  form.append('currency', currency);
  form.append('paid_on', paid_on);
  form.append('method', method);
  if (reference.trim()) form.append('reference', reference.trim());
  if (note.trim()) form.append('note', note.trim());
  if (receipt) form.append('receipt', receipt, receipt.name);
  return form;
}

/**
 * Cobranza de las empresas (solo el ADMIN): plan, vista previa del cobro, cargos, pagos, estado de
 * cuenta, suspensión y reactivación. El backend calcula todo el dinero; la app solo lo muestra, cada
 * importe en la moneda que trae su respuesta (`currency`).
 */
export const billingService = {
  /** Lo que se cobraría con un plan (el primer cargo y un periodo completo), sin guardar nada. */
  /** Lo que costará el plan con esos empleados y validadores activos (el backend cobra cada validador como un empleado). */
  preview(plan: BillingPlanInput, { employees, validators }: Headcount, signal?: AbortSignal): Promise<PlanPreview> {
    const body = { plan, employees, validators };
    return apiRequest<PlanPreview>('/admin/billing/preview', { method: 'POST', body, signal, validate: isPreview });
  },

  overview(signal?: AbortSignal): Promise<BillingOverview> {
    return apiRequest<BillingOverview>('/admin/billing/overview', { signal, validate: isOverview });
  },

  /** Empresas con su saldo (la más vencida primero, luego por nombre). */
  companies(query: BillingCompaniesQuery, signal?: AbortSignal): Promise<Page<CompanyBillingRow>> {
    return apiRequest<Page<CompanyBillingRow>>('/admin/billing/companies', { query: { ...query }, signal, validate: isPage(isRow) });
  },

  account(companyId: number, signal?: AbortSignal): Promise<BillingAccount> {
    return apiRequest<BillingAccount>(base(companyId), { signal, validate: isAccount });
  },

  /** Crea o reemplaza el plan: aplica desde el próximo cargo (los emitidos no cambian). */
  savePlan(companyId: number, plan: BillingPlanInput): Promise<BillingAccount> {
    return apiRequest<BillingAccount>(`${base(companyId)}/plan`, { method: 'PUT', body: plan, validate: isAccount });
  },

  /** Cargo del periodo en curso: lo devengado hasta hoy y el pronóstico (404 sin plan). */
  estimate(companyId: number, signal?: AbortSignal): Promise<PeriodEstimate> {
    return apiRequest<PeriodEstimate>(`${base(companyId)}/estimate`, { signal, validate: isEstimate });
  },

  charges(companyId: number, query: PageQuery & { status?: ChargeStatus }, signal?: AbortSignal): Promise<Page<Charge>> {
    return apiRequest<Page<Charge>>(`${base(companyId)}/charges`, { query: { ...query }, signal, validate: isPage(isCharge) });
  },

  charge(companyId: number, chargeId: number, signal?: AbortSignal): Promise<ChargeDetail> {
    return apiRequest<ChargeDetail>(`${base(companyId)}/charges/${chargeId}`, { signal, validate: isChargeDetail });
  },

  voidCharge(companyId: number, chargeId: number, reason: string): Promise<ChargeVoidResult> {
    return apiRequest<ChargeVoidResult>(`${base(companyId)}/charges/${chargeId}/void`, { method: 'POST', body: { reason }, validate: isChargeVoid });
  },

  payments(companyId: number, query: PageQuery & { status?: PaymentStatus }, signal?: AbortSignal): Promise<Page<Payment>> {
    return apiRequest<Page<Payment>>(`${base(companyId)}/payments`, { query: { ...query }, signal, validate: isPage(isPayment) });
  },

  /** Registra un pago en la moneda de la empresa (con su comprobante opcional): se aplica al cargo abierto más antiguo. */
  registerPayment(companyId: number, payment: PaymentInput): Promise<PaymentResult> {
    return apiRequest<PaymentResult>(`${base(companyId)}/payments`, {
      method: 'POST',
      body: paymentForm(payment),
      timeoutMs: config.apiUploadTimeoutMs,
      validate: isPaymentResult,
    });
  },

  /** Comprobante de un pago (base64 en `data`). */
  receipt(companyId: number, paymentId: number): Promise<ReceiptFile> {
    return apiRequest<ReceiptFile>(`${base(companyId)}/payments/${paymentId}/receipt`, { timeoutMs: config.apiUploadTimeoutMs, validate: isReceipt });
  },

  voidPayment(companyId: number, paymentId: number, reason: string): Promise<PaymentVoidResult> {
    return apiRequest<PaymentVoidResult>(`${base(companyId)}/payments/${paymentId}/void`, { method: 'POST', body: { reason }, validate: isPaymentVoid });
  },

  /** Cierra al momento todas las sesiones de la empresa: nadie entra hasta reactivarla. */
  suspend(companyId: number, reason: string): Promise<BillingAccount> {
    return apiRequest<BillingAccount>(`${base(companyId)}/suspend`, { method: 'POST', body: { reason }, validate: isAccount });
  },

  /** Devuelve el acceso de inmediato y da sus días de gracia antes de volver a suspenderse sola. */
  reactivate(companyId: number, note: string | null): Promise<BillingAccount> {
    return apiRequest<BillingAccount>(`${base(companyId)}/reactivate`, { method: 'POST', body: { note }, validate: isAccount });
  },

  /** Estado de cuenta (cargos y pagos con el saldo acumulado; el más reciente primero). */
  statement(companyId: number, query: PageQuery, signal?: AbortSignal): Promise<Page<StatementEntry>> {
    return apiRequest<Page<StatementEntry>>(`${base(companyId)}/statement`, { query: { ...query }, signal, validate: isPage(isEntry) });
  },
};
