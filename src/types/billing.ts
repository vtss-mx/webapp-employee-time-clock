// Cobranza de las empresas (solo el ADMIN de la plataforma). Contrato con el backend: dinero como texto
// decimal con 2 decimales ("1234.50", precios SIN IVA salvo `tax`/`total`) en la moneda que dice cada
// respuesta (`currency`, código ISO 4217: la del plan de la empresa), fechas "YYYY-MM-DD" del día del
// negocio e instantes ISO-8601 con zona. La app nunca supone una moneda ni suma importes de monedas distintas.

/** Dinero: texto decimal con 2 decimales, en la moneda de su respuesta (`currency`). */
export type Money = string;
/** Código ISO 4217 de una moneda del catálogo `currencies` (MXN, USD, EUR). */
export type CurrencyCode = string;
export type PricingMode = 'PER_USER' | 'FLAT';
export type PricePeriod = 'DAY' | 'MONTH' | 'YEAR';
export type DiscountType = 'PERCENT' | 'AMOUNT';
export type DiscountRecurrence = 'ALWAYS' | 'FIRST' | 'EVERY';
export type BillingStatus = 'ACTIVE' | 'SUSPENDED';
export type SuspensionReason = 'NON_PAYMENT' | 'MANUAL';
export type ChargeStatus = 'OPEN' | 'PAID' | 'VOID';
export type PaymentStatus = 'CONFIRMED' | 'VOID';

export interface BillingDiscount {
  type: DiscountType;
  /** PERCENT: 0.01..100; AMOUNT: mayor que 0. */
  value: Money;
  recurrence: DiscountRecurrence;
  /** Obligatorio (1..120) con FIRST o EVERY; null con ALWAYS. */
  periods: number | null;
}

/** Lo que se envía: alta de empresa, editar el plan y la vista previa. */
export interface BillingPlanInput {
  pricing_mode: PricingMode;
  /** Sin IVA: por empleado activo (PER_USER) o de la empresa (FLAT), por `price_period`. 0..1 000 000. */
  unit_price: Money;
  price_period: PricePeriod;
  /** Un cargo cada N meses (1..12); el corte es el último día del mes. */
  interval_months: number;
  /** null = hoy (día del negocio). Puede ser pasado o futuro. */
  starts_on: string | null;
  /** Días de demo sin cobro desde `starts_on` (0..365). */
  trial_days: number;
  discount: BillingDiscount | null;
  /** Porcentaje de IVA (0..100). */
  tax_rate: Money;
  /** Días después del vencimiento antes de suspender sola (0..90). */
  grace_days: number;
  /** Moneda de todo el cobro de la empresa (catálogo `currencies`); fija desde su primer cargo o pago. */
  currency: CurrencyCode;
}

export interface BillingPlan extends Omit<BillingPlanInput, 'starts_on'> {
  starts_on: string;
  /** Último día de la demo (null sin demo). */
  trial_ends_on: string | null;
  /** Próximo corte (fin de mes). */
  next_cut_on: string;
  /** Pronóstico (con IVA) del cargo del periodo en curso; lo refresca el mantenimiento a diario. */
  forecast_total: Money | null;
  forecast_at: string | null;
  updated_at: string;
}

export interface Suspension {
  reason: SuspensionReason;
  /** Motivo escrito por el ADMIN (manual) o la explicación automática. */
  note: string | null;
  suspended_at: string;
  /** Correo del ADMIN (null = automática). */
  suspended_by: string | null;
}

export interface BillingBalance {
  /** Total de cargos no anulados. */
  charged: Money;
  /** Aplicado a cargos. */
  paid: Money;
  /** Saldo de los cargos abiertos. */
  outstanding: Money;
  /** Saldo de los cargos abiertos ya vencidos. */
  overdue: Money;
  /** Saldo a favor (pagos confirmados sin aplicar). */
  credit: Money;
  /** outstanding - credit (positivo = debe; negativo = a favor). */
  balance: Money;
  open_charges: number;
  overdue_charges: number;
  oldest_due_on: string | null;
  /** Día en que se suspendería sola si no paga (null si no aplica o ya está suspendida). */
  suspends_on: string | null;
  last_payment_on: string | null;
}

