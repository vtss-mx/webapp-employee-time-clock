import type {
  BillingAccount,
  BillingOverview,
  BillingPlan,
  Charge,
  ChargeDetail,
  CompanyBillingRow,
  CompanyUsage,
  CompanyUsageRow,
  Payment,
  PaymentResult,
  PeriodEstimate,
  PlanPreview,
  RouteUsage,
  StatementEntry,
  UsageCounters,
  UsageOverview,
  UserUsage,
} from '../types';
import { documentsReply } from './documents';
import { apiOk, type MockCall } from './http';

/** Datos de prueba de la cobranza y el consumo (empresa 4, "Panificadora"). */

export const plan: BillingPlan = {
  pricing_mode: 'PER_USER',
  unit_price: '120.00',
  price_period: 'MONTH',
  interval_months: 1,
  starts_on: '2026-09-01',
  trial_days: 0,
  discount: null,
  tax_rate: '16.00',
  grace_days: 10,
  currency: 'MXN',
  trial_ends_on: null,
  next_cut_on: '2026-10-31',
  forecast_total: '1392.00',
  forecast_at: '2026-10-04T06:00:00Z',
  updated_at: '2026-09-01T12:00:00Z',
};

export const account: BillingAccount = {
  company_id: 4,
  company_name: 'Panificadora',
  company_active: true,
  status: 'ACTIVE',
  currency: 'MXN',
  currency_locked: true,
  suspension: null,
  plan,
  balance: {
    charged: '2784.00',
    paid: '1392.00',
    outstanding: '1392.00',
    overdue: '0.00',
    credit: '0.00',
    balance: '1392.00',
    open_charges: 1,
    overdue_charges: 0,
    oldest_due_on: '2026-10-10',
    suspends_on: null,
    last_payment_on: '2026-09-05',
  },
  grace_until: null,
};

export const suspendedAccount: BillingAccount = {
  ...account,
  status: 'SUSPENDED',
  suspension: { reason: 'NON_PAYMENT', note: 'El cargo 1 siguió sin pagarse después de 10 días de gracia.', suspended_at: '2026-10-02T12:00:00Z', suspended_by: null },
  balance: { ...account.balance, overdue: '1392.00', overdue_charges: 1, oldest_due_on: '2026-09-20' },
};

export const noPlanAccount: BillingAccount = { ...account, plan: null, currency: null, currency_locked: false };

/** Una empresa cobrada en dólares (cliente del extranjero, IVA 0 %). */
export const usdPlan: BillingPlan = { ...plan, currency: 'USD', tax_rate: '0.00', unit_price: '10.00' };
export const usdAccount: BillingAccount = { ...account, company_id: 7, company_name: 'Northwind', currency: 'USD', plan: usdPlan };

export const preview: PlanPreview = {
  currency: 'MXN',
  trial_ends_on: null,
  first: {
    sequence: 1,
    cut_on: '2026-10-31',
    period_start: '2026-10-04',
    period_end: '2026-10-31',
    billable_days: 28,
    units: 280,
    lines: [{ month: '2026-10-01', days: 28, units: 280, amount: '1083.87' }],
    subtotal: '1083.87',
    discount: '0.00',
    tax: '173.42',
    total: '1257.29',
  },
  recurring: {
    sequence: 2,
    cut_on: '2026-11-30',
    period_start: '2026-11-01',
    period_end: '2026-11-30',
    billable_days: 30,
    units: 300,
    lines: [{ month: '2026-11-01', days: 30, units: 300, amount: '1200.00' }],
    subtotal: '1200.00',
    discount: '120.00',
    tax: '172.80',
    total: '1252.80',
  },
  monthly_equivalent: '1252.80',
};

export const estimate: PeriodEstimate = {
  currency: 'MXN',
  sequence: 2,
  cut_on: '2026-10-31',
  period_start: '2026-10-01',
  period_end: '2026-10-31',
  as_of: '2026-10-04',
  days_total: 31,
  days_elapsed: 4,
  in_trial: false,
  trial_ends_on: null,
  active_employees: 10,
  active_validators: 0,
  accrued: { units: 40, subtotal: '154.84' },
  forecast: { units: 310, subtotal: '1200.00', discount: '0.00', tax: '192.00', total: '1392.00' },
  lines: [{ month: '2026-10-01', days: 31, units: 310, amount: '1200.00', projected: true }],
};

export const charge: Charge = {
  id: 31,
  sequence: 1,
  currency: 'MXN',
  cut_on: '2026-09-30',
  period_start: '2026-09-01',
  period_end: '2026-09-30',
  issued_on: '2026-09-30',
  due_on: '2026-10-10',
  billable_days: 30,
  units: 300,
  subtotal: '1200.00',
  discount: '0.00',
  tax: '192.00',
  total: '1392.00',
  paid: '0.00',
  balance: '1392.00',
  status: 'OPEN',
  overdue: false,
  voided_at: null,
  void_reason: null,
};

export const chargeDetail: ChargeDetail = {
  ...charge,
  pricing_mode: 'PER_USER',
  unit_price: '120.00',
  price_period: 'MONTH',
  tax_rate: '16.00',
  // 9 empleados y un validador todo septiembre: 300 días-persona, 30 de ellos de validadores (el desglose).
  validator_units: 30,
  lines: [{ month: '2026-09-01', days: 30, units: 300, validator_units: 30, amount: '1200.00' }],
  allocations: [{ payment_id: 51, paid_on: '2026-10-01', reference: 'SPEI-1', amount: '500.00' }],
  voided_by: null,
};

