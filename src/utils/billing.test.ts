import { describe, expect, it } from 'vitest';
import { setLocale } from '../i18n/core';
import { ApiError } from '../services/apiClient';
import { plan } from '../test/billing';
import { testCatalogs } from '../test/catalogs';
import {
  cadenceText,
  currencyText,
  discountText,
  emptyPlanForm,
  headcountText,
  monthLabel,
  periodText,
  planChanged,
  planFormFrom,
  planInput,
  planLabels,
  planServerErrors,
  planSummary,
  planView,
  headcountBreakdown,
  previewHeadcount,
  priceText,
  RECEIPT_MAX_BYTES,
  unitsText,
  validateBillingReason,
  validatePlan,
  validateReceipt,
  type PlanFormValues,
} from './billing';

const { nameOf } = testCatalogs;
const valid: PlanFormValues = { ...emptyPlanForm('2026-10-04'), unit_price: '120' };
const fieldError = (field: string, message: string) => new ApiError({ statusCode: 422, code: 'VALIDATION_ERROR', message: 'Datos inválidos', errors: [{ code: 'X', message, field, details: null }] });

describe('formulario del plan de cobro', () => {
  it('por omisión: por empleado activo, por mes, cada mes desde hoy, sin demo ni descuento, IVA 16 %, 10 días de gracia y en pesos', () => {
    expect(emptyPlanForm('2026-10-04')).toEqual({
      pricing_mode: 'PER_USER',
      unit_price: '',
      price_period: 'MONTH',
      interval_months: '1',
      starts_on: '2026-10-04',
      trial_days: '0',
      discount: false,
      discount_type: 'PERCENT',
      discount_value: '',
      discount_recurrence: 'ALWAYS',
      discount_periods: '',
      tax_rate: '16',
      grace_days: '10',
      currency: 'MXN',
    });
    expect(emptyPlanForm().starts_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('el plan guardado llena el formulario (dinero sin ceros de más)', () => {
    expect(planFormFrom(plan)).toMatchObject({ unit_price: '120', tax_rate: '16', discount: false, discount_value: '', discount_periods: '', starts_on: '2026-09-01', currency: 'MXN' });
    expect(planFormFrom({ ...plan, currency: 'EUR' }).currency).toBe('EUR');
    const discounted = planFormFrom({ ...plan, discount: { type: 'AMOUNT', value: '99.50', recurrence: 'FIRST', periods: 3 } });
    expect(discounted).toMatchObject({ discount: true, discount_type: 'AMOUNT', discount_value: '99.5', discount_recurrence: 'FIRST', discount_periods: '3' });
    expect(planFormFrom({ ...plan, discount: { type: 'PERCENT', value: '10.00', recurrence: 'ALWAYS', periods: null } }).discount_periods).toBe('');
  });

  it('valida cada campo con los límites del backend (solo UX)', () => {
    expect(validatePlan(valid)).toEqual({});
    expect(validatePlan({ ...valid, unit_price: '' })).toEqual({ unit_price: 'Escribe el precio' });
    expect(validatePlan({ ...valid, unit_price: '1000001', interval_months: '13', starts_on: '2026-02-31', trial_days: '366', tax_rate: '101', grace_days: '91' })).toEqual({
      unit_price: 'El precio va de $0.00\u00a0MXN a $1,000,000.00\u00a0MXN',
      interval_months: 'Entre 1 y 12 meses',
      starts_on: 'Elige una fecha de inicio válida',
      trial_days: 'Entre 0 y 365 días',
      tax_rate: 'Entre 0 % y 100 %',
      grace_days: 'Entre 0 y 90 días',
    });
    expect(validatePlan({ ...valid, interval_months: '', trial_days: '', tax_rate: '', grace_days: '' })).toEqual({
      interval_months: 'Escribe cada cuántos meses',
      trial_days: 'Escribe los días de demo (0 sin demo)',
      tax_rate: 'Escribe el IVA (0 si no aplica)',
      grace_days: 'Escribe los días de gracia',
    });
    expect(validatePlan({ ...valid, unit_price: '.' })).toEqual({ unit_price: 'El precio va de $0.00\u00a0MXN a $1,000,000.00\u00a0MXN' });
    // Los límites se dicen en la moneda del plan.
    expect(validatePlan({ ...valid, currency: 'EUR', unit_price: '' }).unit_price).toBe('Escribe el precio');
    expect(validatePlan({ ...valid, currency: 'EUR', unit_price: '-1' }).unit_price).toBe('El precio va de €0.00\u00a0EUR a €1,000,000.00\u00a0EUR');
  });

  it('el descuento se valida solo si está activado (porcentaje, monto y cuántos cargos)', () => {
    expect(validatePlan({ ...valid, discount_value: '500' })).toEqual({}); // apagado: no cuenta
    const on = { ...valid, discount: true };
    expect(validatePlan(on)).toEqual({ discount_value: 'Escribe el descuento' });
    expect(validatePlan({ ...on, discount_value: '0' })).toEqual({ discount_value: 'El porcentaje va de 0.01 % a 100 %' });
    expect(validatePlan({ ...on, discount_type: 'AMOUNT', discount_value: '0' })).toEqual({ discount_value: 'El monto debe ser mayor que 0 y hasta $1,000,000.00\u00a0MXN' });
    expect(validatePlan({ ...on, discount_value: '10', discount_recurrence: 'FIRST' })).toEqual({ discount_periods: 'Escribe cuántos cargos' });
    expect(validatePlan({ ...on, discount_value: '10', discount_recurrence: 'EVERY', discount_periods: '121' })).toEqual({ discount_periods: 'Entre 1 y 120 cargos' });
    expect(validatePlan({ ...on, discount_value: '10', discount_recurrence: 'EVERY', discount_periods: '2' })).toEqual({});
  });

  it('lo que se envía: dinero con dos decimales, números y el descuento (periodos solo con FIRST o EVERY)', () => {
    expect(planInput(valid)).toEqual({
      pricing_mode: 'PER_USER',
      unit_price: '120.00',
      price_period: 'MONTH',
      interval_months: 1,
      starts_on: '2026-10-04',
      trial_days: 0,
      discount: null,
      tax_rate: '16.00',
      grace_days: 10,
      currency: 'MXN',
    });
    expect(planInput({ ...valid, currency: 'USD' }).currency).toBe('USD');
    expect(planInput({ ...valid, discount: true, discount_value: '12.5', discount_periods: '4' }).discount).toEqual({ type: 'PERCENT', value: '12.50', recurrence: 'ALWAYS', periods: null });
    expect(planInput({ ...valid, discount: true, discount_type: 'AMOUNT', discount_value: '300', discount_recurrence: 'FIRST', discount_periods: '4' }).discount).toEqual({
      type: 'AMOUNT',
      value: '300.00',
      recurrence: 'FIRST',
      periods: 4,
    });
  });

  it('¿cambió el plan? se compara como se enviaría ("120" = "120.00"); sin plan guardado, siempre', () => {
    expect(planChanged(null, valid)).toBe(true);
    expect(planChanged(plan, { ...planFormFrom(plan), unit_price: '120.00' })).toBe(false);
    expect(planChanged(plan, { ...planFormFrom(plan), grace_days: '15' })).toBe(true);
    expect(planChanged(plan, { ...planFormFrom(plan), currency: 'USD' })).toBe(true);
  });

  it('los errores del servidor van a su campo (alta: billing.*, vista previa: plan.*, editar: sin prefijo)', () => {
    expect(planServerErrors(new Error('x'))).toEqual({});
    expect(planServerErrors(fieldError('billing.unit_price', 'Precio inválido'))).toEqual({ unit_price: 'Precio inválido' });
    expect(planServerErrors(fieldError('plan.discount.periods', 'Faltan cargos'))).toEqual({ discount_periods: 'Faltan cargos' });
    expect(planServerErrors(fieldError('discount', 'Descuento inválido'))).toEqual({ discount_value: 'Descuento inválido' });
    expect(planServerErrors(fieldError('grace_days', 'Máximo 90'))).toEqual({ grace_days: 'Máximo 90' });
    expect(planServerErrors(fieldError('employees', 'Otro campo'))).toEqual({});
    const twice = new ApiError({
      statusCode: 422,
      code: 'VALIDATION_ERROR',
      message: 'Datos inválidos',
      errors: [
        { code: 'X', message: 'Tipo inválido', field: 'discount.type', details: null },
        { code: 'X', message: 'Primero', field: 'discount.value', details: null },
        { code: 'X', message: 'Segundo', field: 'discount', details: null },
        { code: 'X', message: 'Sin campo', field: null, details: null },
      ],
    });
    expect(planServerErrors(twice)).toEqual({ discount_type: 'Tipo inválido', discount_value: 'Primero' });
    expect(planServerErrors(fieldError('discount.recurrence', 'Recurrencia'))).toEqual({ discount_recurrence: 'Recurrencia' });
    // La moneda fija o desconocida (CURRENCY_LOCKED, CURRENCY_INVALID) se marca en su campo.
    expect(planServerErrors(fieldError('billing.currency', 'La moneda ya no se puede cambiar'))).toEqual({ currency: 'La moneda ya no se puede cambiar' });
  });
});

describe('textos del plan, del descuento y de un cargo', () => {
  it('cadencia, precio y resumen en una línea (nombres del catálogo)', () => {
    expect(cadenceText(1)).toBe('Cada mes');
    expect(cadenceText(3)).toBe('Cada 3 meses');
    expect(priceText('120.00', 'YEAR', 'MXN', nameOf)).toBe('$120.00\u00a0MXN por año');
    expect(priceText('120.00', 'YEAR', 'USD', nameOf)).toBe('$120.00\u00a0USD por año');
    expect(planSummary({ pricing_mode: 'FLAT', unit_price: '5000.00', price_period: 'MONTH', interval_months: 2 }, 'EUR', nameOf)).toBe('Monto fijo · €5,000.00\u00a0EUR por mes · cada 2 meses');
    expect(currencyText('USD', nameOf)).toBe('USD · Dólar estadounidense');
    expect(currencyText('JPY', nameOf)).toBe('JPY'); // sin catálogo: el código
  });

  it('descuento: valor y a qué cargos aplica', () => {
    expect(discountText(null, 'MXN')).toBe('Sin descuento');
    expect(discountText({ type: 'PERCENT', value: '12.50', recurrence: 'ALWAYS', periods: null }, 'MXN')).toBe('12.5 % en todos los cargos');
    expect(discountText({ type: 'AMOUNT', value: '500.00', recurrence: 'FIRST', periods: 1 }, 'MXN')).toBe('$500.00\u00a0MXN en el primer cargo');
    expect(discountText({ type: 'AMOUNT', value: '500.00', recurrence: 'FIRST', periods: 3 }, 'USD')).toBe('$500.00\u00a0USD en los primeros 3 cargos');
    expect(discountText({ type: 'PERCENT', value: '10.00', recurrence: 'EVERY', periods: 1 }, 'MXN')).toBe('10 % en cada cargo');
    expect(discountText({ type: 'PERCENT', value: '10.00', recurrence: 'EVERY', periods: 4 }, 'MXN')).toBe('10 % cada 4 cargos');
    expect(discountText({ type: 'PERCENT', value: '10.00', recurrence: 'EVERY', periods: null }, 'MXN')).toBe('10 % en cada cargo');
  });

  it('el plan como se lee en una confirmación; sin plan, "Sin plan"', () => {
    expect(planView(null, nameOf)).toEqual({ mode: 'Sin plan', currency: '', price: '', cadence: '', starts_on: '', trial: '', discount: '', tax: '', grace: '' });
    expect(planView({ ...valid, trial_days: '15', grace_days: '1' }, nameOf)).toEqual({
      mode: 'Por empleado activo',
      currency: 'MXN · Peso mexicano',
      price: '$120.00\u00a0MXN por mes',
      cadence: 'Cada mes',
      starts_on: '4 oct 2026',
      trial: '15 días',
      discount: 'Sin descuento',
      tax: '16 %',
      grace: '1 día',
    });
  });

  it('periodo, mes y lo que se cobra', () => {
    expect(periodText('2026-10-01', '2026-10-31')).toBe('1 oct 2026 – 31 oct 2026');
    expect(monthLabel('2026-10-01')).toBe('octubre de 2026');
    expect(monthLabel('xx')).toBe('xx');
    expect(unitsText(300, 'PER_USER')).toBe('300 días-persona');
    expect(unitsText(1, 'PER_USER')).toBe('1 día-persona');
    // Con validadores, el desglose (un cargo anterior sin el dato, o sin validadores, solo el total).
    expect(unitsText(310, 'PER_USER', 30)).toBe('310 días-persona (280 de empleados, 30 de validadores)');
    expect(unitsText(1, 'PER_USER', 1)).toBe('1 día-persona (0 de empleados, 1 de validadores)');
    expect(unitsText(2480, 'PER_USER', 1240)).toBe('2,480 días-persona (1,240 de empleados, 1,240 de validadores)');
    expect(unitsText(310, 'PER_USER', 0)).toBe('310 días-persona');
    expect(unitsText(310, 'PER_USER', null)).toBe('310 días-persona');
    expect(unitsText(30, 'FLAT')).toBe('30 días');
    expect(unitsText(30, 'FLAT', 4)).toBe('30 días'); // el monto fijo no lleva desglose
  });

  it('en inglés: textos, meses y monedas en el idioma activo (los códigos no cambian)', async () => {
    await setLocale('en-US');
    expect(cadenceText(3)).toBe('Every 3 months');
    expect(discountText({ type: 'AMOUNT', value: '500.00', recurrence: 'FIRST', periods: 3 }, 'EUR')).toBe('€500.00\u00a0EUR on the first 3 charges');
    expect(monthLabel('2026-10-01')).toBe('October 2026');
    expect(unitsText(1, 'PER_USER')).toBe('1 person-day');
    expect(unitsText(310, 'PER_USER', 30)).toBe('310 person-days (280 employee, 30 validator)');
    expect(unitsText(1, 'PER_USER', 1)).toBe('1 person-day (0 employee, 1 validator)');
    expect(planLabels()).toMatchObject({ currency: 'Currency', tax: 'VAT' });
    expect(validateBillingReason('abc')).toBe('Enter the reason (at least 5 characters)');
  });
});

describe('pagos y motivos', () => {
  it('comprobante: PDF o imagen de hasta 5 MB (sin archivo no hay error)', () => {
    expect(validateReceipt(null)).toBeUndefined();
    expect(validateReceipt(new File(['x'], 'pago.pdf', { type: 'application/pdf' }))).toBeUndefined();
    expect(validateReceipt(new File(['x'], 'pago.gif', { type: 'image/gif' }))).toBe('El comprobante debe ser PDF, JPG, PNG o WEBP');
    const big = new File([new Uint8Array(RECEIPT_MAX_BYTES + 1)], 'grande.png', { type: 'image/png' });
    expect(validateReceipt(big)).toBe('El comprobante pesa más de 5 MB');
  });

  it('motivo de anular o suspender: de 5 a 300 caracteres', () => {
    expect(validateBillingReason(' abc ')).toBe('Escribe el motivo (al menos 5 caracteres)');
    expect(validateBillingReason('x'.repeat(301))).toBe('El motivo admite hasta 300 caracteres');
    expect(validateBillingReason('Pago duplicado')).toBeUndefined();
  });

  it('quiénes se cobran en la vista previa: los activos de la empresa; si no tiene a nadie, sus límites; si no, uno', async () => {
    const none = { employees: 0, validators: 0 };
    expect(previewHeadcount({ employees: 3, validators: 1 }, { employees: '80', validators: '5' })).toEqual({ employees: 3, validators: 1, basis: 'current' });
    expect(previewHeadcount({ employees: 0, validators: 2 }, { employees: '80', validators: '5' })).toEqual({ employees: 0, validators: 2, basis: 'current' });
    expect(previewHeadcount(none, { employees: ' 80 ', validators: ' 2 ' })).toEqual({ employees: 80, validators: 2, basis: 'limit' });
    expect(previewHeadcount(none, { employees: '', validators: '3' })).toEqual({ employees: 1, validators: 3, basis: 'unit' });
    // Un límite inválido no cuenta (el de empleados desde 1, el de validadores desde 0).
    expect(previewHeadcount(none, { employees: '0', validators: '' })).toEqual({ employees: 1, validators: 0, basis: 'unit' });
    expect(previewHeadcount(none, { employees: '2.5', validators: '-1' })).toEqual({ employees: 1, validators: 0, basis: 'unit' });
    expect(headcountText({ employees: 1, validators: 0, basis: 'current' })).toBe('Calculado con los activos actuales: 1 empleado');
    expect(headcountText({ employees: 80, validators: 2, basis: 'limit' })).toBe('Calculado con los límites de la empresa: 80 empleados y 2 validadores');
    expect(headcountText({ employees: 1, validators: 1, basis: 'unit' })).toBe(
      'Calculado para 1 empleado y 1 validador: escribe el límite de empleados para ver el total',
    );
    await setLocale('en-US');
    expect(headcountText({ employees: 3, validators: 0, basis: 'current' })).toBe('Calculated with current active staff: 3 employees');
    expect(headcountText({ employees: 1, validators: 3, basis: 'limit' })).toBe("Calculated with the company's limits: 1 employee and 3 validators");
    expect(headcountText({ employees: 1, validators: 0, basis: 'unit' })).toBe("Calculated for 1 employee: enter the employee limit to see the total");
    expect(headcountBreakdown({ employees: 2, validators: 1 })).toBe('2 employees and 1 validator');
  });
});
