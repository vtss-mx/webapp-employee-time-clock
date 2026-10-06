import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../../i18n/core';
import { account, charge, companyRow, estimate, noPlanAccount, overview, page, payment, statementEntries, suspendedAccount } from '../../../test/billing';
import { pick, renderPage, rowsOf, settle } from '../../../test/companyPages';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../../test/http';
import type { BillingAccount } from '../../../types';
import { BillingPage } from './BillingPage';
import { CompanyBillingPage } from './CompanyBillingPage';

// La actualización periódica se prueba en su hook; aquí se ejecuta a mano lo que cada pantalla le pasa.
const refreshers = vi.hoisted(() => [] as Array<() => void>);
vi.mock('../../../hooks/useAutoRefresh', () => ({ useAutoRefresh: (refresh: () => void) => refreshers.push(refresh) }));

const urls = (calls: MockCall[], part: string) => calls.filter((c) => c.url.includes(part)).map((c) => c.url);

describe('BillingPage (cobranza de la plataforma)', () => {
  function renderBilling(rows = [companyRow], overviewReply = () => apiOk(overview)) {
    const mock = mockFetch((call) => (call.url.endsWith('/overview') ? overviewReply() : page(rows)));
    renderPage('/admin/billing', '/admin/billing', <BillingPage />, { targets: { '/admin/billing/companies/:id': 'Cuenta de la empresa' } });
    return mock.calls;
  }

  it('el dinero por moneda (nunca sumado), los indicadores de las empresas y la lista con su saldo en su moneda; una fila abre su cuenta', async () => {
    const calls = renderBilling([
      companyRow,
      { ...companyRow, company_id: 5, name: 'Tortillería', status: 'SUSPENDED', suspension_reason: 'NON_PAYMENT', plan: null, overdue: '800.00', oldest_due_on: '2026-09-10', forecast_total: null, last_payment_on: null },
      { ...companyRow, company_id: 6, name: 'Northwind', currency: 'USD', outstanding: '250.00', forecast_total: '250.00' },
      { ...companyRow, company_id: 7, name: 'Nueva', currency: null, plan: null, outstanding: '0.00', forecast_total: null },
    ]);
    expect(await screen.findByText('Al 4 oct 2026 · montos con IVA, por moneda')).toBeInTheDocument();
    // Un bloque por moneda, en el orden del catálogo, con cuántas empresas cobra cada una.
    const groups = [...document.querySelectorAll('.currency-group')] as HTMLElement[];
    expect(groups.map((group) => group.querySelector('h3')?.textContent)).toEqual(['MXN · Peso mexicano2 empresas con plan', 'USD · Dólar estadounidense1 empresa con plan']);
    const money = ['Facturado este mes', 'Cobrado este mes', 'Por cobrar', 'Vencido', 'Saldo a favor', 'Pronóstico del periodo', 'Último corte'];
    const labels = [...document.querySelectorAll('.kpi__label')].map((label) => label.textContent);
    expect(labels).toEqual([...money, ...money, 'Con plan', 'Con saldo vencido', 'Suspendidas', 'En demo']);
    await waitFor(() => expect(groups[0].querySelectorAll('.kpi__value')[2]).toHaveTextContent('$3,676.00 MXN'));
    await waitFor(() => expect(groups[1].querySelectorAll('.kpi__value')[2]).toHaveTextContent('$250.00 USD'));
    expect(within(groups[0]).getByText('3 cargos · 30 sep 2026')).toBeInTheDocument();
    expect(within(groups[1]).getByText('1 cargo · 30 sep 2026')).toBeInTheDocument();
    expect(within(groups[0]).getByText('1 empresa con saldo vencido')).toBeInTheDocument();
    expect(screen.getByText('1 sin plan · 4 en total')).toBeInTheDocument();

    const row = (await screen.findByText('Tortillería')).closest('tr') as HTMLElement;
    expect(row).toHaveTextContent('Sin plan de cobro');
    expect(row).toHaveTextContent('Suspendida');
    expect(row).toHaveTextContent('Falta de pago');
    expect(within(row).getByText('$800.00 MXN')).toHaveClass('text-danger');
    expect(row).toHaveTextContent('desde el 10 sep 2026');
    const first = screen.getByText('Panificadora').closest('tr') as HTMLElement;
    expect(first).toHaveTextContent('Por empleado activo · $120.00 MXN por mes · cada mes');
    expect(first).toHaveTextContent('≈ $1,392.00 MXN');
    const dollars = screen.getByText('Northwind').closest('tr') as HTMLElement;
    expect(dollars).toHaveTextContent('Por empleado activo · $120.00 USD por mes · cada mes');
    expect(dollars).toHaveTextContent('$250.00 USD');
    expect(screen.getByText('Nueva').closest('tr')).toHaveTextContent('Activa—1 cargo abierto——'); // sin moneda: sin montos
    expect(urls(calls, '/billing/companies')[0]).toBe('/api/admin/billing/companies?page=1&size=10');

    await settle(() => refreshers.at(-1)?.()); // actualización periódica: indicadores y lista
    await waitFor(() => expect(urls(calls, '/overview')).toHaveLength(2));
    await userEvent.click(first);
    expect(await screen.findByText('Cuenta de la empresa')).toBeInTheDocument();
  });

  it('busca, filtra por estado de cobranza y "solo con saldo vencido"; sin resultados lo dice según los filtros', async () => {
    const calls = renderBilling([]);
    expect(await screen.findByText('Sin empresas')).toBeInTheDocument();
    await pick(/Filtrar por estado/, /Suspendida/);
    await waitFor(() => expect(urls(calls, '/billing/companies').at(-1)).toContain('status=SUSPENDED'));
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
    await pick(/Filtrar por estado/, /^Activa$/);
    await waitFor(() => expect(urls(calls, '/billing/companies').at(-1)).toContain('status=ACTIVE'));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Solo con saldo vencido' }));
    await waitFor(() => expect(urls(calls, '/billing/companies').at(-1)).toContain('overdue=true'));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar empresas' }), 'pan');
    await waitFor(() => expect(urls(calls, '/billing/companies').at(-1)).toContain('search=pan'));
  });

  it('si los indicadores no cargan: popup y "Volver a cargar"; sin cortes todavía lo dice', async () => {
    let tries = 0;
    renderBilling([companyRow], () => (tries++ === 0 ? apiFail(500, 'INTERNAL_ERROR', 'Falló') : apiOk({ ...overview, last_cut_on: null })));
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudieron cargar los indicadores de cobranza' });
    await userEvent.click(within(popup).getAllByRole('button', { name: 'Cerrar' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByText('Al 4 oct 2026 · montos con IVA, por moneda')).toBeInTheDocument();
    expect(screen.getAllByText('Aún no hay cortes')).toHaveLength(2); // uno por moneda
  });

  it('si la lista de empresas no carga, su popup lo dice', async () => {
    mockFetch((call) => (call.url.endsWith('/overview') ? apiOk(overview) : apiFail(500, 'INTERNAL_ERROR', 'Falló')));
    renderPage('/admin/billing', '/admin/billing', <BillingPage />);
    expect(await screen.findByRole('alertdialog', { name: 'No se pudieron cargar las empresas' })).toBeInTheDocument();
  });

  it('sin planes ni movimientos todavía: el dinero lo dice (sin inventar una moneda)', async () => {
    renderBilling([], () => apiOk({ ...overview, last_cut_on: null, currencies: [] }));
    expect(await screen.findByText('Sin cobros')).toBeInTheDocument();
    expect(document.querySelectorAll('.currency-group')).toHaveLength(0);
  });

  it('en inglés: los mismos montos con su moneda y los textos del resumen', async () => {
    await setLocale('en-US');
    renderBilling([{ ...companyRow, currency: 'EUR' }]);
    expect(await screen.findByText('As of Oct 4, 2026 · amounts incl. VAT, by currency')).toBeInTheDocument();
    const groups = [...document.querySelectorAll('.currency-group')] as HTMLElement[];
    await waitFor(() => expect(groups[1].querySelectorAll('.kpi__value')[2]).toHaveTextContent('$250.00 USD'));
    expect(within(groups[0]).getByText('Receivable')).toBeInTheDocument();
    expect((await screen.findByText('Panificadora')).closest('tr')).toHaveTextContent('€1,392.00 EUR');
  });
});

describe('CompanyBillingPage (cuenta de una empresa)', () => {
  interface Options {
    current?: BillingAccount;
    route?: string;
    accountReply?: () => Response;
    lists?: Partial<Record<'charges' | 'payments' | 'statement', () => Response>>;
    receipt?: () => Response;
  }
  function renderAccount({ current = account, route = '/admin/billing/companies/4', accountReply = () => apiOk(current), lists = {}, receipt = () => apiOk({ file_name: 'spei.pdf', content_type: 'application/pdf', size: 4, data: btoa('hola') }) }: Options = {}) {
    const mock = mockFetch((call) => {
      if (call.url.endsWith('/reactivate')) return apiOk({ ...current, status: 'ACTIVE', suspension: null });
      if (call.url.endsWith('/receipt')) return receipt();
      if (call.url.endsWith('/estimate')) return apiOk(estimate);
      if (call.url.includes('/charges')) return (lists.charges ?? (() => page([charge, { ...charge, id: 32, sequence: 2, overdue: true }])))();
      if (call.url.includes('/payments')) return (lists.payments ?? (() => page([payment, { ...payment, id: 52, receipt: null, reference: null, status: 'VOID', void_reason: 'Pago duplicado' }])))();
      if (call.url.includes('/statement')) return (lists.statement ?? (() => page(statementEntries)))();
      return accountReply();
    });
    renderPage('/admin/billing/companies/:id', route, <CompanyBillingPage />, {
      targets: { '/admin/billing/companies/:id/charges/:chargeId': 'Detalle del cargo', '/admin/billing/companies/:id/payments/:paymentId/void': 'Anular pago' },
    });
    return mock.calls;
  }

  it('estado, plan, saldo, periodo en curso y cargos; un cargo abre su detalle', async () => {
    const calls = renderAccount();
    expect(await screen.findByRole('heading', { name: 'Panificadora' })).toBeInTheDocument();
    expect(screen.getByText('Por empleado activo · $120.00 MXN por mes · cada mes')).toBeInTheDocument();
    // Su moneda, fija porque ya tiene movimientos (con la explicación).
    expect(screen.getByText('MXN · Peso mexicano')).toBeInTheDocument();
    expect(screen.getByTitle(/No se puede cambiar/)).toHaveTextContent('Fija');
    expect(screen.getByRole('link', { name: 'Registrar pago' })).toHaveAttribute('href', '/admin/billing/companies/4/payments/new');
    expect(screen.getByRole('link', { name: 'Suspender' })).toHaveAttribute('href', '/admin/billing/companies/4/suspend');
    expect(screen.getByRole('link', { name: 'Editar plan' })).toHaveAttribute('href', '/admin/companies/4/edit');
    expect(screen.getByRole('link', { name: 'Ver empresa' })).toHaveAttribute('href', '/admin/companies/4');
    expect(await screen.findByText('Cargo 2 · 1 oct 2026 – 31 oct 2026')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Cargos' })).toHaveAttribute('aria-selected', 'true');
    const overdue = (await screen.findByText('Cargo 2')).closest('tr') as HTMLElement;
    expect(overdue).toHaveTextContent('Vencido');
    expect(overdue).toHaveTextContent('Por pagar');
    await pick(/Filtrar por estado/, /Pagado/);
    await waitFor(() => expect(urls(calls, '/charges').at(-1)).toBe('/api/admin/billing/companies/4/charges?page=1&size=10&status=PAID'));
    await userEvent.click((await screen.findByText('Cargo 1')).closest('tr') as HTMLElement);
    expect(await screen.findByText('Detalle del cargo')).toBeInTheDocument();
  });

  it('pagos: descarga el comprobante y "Anular" abre su formulario con los datos del pago', async () => {
    const createObjectURL = vi.fn(() => 'blob:x');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderAccount();
    await userEvent.click(await screen.findByRole('tab', { name: 'Pagos' }));
    const voided = (await screen.findByText('Pago duplicado')).closest('tr') as HTMLElement;
    expect(within(voided).queryByRole('button')).toBeNull(); // anulado y sin comprobante: nada que hacer
    const row = screen.getByText('Transferencia · SPEI-1').closest('tr') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'Comprobante' }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull(); // la descarga es el resultado: sin aviso
    await userEvent.click(within(row).getByRole('button', { name: 'Anular' }));
    expect(await screen.findByText('Anular pago')).toBeInTheDocument();
  });

  it('si el comprobante no se puede descargar, popup; sin pagos ni cargos, sus estados vacíos', async () => {
    renderAccount({ receipt: () => apiFail(404, 'RECEIPT_NOT_FOUND', 'El pago no tiene comprobante'), lists: { charges: () => page([]) } });
    expect(await screen.findByText('Sin cargos')).toBeInTheDocument();
    expect(screen.getByText('Aquí verás los cargos de cada periodo.')).toBeInTheDocument();
    await pick(/Filtrar por estado/, /Anulado/);
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Pagos' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Comprobante' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo descargar el comprobante' })).toHaveTextContent('El pago no tiene comprobante');
  });

  it('pagos vacíos con y sin filtro; estado de cuenta con el saldo acumulado; las pestañas viven en la URL', async () => {
    renderAccount({ route: '/admin/billing/companies/4?tab=statement', lists: { payments: () => page([]) } });
    expect(await screen.findByRole('tab', { name: 'Estado de cuenta' })).toHaveAttribute('aria-selected', 'true');
    const paymentRow = (await screen.findByText('Pago · Transferencia · SPEI-1')).closest('tr') as HTMLElement;
    expect(paymentRow).toHaveTextContent('$892.00');
    expect(screen.getByText('Cargo 1 · sep 2026').closest('tr')).toHaveTextContent('$1,392.00');
    await userEvent.click(screen.getByRole('tab', { name: 'Pagos' }));
    expect(await screen.findByText('Sin pagos')).toBeInTheDocument();
    expect(screen.getByText('Aquí verás los pagos que registres.')).toBeInTheDocument();
    await pick(/Filtrar por estado/, /Confirmado/);
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Cargos' }));
    expect(screen.getByRole('tab', { name: 'Cargos' })).toHaveAttribute('aria-selected', 'true');
  });

  it('suspendida: "Reactivar" explica que el acceso vuelve ya y la gracia empieza de nuevo; cancelar no envía nada', async () => {
    const calls = renderAccount({ current: suspendedAccount });
    await userEvent.click(await screen.findByRole('button', { name: 'Reactivar' }));
    let dialog = await screen.findByRole('dialog', { name: '¿Reactivar a Panificadora?' });
    expect(dialog).toHaveTextContent('Su personal podrá iniciar sesión de inmediato. El periodo de gracia empieza de nuevo: 10 días antes de que se suspenda sola si sigue sin pagar.');
    expect(rowsOf(dialog, 'Cambios')).toEqual(['EstadoAntes: SuspendidaDespués: Activa']);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(calls.some((c) => c.url.endsWith('/reactivate'))).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Reactivar' }));
    dialog = await screen.findByRole('dialog', { name: '¿Reactivar a Panificadora?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reactivar empresa' }));
    expect(await screen.findByRole('dialog', { name: 'Empresa reactivada' })).toBeInTheDocument();
    expect(JSON.parse(calls.find((c) => c.url.endsWith('/reactivate'))?.init.body as string)).toEqual({ note: null });
    expect(screen.getByRole('link', { name: 'Suspender' })).toBeInTheDocument();
  });

  it('si cargos, pagos o el estado de cuenta no cargan, cada pestaña lo dice en su popup', async () => {
    const fail = () => apiFail(500, 'INTERNAL_ERROR', 'Falló');
    renderAccount({ current: suspendedAccount, lists: { charges: fail, payments: fail, statement: fail } });
    const close = async (name: string) => userEvent.click(within(await screen.findByRole('alertdialog', { name })).getAllByRole('button', { name: 'Cerrar' })[0]);
    await close('No se pudieron cargar los cargos');
    await userEvent.click(screen.getByRole('tab', { name: 'Pagos' }));
    await close('No se pudieron cargar los pagos');
    await userEvent.click(screen.getByRole('tab', { name: 'Estado de cuenta' }));
    await close('No se pudo cargar el estado de cuenta');
  });

  it('si reactivar falla, el popup lo dice y la empresa sigue suspendida', async () => {
    mockFetch((call) => {
      if (call.url.endsWith('/reactivate')) return apiFail(500, 'INTERNAL_ERROR', 'Falló');
      if (call.url.endsWith('/estimate')) return apiOk(estimate);
      if (call.url.includes('/charges') || call.url.includes('/payments') || call.url.includes('/statement')) return page([]);
      return apiOk(suspendedAccount);
    });
    renderPage('/admin/billing/companies/:id', '/admin/billing/companies/4', <CompanyBillingPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Reactivar' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Reactivar a Panificadora?' })).getByRole('button', { name: 'Reactivar empresa' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo reactivar la empresa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reactivar' })).toBeInTheDocument();
  });

  it('sin plan: no hay periodo en curso; si la cuenta no carga, "Volver a cargar"', async () => {
    let tries = 0;
    const calls = renderAccount({ accountReply: () => (tries++ === 0 ? apiFail(500, 'INTERNAL_ERROR', 'Falló') : apiOk(noPlanAccount)) });
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo cargar la cobranza de la empresa' });
    await userEvent.click(within(popup).getAllByRole('button', { name: 'Cerrar' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByText('Sin plan de cobro: no se le cobra')).toBeInTheDocument();
    expect(screen.getByText('No se le emiten cargos. Captúralo con «Editar plan».')).toBeInTheDocument();
    expect(calls.some((c) => c.url.endsWith('/estimate'))).toBe(false);
  });
});
