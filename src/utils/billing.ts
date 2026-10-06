import { parseIso } from '../components/ui/DateField';
import { t } from '../i18n/core';
import { ApiError } from '../services/apiClient';
import type {
  BillingDiscount,
  BillingPlan,
  BillingPlanInput,
  CurrencyCode,
  DiscountRecurrence,
  DiscountType,
  Headcount,
  PlanBrief,
  PricePeriod,
  PricingMode,
} from '../types';
import type { FieldLabels } from './changes';
import type { CatalogApi } from './catalogs';
import { businessToday, formatDate, localeDateFormat } from './format';
import { formatCount, formatList, formatMoney, formatRate } from './numbers';

/**
 * Reglas puras de la cobranza en la interfaz: el formulario del plan (valores, límites, validación y
 * lo que se envía), los textos legibles de un plan, de un descuento y de un cargo, y las reglas del
 * registro de pagos. Toda validación es solo UX: el backend vuelve a validar y calcula todo el dinero.
 * Los textos salen del espacio `billing` de los diccionarios y se piden al dibujar (cambio de idioma en
 * caliente); el dinero siempre con su moneda (`formatMoney(monto, moneda)`).
 */

type NameOf = CatalogApi['nameOf'];

/** Moneda por omisión de un plan nuevo (la misma del backend). */
export const DEFAULT_CURRENCY: CurrencyCode = 'MXN';

/** Plan como lo captura el formulario (números como texto, como `NumberField`). */
export interface PlanFormValues {
  pricing_mode: PricingMode;
  unit_price: string;
  price_period: PricePeriod;
  interval_months: string;
  starts_on: string;
  trial_days: string;
  /** Con descuento (interruptor). */
  discount: boolean;
  discount_type: DiscountType;
  discount_value: string;
  discount_recurrence: DiscountRecurrence;
  discount_periods: string;
  tax_rate: string;
  grace_days: string;
  /** Moneda de todo el cobro (catálogo `currencies`). */
  currency: CurrencyCode;
}

export type PlanField = keyof PlanFormValues;
export type PlanErrors = Partial<Record<PlanField, string>>;

/** Límites del backend (los mismos que valida al guardar). */
export const PLAN_LIMITS = {
  price: { min: 0, max: 1_000_000 },
  interval: { min: 1, max: 12 },
  trial: { min: 0, max: 365 },
  tax: { min: 0, max: 100 },
  grace: { min: 0, max: 90 },
  periods: { min: 1, max: 120 },
  percent: { min: 0.01, max: 100 },
  amount: { min: 0.01, max: 1_000_000 },
} as const;

/** Por omisión: por empleado activo, por mes, un cargo cada mes desde hoy, sin demo ni descuento, IVA 16 %, 10 días de gracia y en pesos. */
export function emptyPlanForm(today: string = businessToday()): PlanFormValues {
  return {
    pricing_mode: 'PER_USER',
    unit_price: '',
    price_period: 'MONTH',
    interval_months: '1',
    starts_on: today,
    trial_days: '0',
    discount: false,
    discount_type: 'PERCENT',
    discount_value: '',
    discount_recurrence: 'ALWAYS',
    discount_periods: '',
    tax_rate: '16',
    grace_days: '10',
    currency: DEFAULT_CURRENCY,
  };
}

/** Dinero del backend como lo muestra el campo ("120.00" → "120", "99.50" → "99.5"). */
const plainNumber = (money: string) => String(Number(money));

/** El plan guardado en el formulario (editar). */
export function planFormFrom(plan: BillingPlan): PlanFormValues {
  const { discount } = plan;
  return {
    pricing_mode: plan.pricing_mode,
    unit_price: plainNumber(plan.unit_price),
    price_period: plan.price_period,
    interval_months: String(plan.interval_months),
    starts_on: plan.starts_on,
    trial_days: String(plan.trial_days),
    discount: discount !== null,
    discount_type: discount?.type ?? 'PERCENT',
    discount_value: discount ? plainNumber(discount.value) : '',
    discount_recurrence: discount?.recurrence ?? 'ALWAYS',
    discount_periods: discount?.periods ? String(discount.periods) : '',
    tax_rate: plainNumber(plan.tax_rate),
    grace_days: String(plan.grace_days),
    currency: plan.currency,
  };
}

/** Error de un número obligatorio entre dos límites (o undefined si está bien). */
function rangeError(text: string, { min, max }: { min: number; max: number }, missing: string, outside: string): string | undefined {
  if (!text.trim()) return missing;
  const value = Number(text);
  return Number.isFinite(value) && value >= min && value <= max ? undefined : outside;
}

