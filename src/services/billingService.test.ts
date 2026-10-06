import { describe, expect, it } from 'vitest';
import { account, charge, chargeDetail, companyRow, estimate, overview, payment, paymentResult, preview, statementEntries } from '../test/billing';
import { apiOk, mockFetch } from '../test/http';
import type { BillingPlanInput } from '../types';
import { billingService } from './billingService';
import { usageService } from './usageService';

const input: BillingPlanInput = {
  pricing_mode: 'PER_USER',
  unit_price: '120.00',
  price_period: 'MONTH',
  interval_months: 1,
  starts_on: '2026-10-04',
  trial_days: 0,
  discount: null,
  tax_rate: '16.00',
  grace_days: 10,
  currency: 'USD',
};
const pageOf = (items: unknown[]) => ({ items, total: items.length, page: 1, size: 10 });

describe('billingService (solo el ADMIN)', () => {
  it.each([
    ['preview', () => billingService.preview(input, { employees: 12, validators: 2 }), preview, 'POST', '/api/admin/billing/preview', { plan: input, employees: 12, validators: 2 }],
    ['overview', () => billingService.overview(), overview, 'GET', '/api/admin/billing/overview', undefined],
    ['companies', () => billingService.companies({ search: 'pan', status: 'SUSPENDED', overdue: true, page: 2, size: 10 }), pageOf([companyRow]), 'GET', '/api/admin/billing/companies?search=pan&status=SUSPENDED&overdue=true&page=2&size=10', undefined],
    ['account', () => billingService.account(4), account, 'GET', '/api/admin/billing/companies/4', undefined],
    ['savePlan', () => billingService.savePlan(4, input), account, 'PUT', '/api/admin/billing/companies/4/plan', input],
    ['estimate', () => billingService.estimate(4), estimate, 'GET', '/api/admin/billing/companies/4/estimate', undefined],
    ['charges', () => billingService.charges(4, { page: 1, size: 10, status: 'OPEN' }), pageOf([charge]), 'GET', '/api/admin/billing/companies/4/charges?page=1&size=10&status=OPEN', undefined],
    ['charge', () => billingService.charge(4, 31), chargeDetail, 'GET', '/api/admin/billing/companies/4/charges/31', undefined],
    ['voidCharge', () => billingService.voidCharge(4, 31, 'Cargo duplicado'), { charge: chargeDetail, account }, 'POST', '/api/admin/billing/companies/4/charges/31/void', { reason: 'Cargo duplicado' }],
    ['payments', () => billingService.payments(4, { page: 1, size: 10 }), pageOf([payment]), 'GET', '/api/admin/billing/companies/4/payments?page=1&size=10', undefined],
    ['receipt', () => billingService.receipt(4, 51), { file_name: 'spei.pdf', content_type: 'application/pdf', size: 4, data: 'aG9sYQ==' }, 'GET', '/api/admin/billing/companies/4/payments/51/receipt', undefined],
    ['voidPayment', () => billingService.voidPayment(4, 51, 'Pago duplicado'), { payment, account }, 'POST', '/api/admin/billing/companies/4/payments/51/void', { reason: 'Pago duplicado' }],
    ['suspend', () => billingService.suspend(4, 'Falta de pago'), account, 'POST', '/api/admin/billing/companies/4/suspend', { reason: 'Falta de pago' }],
    ['reactivate', () => billingService.reactivate(4, null), account, 'POST', '/api/admin/billing/companies/4/reactivate', { note: null }],
    ['statement', () => billingService.statement(4, { page: 1, size: 20 }), pageOf(statementEntries), 'GET', '/api/admin/billing/companies/4/statement?page=1&size=20', undefined],
  ])('%s: ruta, método y cuerpo', async (_name, call, data, method, url, body) => {
    const { calls } = mockFetch(apiOk(data));
    await expect(call()).resolves.toEqual(data);
    expect(calls[0].init.method ?? 'GET').toBe(method);
    expect(calls[0].url).toBe(url);
    expect(body === undefined ? undefined : JSON.parse(calls[0].init.body as string)).toEqual(body);
  });

  it('registrar un pago envía multipart: los datos con su moneda, lo opcional solo si se escribió y el comprobante', async () => {
    const { calls } = mockFetch(apiOk(paymentResult, { status: 201 }));
    const receipt = new File(['%PDF'], 'spei.pdf', { type: 'application/pdf' });
    await expect(billingService.registerPayment(4, { amount: '1500.00', currency: 'MXN', paid_on: '2026-10-01', method: 'TRANSFER', reference: ' SPEI-1 ', note: ' Pago de octubre ', receipt })).resolves.toEqual(paymentResult);
    expect(calls[0].url).toBe('/api/admin/billing/companies/4/payments');
    const form = calls[0].init.body as FormData;
    expect([...form.keys()]).toEqual(['amount', 'currency', 'paid_on', 'method', 'reference', 'note', 'receipt']);
    expect(form.get('currency')).toBe('MXN');
    expect(form.get('reference')).toBe('SPEI-1');
    expect(form.get('note')).toBe('Pago de octubre');
    expect((form.get('receipt') as File).name).toBe('spei.pdf');
    expect(calls[0].init.headers).not.toHaveProperty('Content-Type'); // el navegador pone el boundary

    await billingService.registerPayment(4, { amount: '10.00', currency: 'USD', paid_on: '2026-10-01', method: 'CASH', reference: ' ', note: '', receipt: null });
    expect([...(calls[1].init.body as FormData).keys()]).toEqual(['amount', 'currency', 'paid_on', 'method']);
  });

  it('rechaza respuestas con otra forma', async () => {
    mockFetch(apiOk({ unexpected: true }));
    await expect(billingService.account(4)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(billingService.preview(input, { employees: 1, validators: 0 })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(billingService.registerPayment(4, { amount: '1', currency: 'MXN', paid_on: '2026-10-01', method: 'CASH', reference: '', note: '', receipt: null })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});

describe('usageService (solo el ADMIN)', () => {
  it.each([
    ['overview', () => usageService.overview({ start: '2026-10-01', end: '2026-10-04' }), { start: 'a', end: 'b', totals: {}, days: [], storage: {} }, '/api/admin/usage/overview?start=2026-10-01&end=2026-10-04'],
    ['overview sin rango', () => usageService.overview({}), { start: 'a', end: 'b', totals: {}, days: [], storage: {} }, '/api/admin/usage/overview'],
    [
      'companies',
      () => usageService.companies({ start: '2026-10-01', end: '2026-10-04', search: 'pan', sort: 'bytes', page: 1, size: 10 }),
      pageOf([{ company_id: 4, name: 'P', requests: 1, bytes_in: 1, bytes_out: 1, share: 1 }]),
      '/api/admin/usage/companies?start=2026-10-01&end=2026-10-04&search=pan&sort=bytes&page=1&size=10',
    ],
    ['company', () => usageService.company(4, { start: '2026-10-01' }), { company_id: 4, totals: {}, days: [], top_routes: [], storage: {} }, '/api/admin/usage/companies/4?start=2026-10-01'],
    ['users', () => usageService.users(4, { page: 2, size: 10 }), pageOf([{ user_id: 8, requests: 1, share: 1 }]), '/api/admin/usage/companies/4/users?page=2&size=10'],
    ['routes', () => usageService.routes(4, { end: '2026-10-04', page: 1, size: 10 }), pageOf([{ route: 'GET /x', requests: 1, max_ms: 1 }]), '/api/admin/usage/companies/4/routes?end=2026-10-04&page=1&size=10'],
  ])('%s: consulta con el rango', async (_name, call, data, url) => {
    const { calls } = mockFetch(apiOk(data));
    await expect(call()).resolves.toEqual(data);
    expect(calls[0].url).toBe(url);
  });

  it('rechaza respuestas con otra forma', async () => {
    mockFetch(apiOk({ items: [{ nada: 1 }], total: 1 }));
    await expect(usageService.users(4, { page: 1, size: 10 })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(usageService.company(4, {})).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