export const payment: Payment = {
  id: 51,
  currency: 'MXN',
  amount: '500.00',
  paid_on: '2026-10-01',
  method: 'TRANSFER',
  reference: 'SPEI-1',
  note: null,
  status: 'CONFIRMED',
  applied: '500.00',
  unapplied: '0.00',
  receipt: { file_name: 'spei.pdf', content_type: 'application/pdf', size: 2048 },
  recorded_by: 'admin@plataforma.com',
  created_at: '2026-10-01T15:00:00Z',
  voided_at: null,
  void_reason: null,
  voided_by: null,
};

export const paymentResult: PaymentResult = {
  payment: { ...payment, amount: '1500.00', applied: '1392.00', unapplied: '108.00' },
  applied: [{ charge_id: 31, sequence: 1, cut_on: '2026-09-30', amount: '1392.00' }],
  account,
  reactivated: false,
};

export const statementEntries: StatementEntry[] = [
  { date: '2026-10-01', kind: 'PAYMENT', id: 1, description: 'Pago · Transferencia · SPEI-1', currency: 'MXN', debit: '0.00', credit: '500.00', balance: '892.00' },
  { date: '2026-09-30', kind: 'CHARGE', id: 1, description: 'Cargo 1 · sep 2026', currency: 'MXN', debit: '1392.00', credit: '0.00', balance: '1392.00' },
];

/** Resumen con dos monedas: nunca se suman (pesos y dólares por separado). */
export const overview: BillingOverview = {
  as_of: '2026-10-04',
  month_start: '2026-10-01',
  last_cut_on: '2026-09-30',
  currencies: [
    {
      currency: 'MXN',
      companies: 2,
      billed_month: '0.00',
      collected_month: '500.00',
      outstanding: '3676.00',
      overdue: '1392.00',
      overdue_companies: 1,
      credit: '108.00',
      forecast: '4176.00',
      last_cut_charges: 3,
      last_cut_total: '4176.00',
    },
    {
      currency: 'USD',
      companies: 1,
      billed_month: '0.00',
      collected_month: '0.00',
      outstanding: '250.00',
      overdue: '0.00',
      overdue_companies: 0,
      credit: '0.00',
      forecast: '250.00',
      last_cut_charges: 1,
      last_cut_total: '250.00',
    },
  ],
  companies: { total: 4, with_plan: 3, without_plan: 1, overdue: 1, suspended: 1, in_trial: 0 },
};

export const companyRow: CompanyBillingRow = {
  company_id: 4,
  name: 'Panificadora',
  rfc: 'PNO120315AB1',
  active: true,
  status: 'ACTIVE',
  currency: 'MXN',
  suspension_reason: null,
  plan: { pricing_mode: 'PER_USER', unit_price: '120.00', price_period: 'MONTH', interval_months: 1 },
  outstanding: '1392.00',
  overdue: '0.00',
  credit: '0.00',
  open_charges: 1,
  oldest_due_on: null,
  next_cut_on: '2026-10-31',
  forecast_total: '1392.00',
  last_payment_on: '2026-09-05',
};

export const page = <T>(items: T[], total = items.length) => apiOk({ items, total, page: 1, size: 10 });

/**
 * Responde lo de la cobranza que piden la ficha y la edición de una empresa (su cuenta y el periodo en
 * curso) y, de paso, la otra sección de la ficha que pide datos (sus documentos, vacíos); null si la llamada
 * no es de ninguna de las dos.
 */
export function billingReply(call: MockCall, current: BillingAccount = account): Response | null {
  const documents = documentsReply(call);
  if (documents) return documents;
  if (!call.url.includes('/admin/billing/')) return null;
  if (call.url.endsWith('/estimate')) return apiOk(estimate);
  if (call.url.endsWith('/preview')) return apiOk(preview);
  return apiOk(current);
}

// ---- Consumo

export const counters: UsageCounters = {
  requests: 12_400,
  bytes_in: 5 * 1024 * 1024,
  bytes_out: 2 * 1024 * 1024 * 1024,
  duration_ms: 1_860_000,
  avg_ms: 150,
  server_errors: 2,
  client_errors: 37,
};

export const usageOverview: UsageOverview = {
  start: '2026-10-01',
  end: '2026-10-04',
  totals: counters,
  days: [
    { ...counters, day: '2026-10-01', requests: 4000 },
    { ...counters, day: '2026-10-02', requests: 0, bytes_in: 0, bytes_out: 0 },
  ],
  storage: {
    day: '2026-10-04',
    rows: 9000,
    bytes: 30 * 1024 * 1024,
    items: [
      { category: 'BIOMETRICS', rows: 1000, bytes: 20 * 1024 * 1024 },
      { category: 'VERIFICATION', rows: 8000, bytes: 10 * 1024 * 1024 },
    ],
  },
  companies_with_traffic: 3,
};

export const usageRow: CompanyUsageRow = {
  ...counters,
  company_id: 4,
  name: 'Panificadora',
  active: true,
  status: 'ACTIVE',
  storage_bytes: 30 * 1024 * 1024,
  storage_rows: 9000,
  active_employees: 10,
  active_validators: 1,
  share: 62.5,
};

export const routeUsage: RouteUsage = { ...counters, route: 'GET /api/employees/{employee_id}', max_ms: 980 };

export const userUsage: UserUsage = { ...counters, user_id: 8, email: 'ana@pan.com', role: 'EMPLOYEE', name: 'Ana Ruiz', share: 40 };

export const companyUsage: CompanyUsage = {
  company_id: 4,
  name: 'Panificadora',
  status: 'ACTIVE',
  start: '2026-10-01',
  end: '2026-10-04',
  totals: counters,
  days: usageOverview.days,
  top_routes: [routeUsage],
  storage: usageOverview.storage,
  active_employees: 10,
  active_validators: 2,
  billing: { currency: 'MXN', pricing_mode: 'PER_USER', unit_price: '120.00', price_period: 'MONTH', forecast_total: '1392.00' },
};