/** Errores del descuento (solo si está activado); el monto, en la moneda del plan. */
function discountErrors(values: PlanFormValues): PlanErrors {
  if (!values.discount) return {};
  const percent = values.discount_type === 'PERCENT';
  const errors: PlanErrors = {
    discount_value: rangeError(
      values.discount_value,
      percent ? PLAN_LIMITS.percent : PLAN_LIMITS.amount,
      t('billing.plan.errors.discountMissing'),
      percent ? t('billing.plan.errors.discountPercent') : t('billing.plan.errors.discountAmount', { max: formatMoney(PLAN_LIMITS.amount.max, values.currency) }),
    ),
  };
  if (values.discount_recurrence !== 'ALWAYS') {
    errors.discount_periods = rangeError(values.discount_periods, PLAN_LIMITS.periods, t('billing.plan.errors.periodsMissing'), t('billing.plan.errors.periodsRange'));
  }
  return errors;
}

/** Validación del plan (UX: el backend valida de nuevo). Sin errores, el objeto queda vacío. */
export function validatePlan(values: PlanFormValues): PlanErrors {
  const { price } = PLAN_LIMITS;
  const errors: PlanErrors = {
    unit_price: rangeError(
      values.unit_price,
      price,
      t('billing.plan.errors.priceMissing'),
      t('billing.plan.errors.priceRange', { min: formatMoney(price.min, values.currency), max: formatMoney(price.max, values.currency) }),
    ),
    interval_months: rangeError(values.interval_months, PLAN_LIMITS.interval, t('billing.plan.errors.intervalMissing'), t('billing.plan.errors.intervalRange')),
    starts_on: parseIso(values.starts_on) ? undefined : t('billing.plan.errors.startsOn'),
    trial_days: rangeError(values.trial_days, PLAN_LIMITS.trial, t('billing.plan.errors.trialMissing'), t('billing.plan.errors.trialRange')),
    tax_rate: rangeError(values.tax_rate, PLAN_LIMITS.tax, t('billing.plan.errors.taxMissing'), t('billing.plan.errors.taxRange')),
    grace_days: rangeError(values.grace_days, PLAN_LIMITS.grace, t('billing.plan.errors.graceMissing'), t('billing.plan.errors.graceRange')),
    ...discountErrors(values),
  };
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message));
}

/** Dinero como lo espera la API: texto con 2 decimales. */
const money = (text: string) => Number(text).toFixed(2);

/** Lo que se envía (alta, editar el plan y vista previa); los valores ya son válidos. */
export function planInput(values: PlanFormValues): BillingPlanInput {
  const discount: BillingDiscount | null = values.discount
    ? {
        type: values.discount_type,
        value: money(values.discount_value),
        recurrence: values.discount_recurrence,
        periods: values.discount_recurrence === 'ALWAYS' ? null : Number(values.discount_periods),
      }
    : null;
  return {
    pricing_mode: values.pricing_mode,
    unit_price: money(values.unit_price),
    price_period: values.price_period,
    interval_months: Number(values.interval_months),
    starts_on: values.starts_on,
    trial_days: Number(values.trial_days),
    discount,
    tax_rate: money(values.tax_rate),
    grace_days: Number(values.grace_days),
    currency: values.currency,
  };
}

/** ¿El plan del formulario es otro que el guardado? (comparado como se enviaría: "120" = "120.00"). */
export function planChanged(saved: BillingPlan | null, values: PlanFormValues): boolean {
  if (!saved) return true;
  return JSON.stringify(planInput(planFormFrom(saved))) !== JSON.stringify(planInput(values));
}

/** Campos del backend → campos del formulario (`billing.` en el alta, `plan.` en la vista previa). */
const SERVER_FIELDS: Partial<Record<string, PlanField>> = {
  discount: 'discount_value',
  'discount.type': 'discount_type',
  'discount.value': 'discount_value',
  'discount.recurrence': 'discount_recurrence',
  'discount.periods': 'discount_periods',
};
const FORM_FIELDS = new Set<string>(Object.keys(emptyPlanForm('2000-01-01')));
const isPlanField = (name: string): name is PlanField => FORM_FIELDS.has(name);

