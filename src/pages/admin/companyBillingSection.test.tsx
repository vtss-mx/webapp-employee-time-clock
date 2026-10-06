import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { account, estimate, noPlanAccount, suspendedAccount } from '../../test/billing';
import { adminUser, company, renderPage } from '../../test/companyPages';
import { documentsReply } from '../../test/documents';
import { apiFail, apiOk, mockFetch } from '../../test/http';
import type { BillingAccount, PeriodEstimate, User } from '../../types';
import { CompanyDetailPage } from './CompanyDetailPage';

interface Options {
  current?: BillingAccount;
  accountReply?: () => Response;
  estimateReply?: () => Response;
  user?: User | null;
}

function renderDetail({ current = account, accountReply = () => apiOk(current), estimateReply = () => apiOk(estimate), user }: Options = {}) {
  const mock = mockFetch((call) => {
    if (call.url.endsWith('/estimate')) return estimateReply();
    if (call.url.endsWith('/billing/companies/4')) return accountReply();
    if (call.url.includes('/admins')) return apiOk({ items: [], total: 0, page: 1, size: 10 });
    return documentsReply(call) ?? apiOk(company);
  });
  renderPage('/admin/companies/:id', '/admin/companies/4', <CompanyDetailPage />, { user });
  return mock.calls;
}
const section = () => screen.getByRole('heading', { name: 'Cobranza' }).closest('section') as HTMLElement;
const fact = (label: string) => within(section()).getByText(label).nextElementSibling;