export interface BillingAccount {
  company_id: number;
  company_name: string;
  company_active: boolean;
  status: BillingStatus;
  /** La del plan (o, sin plan, la de sus movimientos); null sin plan ni movimientos. */
  currency: CurrencyCode | null;
  /** Ya tiene cargos o pagos: su moneda ya no se puede cambiar. */
  currency_locked: boolean;
  suspension: Suspension | null;
  /** null = empresa sin plan (no se le cobra). */
  plan: BillingPlan | null;
  balance: BillingBalance;
  /** Tras reactivar a mano: hasta ese día no se suspende sola. */
  grace_until: string | null;
}

export interface ChargeLine {
  /** Primer día del mes. */
  month: string;
  days: number;
  /** Días-persona (PER_USER: empleados y validadores activos, día por día) o días (FLAT). */
  units: number;
  /** De `units` (cobro por empleado activo), los días-persona de validadores; null = monto fijo o un cargo anterior al desglose. */
  validator_units?: number | null;
  amount: Money;
}

export interface ChargePreview {
  /** Número de cargo de la empresa (1 = el primero). */
  sequence: number;
  cut_on: string;
  period_start: string;
  period_end: string;
  billable_days: number;
  units: number;
  /** De `units` (cobro por empleado activo), los días-persona de validadores; null = monto fijo o un cargo anterior al desglose. */
  validator_units?: number | null;
  lines: ChargeLine[];
  subtotal: Money;
  discount: Money;
  tax: Money;
  total: Money;
}

/** Quiénes se cobran por empleado activo: empleados y validadores (decisión del dueño: uno cuenta como un empleado). */
export interface Headcount {
  employees: number;
  validators: number;
}

/** POST /admin/billing/preview */
export interface PlanPreview {
  /** Moneda de todos sus importes (la del plan). */
  currency: CurrencyCode;
  trial_ends_on: string | null;
  /** Primer cargo (null = todo el primer periodo es demo: no se emite). */
  first: ChargePreview | null;
  /** Un periodo completo siguiente: lo que costará cada periodo con esa plantilla. */
  recurring: ChargePreview;
  /** recurring.total / interval_months. */
  monthly_equivalent: Money;
}

/** Totales de un cargo (emitido, estimado o de la vista previa). */
export interface ChargeTotals {
  subtotal: Money;
  discount: Money;
  tax: Money;
  total: Money;
}

/** GET /admin/billing/companies/{id}/estimate */
export interface PeriodEstimate {
  currency: CurrencyCode;
  sequence: number;
  cut_on: string;
  period_start: string;
  period_end: string;
  /** Hoy. */
  as_of: string;
  days_total: number;
  /** Días del periodo hasta hoy (incluido). */
  days_elapsed: number;
  in_trial: boolean;
  trial_ends_on: string | null;
  /** Empleados activos hoy. */
  active_employees: number;
  /** Validadores activos hoy: se cobran como empleados (lo que falta del periodo se estima con los dos). */
  active_validators: number;
  /** Devengado hasta hoy. */
  accrued: { units: number; validator_units?: number | null; subtotal: Money };
  /** Todo el periodo (los días que faltan con la plantilla de hoy). */
  forecast: ChargeTotals & { units: number; validator_units?: number | null };
  /** `projected`: incluye días que aún no pasan. */
  lines: Array<ChargeLine & { projected: boolean }>;
}

export interface Charge extends ChargeTotals {
  id: number;
  sequence: number;
  /** La del plan al emitirse. */
  currency: CurrencyCode;
  cut_on: string;
  period_start: string;
  period_end: string;
  issued_on: string;
  due_on: string;
  billable_days: number;
  units: number;
  /** De `units` (cobro por empleado activo), los días-persona de validadores; null = monto fijo o un cargo anterior al desglose. */
  validator_units?: number | null;
  paid: Money;
  balance: Money;
  status: ChargeStatus;
  /** Abierto y vencido (due_on < hoy). */
  overdue: boolean;
  voided_at: string | null;
  void_reason: string | null;
}

/** Pago aplicado a un cargo. */
export interface ChargeAllocation {
  payment_id: number;
  paid_on: string;
  reference: string | null;
  amount: Money;
}

export interface ChargeDetail extends Charge {
  /** Copia del plan al emitirse. */
  pricing_mode: PricingMode;
  unit_price: Money;
  price_period: PricePeriod;
  tax_rate: Money;
  lines: ChargeLine[];
  allocations: ChargeAllocation[];
  voided_by: string | null;
}