/** Errores del servidor llevados a los campos del plan (422 con `errors[].field`, p. ej. `CURRENCY_LOCKED`). */
export function planServerErrors(error: unknown): PlanErrors {
  if (!(error instanceof ApiError)) return {};
  const result: PlanErrors = {};
  for (const [field, message] of Object.entries(error.fieldErrors)) {
    const name = field.replace(/^(billing|plan)\./, '');
    const target = SERVER_FIELDS[name] ?? (isPlanField(name) ? name : undefined);
    if (target) result[target] ??= message;
  }
  return result;
}

/* ------------------------------------------------------------------------------------------
 * Textos legibles (en el idioma activo; el dinero, con su moneda)
 * ------------------------------------------------------------------------------------------ */

/** "MXN · Peso mexicano": la moneda con su nombre del catálogo (el código, igual en los dos idiomas). */
export const currencyText = (code: CurrencyCode, nameOf: NameOf) => {
  const name = nameOf('currencies', code);
  return name && name !== code ? `${code} · ${name}` : code;
};

/** "Cada mes" / "Cada 3 meses". */
export const cadenceText = (months: number) => t('billing.plan.cadence', { count: months });

/** "$120.00 MXN por mes": el precio en su moneda con su periodo (nombre del catálogo). */
export const priceText = (price: string, period: PricePeriod, currency: CurrencyCode, nameOf: NameOf) =>
  t('billing.plan.price', { amount: formatMoney(price, currency), period: nameOf('price_periods', period).toLowerCase() });

/** A qué cargos aplica un descuento: "en todos los cargos", "en los primeros 3 cargos", "cada 2 cargos". */
function recurrenceText(recurrence: DiscountRecurrence, periods: number | null): string {
  const count = periods ?? 1;
  if (recurrence === 'FIRST') return t('billing.plan.recurrence.first', { count });
  if (recurrence === 'EVERY') return t('billing.plan.recurrence.every', { count });
  return t('billing.plan.recurrence.always');
}

/** "10 % en los primeros 3 cargos" / "$500.00 MXN en todos los cargos"; sin descuento, "Sin descuento". */
export function discountText(discount: BillingDiscount | null, currency: CurrencyCode): string {
  if (!discount) return t('billing.plan.noDiscount');
  const value = discount.type === 'PERCENT' ? formatRate(discount.value, 2) : formatMoney(discount.value, currency);
  return t('billing.plan.discount', { value, recurrence: recurrenceText(discount.recurrence, discount.periods) });
}

/** "Por empleado activo · $120.00 MXN por mes · cada mes": el plan en una línea. */
export function planSummary(plan: PlanBrief, currency: CurrencyCode, nameOf: NameOf): string {
  return [nameOf('pricing_modes', plan.pricing_mode), priceText(plan.unit_price, plan.price_period, currency, nameOf), cadenceText(plan.interval_months).toLowerCase()].join(' · ');
}

/** "15 días" / "1 día". */
export const daysText = (days: number) => t('billing.units.days', { count: days });

/** El plan como se lee en una confirmación (alta: lo que se registra; edición: "antes → después"). */
export interface PlanView {
  mode: string;
  currency: string;
  price: string;
  cadence: string;
  starts_on: string;
  trial: string;
  discount: string;
  tax: string;
  grace: string;
}

/** Nombres de los datos del plan en una confirmación (se piden al armarla: siguen al idioma activo). */
export function planLabels(): FieldLabels<PlanView> {
  return {
    mode: t('billing.plan.labels.mode'),
    currency: t('billing.plan.labels.currency'),
    price: t('billing.plan.labels.price'),
    cadence: t('billing.plan.labels.cadence'),
    starts_on: t('billing.plan.labels.startsOn'),
    trial: t('billing.plan.labels.trial'),
    discount: t('billing.plan.labels.discount'),
    tax: t('billing.plan.labels.tax'),
    grace: t('billing.plan.labels.grace'),
  };
}

/** El plan del formulario en texto (sin plan: solo "Sin plan"; los demás datos quedan sin capturar). */
export function planView(values: PlanFormValues | null, nameOf: NameOf): PlanView {
  if (!values) return { mode: t('billing.plan.noPlan'), currency: '', price: '', cadence: '', starts_on: '', trial: '', discount: '', tax: '', grace: '' };
  const input = planInput(values);
  return {
    mode: nameOf('pricing_modes', input.pricing_mode),
    currency: currencyText(input.currency, nameOf),
    price: priceText(input.unit_price, input.price_period, input.currency, nameOf),
    cadence: cadenceText(input.interval_months),
    starts_on: formatDate(input.starts_on),
    trial: input.trial_days ? daysText(input.trial_days) : t('billing.plan.noTrial'),
    discount: discountText(input.discount, input.currency),
    tax: formatRate(input.tax_rate, 2),
    grace: daysText(input.grace_days),
  };
}