describe('CompanyDetailPage: cobranza de la empresa', () => {
  it('estado, plan, saldo y el periodo en curso ("Actualizar" lo vuelve a calcular); sin la pantalla de cobranza no hay enlace', async () => {
    const calls = renderDetail();
    await screen.findByRole('heading', { name: 'Cobranza' });
    expect(await within(section()).findByText('Activa')).toBeInTheDocument();
    expect(fact('Modalidad')).toHaveTextContent('Por empleado activo');
    expect(fact('Precio (sin IVA)')).toHaveTextContent('$120.00 MXN por mes');
    expect(fact('Moneda')).toHaveTextContent('MXN · Peso mexicano Fija');
    expect(fact('Demo sin cobro')).toHaveTextContent('Sin demo');
    expect(fact('Descuento')).toHaveTextContent('Sin descuento');
    expect(fact('Próximo corte')).toHaveTextContent('31 oct 2026');
    expect(fact('Pronóstico del periodo')).toHaveTextContent('$1,392.00 MXN con IVA');
    expect(section()).toHaveTextContent('1 cargo abierto');
    expect(section()).toHaveTextContent('Nada vencido');
    expect(section()).toHaveTextContent('Último pago: 5 sep 2026');
    expect(screen.queryByRole('link', { name: /Abrir cobranza/ })).toBeNull();

    expect(await within(section()).findByText('Cargo 2 · 1 oct 2026 – 31 oct 2026')).toBeInTheDocument();
    expect(within(section()).getByRole('meter', { name: 'Avance del periodo: día 4 de 31' })).toHaveAttribute('aria-valuenow', '4');
    expect(fact('Activos hoy')).toHaveTextContent('10 empleados');
    expect(fact('Devengado hasta hoy (sin IVA)')).toHaveTextContent('$154.84 MXN · 40 días-persona');
    expect(within(section()).getByLabelText('Pronóstico del cargo').textContent).toBe('Subtotal$1,200.00\u00a0MXNIVA$192.00\u00a0MXNTotal$1,392.00\u00a0MXN');
    expect(fact('Se cobrarán en el periodo')).toHaveTextContent('310 días-persona');
    expect(within(section()).getByText('octubre de 2026').closest('td')).toHaveTextContent('incluye días por venir');

    await userEvent.click(within(section()).getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(calls.filter((c) => c.url.endsWith('/estimate'))).toHaveLength(2));
  });

  it('con la pantalla de cobranza, "Abrir cobranza" lleva a la cuenta de la empresa', async () => {
    renderDetail({ user: adminUser });
    expect(await screen.findByRole('link', { name: /Abrir cobranza/ })).toHaveAttribute('href', '/admin/billing/companies/4');
  });

  it('suspendida por falta de pago: motivo, desde cuándo, quién (automática) y cuándo se suspendería sola', async () => {
    const current: BillingAccount = { ...suspendedAccount, company_active: false, balance: { ...suspendedAccount.balance, suspends_on: '2026-10-20', last_payment_on: null } };
    renderDetail({ current, estimateReply: () => apiOk({ ...estimate, in_trial: true, trial_ends_on: '2026-10-10' } satisfies PeriodEstimate) });
    expect(await screen.findByText('Suspendida')).toBeInTheDocument();
    expect(screen.getByText('Empresa desactivada')).toBeInTheDocument();
    expect(fact('Motivo')).toHaveTextContent('Falta de pago');
    expect(fact('Suspendida por')).toHaveTextContent('La plataforma, automáticamente');
    expect(fact('Detalle')).toHaveTextContent('El cargo 1 siguió sin pagarse');
    expect(section()).toHaveTextContent('1 cargo · vence desde el 20 sep 2026');
    expect(section()).toHaveTextContent('Aún sin pagos');
    expect(section()).toHaveTextContent('Si no paga, se suspenderá sola el 20 oct 2026.');
    expect(await within(section()).findByText('En demo hasta el 10 oct 2026')).toBeInTheDocument();
  });

  it('suspendida a mano (sin detalle), con demo y descuento en el plan; reactivada a mano muestra hasta cuándo no se suspende sola', async () => {
    const manual: BillingAccount = {
      ...suspendedAccount,
      suspension: { reason: 'MANUAL', note: null, suspended_at: '2026-10-02T12:00:00Z', suspended_by: 'admin@plataforma.com' },
      plan: { ...account.plan!, trial_ends_on: '2026-09-15', forecast_total: null, discount: { type: 'PERCENT', value: '10.00', recurrence: 'EVERY', periods: 3 } },
    };
    renderDetail({ current: manual, estimateReply: () => apiOk({ ...estimate, in_trial: true, trial_ends_on: null }) });
    expect(await screen.findByText('Suspensión manual')).toBeInTheDocument();
    expect(fact('Suspendida por')).toHaveTextContent('admin@plataforma.com');
    expect(fact('Detalle')).toHaveTextContent('Sin detalle');
    expect(fact('Demo sin cobro')).toHaveTextContent('Hasta el 15 sep 2026');
    expect(fact('Descuento')).toHaveTextContent('10 % cada 3 cargos');
    expect(fact('Pronóstico del periodo')).toHaveTextContent('Aún sin calcular');
    expect(await within(section()).findByText('En demo')).toBeInTheDocument();
  });

  it('reactivada a mano: no se suspende sola antes de su día de gracia', async () => {
    renderDetail({ current: { ...account, grace_until: '2026-10-14' } });
    expect(await screen.findByText('Reactivada a mano: no se suspende sola antes del 14 oct 2026.')).toBeInTheDocument();
  });

  it('sin plan: no se le cobra, "Capturar plan" lleva a editarla y no se pide el periodo en curso', async () => {
    const calls = renderDetail({ current: noPlanAccount });
    expect(await screen.findByText('Sin plan de cobro')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Capturar plan' })).toHaveAttribute('href', '/admin/companies/4/edit');
    expect(calls.some((c) => c.url.endsWith('/estimate'))).toBe(false);
  });

  it('si la cuenta o el periodo no cargan: popup y "Volver a cargar" en su lugar', async () => {
    let accountTries = 0;
    let estimateTries = 0;
    renderDetail({
      accountReply: () => (accountTries++ === 0 ? apiFail(500, 'INTERNAL_ERROR', 'Falló') : apiOk(account)),
      estimateReply: () => (estimateTries++ === 0 ? apiFail(404, 'BILLING_PLAN_NOT_FOUND', 'Sin plan') : apiOk(estimate)),
    });
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo cargar la cobranza de la empresa' });
    await userEvent.click(within(popup).getAllByRole('button', { name: 'Cerrar' })[0]);
    await userEvent.click(within(section()).getByRole('button', { name: 'Volver a cargar' }));
    const estimatePopup = await screen.findByRole('alertdialog', { name: 'No se pudo calcular el periodo en curso' });
    await userEvent.click(within(estimatePopup).getAllByRole('button', { name: 'Cerrar' })[0]);
    await userEvent.click(within(section()).getByRole('button', { name: 'Volver a cargar' }));
    expect(await within(section()).findByText('Cargo 2 · 1 oct 2026 – 31 oct 2026')).toBeInTheDocument();
  });
});