export interface PaymentReceiptInfo {
  file_name: string;
  content_type: string;
  size: number;
}

export interface Payment {
  id: number;
  currency: CurrencyCode;
  amount: Money;
  paid_on: string;
  /** Código de `payment_methods`. */
  method: string;
  reference: string | null;
  note: string | null;
  status: PaymentStatus;
  applied: Money;
  unapplied: Money;
  receipt: PaymentReceiptInfo | null;
  recorded_by: string | null;
  created_at: string;
  voided_at: string | null;
  void_reason: string | null;
  voided_by: string | null;
}

/** Lo que se captura al registrar un pago (multipart). */
export interface PaymentInput {
  /** La de la empresa (si no, el backend responde 422 CURRENCY_MISMATCH). */
  currency: CurrencyCode;
  amount: Money;
  paid_on: string;
  method: string;
  reference: string;
  note: string;
  receipt: File | null;
}

export interface PaymentResult {
  payment: Payment;
  /** A qué cargos se aplicó (el más antiguo primero). */
  applied: Array<{ charge_id: number; sequence: number; cut_on: string; amount: Money }>;
  account: BillingAccount;
  /** La empresa estaba suspendida por falta de pago y el pago la reactivó. */
  reactivated: boolean;
}

export interface PaymentVoidResult {
  payment: Payment;
  account: BillingAccount;
}

export interface ChargeVoidResult {
  charge: ChargeDetail;
  account: BillingAccount;
}

export interface ReceiptFile extends PaymentReceiptInfo {
  /** Contenido en base64. */
  data: string;
}

export interface StatementEntry {
  date: string;
  kind: 'CHARGE' | 'PAYMENT';
  /** Id del cargo o del pago. */
  id: number;
  /** "Cargo 3 · oct 2026" / "Pago · Transferencia · REF123". */
  description: string;
  currency: CurrencyCode;
  debit: Money;
  credit: Money;
  /** Saldo acumulado tras el movimiento (positivo = debe). */
  balance: Money;
}

/** El dinero de la plataforma en UNA moneda (nunca se suman monedas distintas ni se convierten). */
export interface CurrencyTotals {
  currency: CurrencyCode;
  /** Empresas con plan en esta moneda. */
  companies: number;
  /** Cargos emitidos este mes. */
  billed_month: Money;
  /** Pagos confirmados con fecha en el mes. */
  collected_month: Money;
  outstanding: Money;
  overdue: Money;
  /** Empresas con saldo vencido en esta moneda. */
  overdue_companies: number;
  credit: Money;
  /** Suma de los pronósticos de sus planes (periodo en curso). */
  forecast: Money;
  /** Cargos de esta moneda en el último corte de la plataforma. */
  last_cut_charges: number;
  last_cut_total: Money;
}

export interface BillingOverview {
  as_of: string;
  month_start: string;
  /** Corte más reciente de la plataforma (null: aún no hay cargos). */
  last_cut_on: string | null;
  /** Una entrada por moneda en uso, en el orden del catálogo (vacía sin planes ni movimientos). */
  currencies: CurrencyTotals[];
  companies: { total: number; with_plan: number; without_plan: number; overdue: number; suspended: number; in_trial: number };
}

/** Resumen del plan en los listados. */
export interface PlanBrief {
  pricing_mode: PricingMode;
  unit_price: Money;
  price_period: PricePeriod;
  interval_months: number;
}

export interface CompanyBillingRow {
  company_id: number;
  name: string;
  rfc: string | null;
  active: boolean;
  status: BillingStatus;
  /** Moneda de sus importes (null: sin plan ni movimientos). */
  currency: CurrencyCode | null;
  suspension_reason: SuspensionReason | null;
  plan: PlanBrief | null;
  outstanding: Money;
  overdue: Money;
  credit: Money;
  open_charges: number;
  oldest_due_on: string | null;
  next_cut_on: string | null;
  forecast_total: Money | null;
  last_payment_on: string | null;
}

/** Filtros del listado de empresas de cobranza. */
export interface BillingCompaniesQuery {
  search?: string;
  status?: BillingStatus;
  overdue?: boolean;
  page: number;
  size: number;
}