/** "1 oct 2026 – 31 oct 2026". */
export const periodText = (start: string, end: string) => `${formatDate(start)} – ${formatDate(end)}`;

/** "octubre de 2026" / "October 2026" (fecha de calendario: no cambia con la zona). */
export function monthLabel(month: string): string {
  const date = new Date(`${month.slice(0, 7)}-01T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? month : localeDateFormat({ month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

/**
 * Lo que se cobra: días-persona (por empleado activo: cada empleado y cada validador activos, día por día) o días
 * (monto fijo). Con validadores lleva el desglose que envía el backend (`validator_units`): «310 días-persona (280 de
 * empleados, 30 de validadores)»; sin validadores o sin el dato (un cargo emitido antes de guardarlo), solo el total.
 */
export function unitsText(units: number, mode: PricingMode, validators?: number | null): string {
  if (mode !== 'PER_USER') return daysText(units);
  if (!validators) return t('billing.units.personDays', { count: units });
  return t('billing.units.personDaysSplit', { count: units, employees: formatCount(units - validators), validators: formatCount(validators) });
}

/** Con cuántos empleados y validadores activos se calcula la vista previa del cobro por empleado y de dónde salen. */
export interface PreviewHeadcount extends Headcount {
  /** current: los que ya tiene la empresa; limit: sus límites; unit: sin límite de empleados, el costo de uno. */
  basis: 'current' | 'limit' | 'unit';
}

/** Un límite escrito en el formulario como número entero (o null si está vacío o no es un entero de `min` o más). */
function limitOf(text: string, min: number): number | null {
  const value = Number(text.trim());
  return text.trim() && Number.isInteger(value) && value >= min ? value : null;
}

/**
 * Los empleados y validadores de la vista previa salen de lo que ya se sabe de la empresa, nunca de un campo aparte
 * (decisión del dueño del producto: pedirlos otra vez duplicaba los límites): los que ya tiene activos; si no tiene a
 * nadie, sus límites (empleados y validadores) escritos en el formulario; sin límite de empleados, el costo de uno
 * (más los validadores de su límite). Cada validador activo cuenta como un empleado: el backend suma los dos.
 */
export function previewHeadcount(current: Headcount, limits: { employees: string; validators: string }): PreviewHeadcount {
  if (current.employees + current.validators > 0) return { ...current, basis: 'current' };
  const validators = limitOf(limits.validators, 0) ?? 0;
  const employees = limitOf(limits.employees, 1);
  return employees === null ? { employees: 1, validators, basis: 'unit' } : { employees, validators, basis: 'limit' };
}

/** "10 empleados y 2 validadores" (sin validadores: "10 empleados"): quiénes se cobran por empleado activo. */
export function headcountBreakdown({ employees, validators }: Headcount): string {
  const people = [t('billing.headcount.employees', { count: employees })];
  if (validators > 0) people.push(t('billing.headcount.validators', { count: validators }));
  return formatList(people);
}

/** La frase que dice en la vista previa con cuántos empleados y validadores se calculó y por qué. */
export function headcountText(headcount: PreviewHeadcount): string {
  const people = headcountBreakdown(headcount);
  if (headcount.basis === 'unit') return t('billing.preview.basisUnit', { people });
  return t(headcount.basis === 'limit' ? 'billing.preview.basisLimit' : 'billing.preview.basisCurrent', { people });
}

/* ------------------------------------------------------------------------------------------
 * Pagos y motivos
 * ------------------------------------------------------------------------------------------ */

/** Comprobante: PDF o imagen de hasta 5 MB (lo mismo que acepta el backend). */
export const RECEIPT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

export function validateReceipt(file: File | null): string | undefined {
  if (!file) return undefined;
  if (!(RECEIPT_TYPES as readonly string[]).includes(file.type)) return t('billing.payment.errors.receiptType');
  return file.size > RECEIPT_MAX_BYTES ? t('billing.payment.errors.receiptSize') : undefined;
}

export const PAYMENT_LIMITS = { amount: { min: 0.01, max: 100_000_000 }, reference: 120, note: 300 } as const;

/** Motivo de anular o suspender: lo verá el historial (5 a 300 caracteres, como el backend). */
export function validateBillingReason(reason: string): string | undefined {
  const length = reason.trim().length;
  if (length < 5) return t('billing.reason.errors.short');
  return length > 300 ? t('billing.reason.errors.long') : undefined;
}
