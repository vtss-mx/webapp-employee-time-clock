import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { FeedbackProvider } from '../../../context/FeedbackContext';
import { account, chargeDetail, noPlanAccount, payment, paymentResult, suspendedAccount, usdAccount } from '../../../test/billing';
import { pick, renderPage, retype, rowsOf } from '../../../test/companyPages';
import { apiFail, apiOk, envelope, jsonResponse, mockFetch, type MockCall } from '../../../test/http';
import { catalogsWith } from '../../../test/catalogs';
import { WithCatalogs } from '../../../test/render';
import type { BillingAccount, Payment } from '../../../types';
import { businessToday, formatDate } from '../../../utils/format';
import { SuspendCompanyPage, VoidChargePage, VoidPaymentPage } from './BillingReasonPages';
import { ChargeDetailPage } from './ChargeDetailPage';
import { PaymentFormPage } from './PaymentFormPage';
import { chooseFiles } from '../../../test/files';

const BACK = { '/admin/billing/companies/:id': 'Cuenta de la empresa', '/admin/billing/companies/:id/charges/:chargeId': 'Detalle del cargo' };
const posts = (calls: MockCall[]) => calls.filter((c) => c.init.method === 'POST');
/** Elige un archivo sin el filtro `accept` del selector (lo que valida es la app). */
const chooseFile = (input: HTMLElement, file: File) => chooseFiles(input, file);
const todayTyped = () => businessToday().split('-').reverse().join('');
const fail422 = (code: string, message: string, field: string | null, status = 422) =>
  jsonResponse(envelope(null, { status, code, message, errors: [{ code, message, field, details: null }] }), status);

describe('PaymentFormPage (registrar un pago)', () => {
  function renderPayment({ current = account, register = () => apiOk(paymentResult, { status: 201 }), accountReply = () => apiOk(current) }: { current?: BillingAccount; register?: () => Response; accountReply?: () => Response } = {}) {
    const mock = mockFetch((call) => (call.init.method === 'POST' ? register() : accountReply()));
    renderPage('/admin/billing/companies/:id/payments/new', '/admin/billing/companies/4/payments/new', <PaymentFormPage />, { targets: BACK });
    return mock.calls;
  }
  const submit = () => screen.getByRole('button', { name: 'Registrar pago' });

  it('captura el pago con su comprobante, confirma qué se registra y avisa a qué cargos se aplicó', async () => {
    const calls = renderPayment();
    expect(await screen.findByText('Panificadora · por pagar $1,392.00 MXN')).toBeInTheDocument();
    // La moneda es la de la empresa: fija, con la explicación.
    expect(screen.getByRole('button', { name: /Moneda/ })).toBeDisabled();
    expect(screen.getByText('Los pagos van en MXN, la moneda de la empresa.')).toHaveClass('field__hint');
    expect(screen.getByLabelText('Fecha del pago')).toHaveValue(businessToday().split('-').reverse().join('/')); // hoy, por omisión
    await userEvent.type(screen.getByLabelText('Monto'), '1500');
    await pick(/Método/, /Depósito bancario/);
    await userEvent.type(screen.getByLabelText('Referencia'), 'DEP-77');
    await userEvent.type(screen.getByLabelText('Nota'), 'Pago de octubre');
    await userEvent.upload(screen.getByLabelText('Comprobante del pago'), new File(['%PDF'], 'deposito.pdf', { type: 'application/pdf' }));

    await userEvent.click(submit());
    let dialog = await screen.findByRole('dialog', { name: /^¿Registrar el pago de \$1,500\.00\sMXN\?$/ });
    expect(dialog).toHaveTextContent('Se aplica al cargo abierto más antiguo; lo que sobre queda a favor de la empresa.');
    expect(rowsOf(dialog, 'Se registrará')).toEqual([
      'EmpresaPanificadora',
      'Monto$1,500.00\u00a0MXN',
      'MonedaMXN · Peso mexicano',
      `Fecha del pago${formatDate(businessToday())}`,
      'MétodoDepósito bancario',
      'ReferenciaDEP-77',
      'NotaPago de octubre',
      'Comprobantedeposito.pdf',
    ]);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(posts(calls)).toHaveLength(0);

    await userEvent.click(submit());
    dialog = await screen.findByRole('dialog', { name: /^¿Registrar el pago de \$1,500\.00\sMXN\?$/ });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar pago' }));
    expect(await screen.findByText('Cuenta de la empresa')).toBeInTheDocument();
    const popup = await screen.findByRole('dialog', { name: 'Pago registrado' });
    expect(popup).toHaveTextContent('Se aplicó a estos cargos:');
    expect(popup).toHaveTextContent('Cargo 1 (corte 30 sep 2026): $1,392.00');
    expect(popup).toHaveTextContent('Quedó a favor: $108.00');
    const form = posts(calls)[0].init.body as FormData;
    expect([form.get('amount'), form.get('currency'), form.get('method'), form.get('reference'), (form.get('receipt') as File).name]).toEqual(['1500', 'MXN', 'DEPOSIT', 'DEP-77', 'deposito.pdf']);
  });

  it('una empresa en dólares: el monto, la confirmación y el aviso van en USD; el servidor rechaza otra moneda en su campo', async () => {
    let reply = () => fail422('CURRENCY_MISMATCH', 'El pago debe ser en USD, la moneda de la empresa', 'currency');
    const calls = renderPayment({ current: usdAccount, register: () => reply() });
    expect(await screen.findByText('Northwind · por pagar $1,392.00 USD')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Monto'), '250');
    await userEvent.click(submit());
    let dialog = await screen.findByRole('dialog', { name: /^¿Registrar el pago de \$250\.00\sUSD\?$/ });
    expect(rowsOf(dialog, 'Se registrará')).toContain('MonedaUSD · Dólar estadounidense');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar pago' }));
    await screen.findByRole('alertdialog', { name: 'No se pudo registrar el pago' });
    expect(screen.getByText('El pago debe ser en USD, la moneda de la empresa', { selector: '.field__error' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));

    reply = () => apiOk({ ...paymentResult, payment: { ...paymentResult.payment, currency: 'USD' } }, { status: 201 });
    await userEvent.click(submit());
    dialog = await screen.findByRole('dialog', { name: /^¿Registrar el pago de \$250\.00\sUSD\?$/ });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar pago' }));
    const popup = await screen.findByRole('dialog', { name: 'Pago registrado' });
    expect(popup).toHaveTextContent('Cargo 1 (corte 30 sep 2026): $1,392.00 USD');
    expect((posts(calls).at(-1)?.init.body as FormData).get('currency')).toBe('USD');
  });

  it('sin plan ni movimientos, el primer pago elige (y fija) la moneda', async () => {
    const calls = renderPayment({ current: noPlanAccount });
    const currency = await screen.findByRole('button', { name: /Moneda/ });
    expect(currency).toBeEnabled();
    expect(screen.getByText('La empresa aún no tiene plan ni movimientos: este pago fija su moneda.')).toHaveClass('field__hint');
    await pick(/Moneda/, /EUR · Euro/);
    await userEvent.type(screen.getByLabelText('Monto'), '80');
    await userEvent.click(submit());
    await userEvent.click(within(await screen.findByRole('dialog', { name: /€80\.00\sEUR/ })).getByRole('button', { name: 'Registrar pago' }));
    await screen.findByRole('dialog', { name: 'Pago registrado' });
    expect((posts(calls)[0].init.body as FormData).get('currency')).toBe('EUR');
  });

  it('sin cargos abiertos todo queda a favor; si la reactivó, lo dice; suspendida por falta de pago, la confirmación lo advierte', async () => {
    renderPayment({ current: suspendedAccount, register: () => apiOk({ ...paymentResult, applied: [], payment: { ...payment, unapplied: '0.00' }, reactivated: true }) });
    await userEvent.type(await screen.findByLabelText('Monto'), '200');
    await userEvent.click(submit());
    const dialog = await screen.findByRole('dialog', { name: /^¿Registrar el pago de \$200\.00\sMXN\?$/ });
    expect(dialog).toHaveTextContent('La empresa está suspendida por falta de pago: si el pago cubre lo vencido, se reactiva de inmediato.');
    expect(rowsOf(dialog, 'Se registrará').at(-1)).toBe('ComprobanteSin comprobante');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar pago' }));
    const popup = await screen.findByRole('dialog', { name: 'Pago registrado' });
    expect(popup).toHaveTextContent('No había cargos abiertos: todo quedó a favor de la empresa.');
    expect(popup).toHaveTextContent('Reactivada: su personal ya puede iniciar sesión.');
    expect(popup).not.toHaveTextContent('Quedó a favor');
  });

  it('valida monto, fecha, método y comprobante antes de preguntar; los rechazos del servidor van a su campo', async () => {
    let reply = () => fail422('RECEIPT_TOO_LARGE', 'El comprobante pesa más de 5 MB', null, 413);
    const calls = renderPayment({ register: () => reply() });
    await screen.findByLabelText('Monto');
    chooseFile(screen.getByLabelText('Comprobante del pago'), new File(['GIF'], 'foto.gif', { type: 'image/gif' }));
    expect(screen.getByLabelText('Comprobante del pago')).toHaveAccessibleDescription('El comprobante debe ser PDF, JPG, PNG o WEBP');
    await retype('Fecha del pago', '31122099');
    fireEvent.submit(submit().closest('form') as HTMLFormElement);
    const invalid = await screen.findByRole('alertdialog', { name: 'Revisa los datos' });
    expect(invalid).toHaveTextContent('Escribe el monto');
    expect(invalid).toHaveTextContent('La fecha del pago no puede ser futura');
    expect(invalid).toHaveTextContent('El comprobante debe ser PDF, JPG, PNG o WEBP');
    await userEvent.click(within(invalid).getByRole('button', { name: 'Entendido' }));
    await retype('Fecha del pago', '');
    await userEvent.type(screen.getByLabelText('Monto'), '999999999');
    fireEvent.submit(submit().closest('form') as HTMLFormElement);
    const again = await screen.findByRole('alertdialog', { name: 'Revisa los datos' });
    expect(again).toHaveTextContent('El monto debe ser mayor que 0 y hasta $100,000,000');
    expect(again).toHaveTextContent('Elige la fecha del pago');
    await userEvent.click(within(again).getByRole('button', { name: 'Entendido' }));
    expect(posts(calls)).toHaveLength(0);

    await retype('Monto', '100');
    await retype('Fecha del pago', todayTyped());
    await userEvent.upload(screen.getByLabelText('Comprobante del pago'), new File(['%PDF'], 'ok.pdf', { type: 'application/pdf' }));
    await userEvent.click(submit());
    await userEvent.click(within(await screen.findByRole('dialog', { name: /^¿Registrar el pago de \$100\.00\sMXN\?$/ })).getByRole('button', { name: 'Registrar pago' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo registrar el pago' })).toBeInTheDocument();
    expect(screen.getByLabelText('Comprobante del pago')).toHaveAccessibleDescription('El comprobante pesa más de 5 MB');
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    await userEvent.click(screen.getByRole('button', { name: 'Quitar archivo' })); // cambiar el archivo descarta el error del servidor
    expect(screen.getByLabelText('Comprobante del pago')).toHaveAccessibleDescription('Opcional. PDF, JPG, PNG o WEBP de hasta 5 MB.');

    reply = () => fail422('VALIDATION_ERROR', 'Monto inválido', 'amount');
    await userEvent.click(submit());
    await userEvent.click(within(await screen.findByRole('dialog', { name: /^¿Registrar el pago de \$100\.00\sMXN\?$/ })).getByRole('button', { name: 'Registrar pago' }));
    await screen.findByRole('alertdialog', { name: 'No se pudo registrar el pago' });
    expect(screen.getByLabelText('Monto')).toHaveAccessibleDescription('Monto inválido');
  });

  it('una moneda que ya no se ofrece se sigue mostrando si es la de la empresa (sin aclaración si el catálogo no la tiene)', async () => {
    mockFetch(apiOk(usdAccount));
    const currencies = catalogsWith({}).currencies.map((item) => (item.code === 'USD' ? { ...item, active: false, description: null } : item));
    renderPage('/admin/billing/companies/:id/payments/new', '/admin/billing/companies/7/payments/new', <PaymentFormPage />, { catalogs: catalogsWith({ currencies }) });
    expect(await screen.findByRole('button', { name: /Moneda/ })).toHaveTextContent('USD · Dólar estadounidense');
  });

  it('sin medios de pago activos en el catálogo, se pide elegir uno', async () => {
    mockFetch(apiOk(account));
    renderPage('/admin/billing/companies/:id/payments/new', '/admin/billing/companies/4/payments/new', <PaymentFormPage />, { catalogs: catalogsWith({ payment_methods: [] }) });
    await userEvent.type(await screen.findByLabelText('Monto'), '10');
    fireEvent.submit(submit().closest('form') as HTMLFormElement);
    expect(await screen.findByRole('alertdialog', { name: 'Revisa los datos' })).toHaveTextContent('Elige el método de pago');
  });

  it('si la cuenta no carga, "Volver a cargar"; "Cancelar" regresa a la cuenta', async () => {
    let tries = 0;
    renderPayment({ accountReply: () => (tries++ === 0 ? apiFail(500, 'INTERNAL_ERROR', 'Falló') : apiOk(account)) });
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo cargar la cobranza de la empresa' });
    await userEvent.click(within(popup).getAllByRole('button', { name: 'Cerrar' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText('Cuenta de la empresa')).toBeInTheDocument();
  });
});

describe('formularios con motivo (suspender, anular un cargo o un pago)', () => {
  const reason = () => screen.getByLabelText('Motivo');

  it('suspender: explica que se cierran TODAS las sesiones, confirma y avisa; ya suspendida no se puede', async () => {
    let current: BillingAccount = account;
    const { calls } = mockFetch((call) => (call.init.method === 'POST' ? apiOk(suspendedAccount) : apiOk(current)));
    const { unmount } = renderPage('/admin/billing/companies/:id/suspend', '/admin/billing/companies/4/suspend', <SuspendCompanyPage />, { targets: BACK });
    expect(await screen.findByText(/se cierran todas las sesiones de la empresa/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Suspender' }));
    expect(reason()).toHaveAccessibleDescription(/al menos 5 caracteres/);
    await userEvent.type(reason(), 'Tres meses sin pagar');
    await userEvent.click(screen.getByRole('button', { name: 'Suspender' }));
    const dialog = await screen.findByRole('alertdialog', { name: '¿Suspender a Panificadora?' });
    expect(dialog).toHaveTextContent('Se cerrarán ahora TODAS las sesiones de la empresa (administradores, empleados y validadores)');
    expect(rowsOf(dialog, 'Cambios')).toEqual(['EstadoAntes: ActivaDespués: Suspendida']);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Suspender empresa' }));
    expect(await screen.findByText('Cuenta de la empresa')).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: 'Empresa suspendida' })).toBeInTheDocument();
    expect(JSON.parse(posts(calls)[0].init.body as string)).toEqual({ reason: 'Tres meses sin pagar' });
    unmount();

    let tries = 0;
    current = suspendedAccount;
    mockFetch(() => (tries++ === 0 ? apiFail(500, 'INTERNAL_ERROR', 'Falló') : apiOk(current)));
    renderPage('/admin/billing/companies/:id/suspend', '/admin/billing/companies/4/suspend', <SuspendCompanyPage />, { targets: BACK });
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo cargar la cobranza de la empresa' });
    await userEvent.click(within(popup).getAllByRole('button', { name: 'Cerrar' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Suspender' })).toHaveAttribute('title', 'La empresa ya está suspendida'));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText('Cuenta de la empresa')).toBeInTheDocument();
  });

  it('anular un cargo: lo carga, confirma "antes → después" y regresa a su detalle; anulado no se puede; si no carga, reintentar', async () => {
    let tries = 0;
    const { calls } = mockFetch((call) => (call.init.method === 'POST' ? apiOk({ charge: { ...chargeDetail, status: 'VOID' }, account }) : tries++ === 0 ? apiFail(500, 'INTERNAL_ERROR', 'Falló') : apiOk(chargeDetail)));
    renderPage('/admin/billing/companies/:id/charges/:chargeId/void', '/admin/billing/companies/4/charges/31/void', <VoidChargePage />, { targets: BACK });
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo cargar el cargo' });
    await userEvent.click(within(popup).getAllByRole('button', { name: 'Cerrar' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByRole('heading', { name: 'Anular cargo 1' })).toBeInTheDocument();
    expect(screen.getByText('1 sep 2026 – 30 sep 2026 · $1,392.00 MXN')).toBeInTheDocument();
    await userEvent.type(reason(), 'Cobro duplicado');
    await userEvent.click(screen.getByRole('button', { name: 'Anular cargo' }));
    const dialog = await screen.findByRole('alertdialog', { name: '¿Anular el cargo 1?' });
    expect(rowsOf(dialog, 'Cambios')).toEqual(['EstadoAntes: Por pagarDespués: Anulado']);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Anular cargo' }));
    expect(await screen.findByText('Detalle del cargo')).toBeInTheDocument();
    expect(posts(calls)[0].url).toBe('/api/admin/billing/companies/4/charges/31/void');
  });

  it('si suspender, anular un cargo o anular un pago falla, su popup lo dice y el formulario sigue ahí', async () => {
    mockFetch((call) => (call.init.method === 'POST' ? apiFail(500, 'INTERNAL_ERROR', 'Falló') : call.url.includes('/charges/') ? apiOk(chargeDetail) : apiOk(account)));
    const attempt = async (button: string, confirmName: RegExp, confirmButton: string, errorTitle: string) => {
      await userEvent.type(reason(), 'Motivo de prueba');
      await userEvent.click(screen.getByRole('button', { name: button }));
      await userEvent.click(within(await screen.findByRole('alertdialog', { name: confirmName })).getByRole('button', { name: confirmButton }));
      expect(await screen.findByRole('alertdialog', { name: errorTitle })).toBeInTheDocument();
    };
    const suspend = renderPage('/admin/billing/companies/:id/suspend', '/admin/billing/companies/4/suspend', <SuspendCompanyPage />, { targets: BACK });
    await screen.findByLabelText('Motivo');
    await attempt('Suspender', /Suspender a Panificadora/, 'Suspender empresa', 'No se pudo suspender la empresa');
    suspend.unmount();
    const charge = renderPage('/admin/billing/companies/:id/charges/:chargeId/void', '/admin/billing/companies/4/charges/31/void', <VoidChargePage />, { targets: BACK });
    await screen.findByRole('heading', { name: 'Anular cargo 1' });
    await attempt('Anular cargo', /Anular el cargo 1/, 'Anular cargo', 'No se pudo anular el cargo');
    charge.unmount();
    renderVoidPayment({ payment });
    mockFetch(() => apiFail(500, 'INTERNAL_ERROR', 'Falló'));
    await attempt('Anular pago', /Anular el pago de/, 'Anular pago', 'No se pudo anular el pago');
  });

  it('anular un cargo ya anulado no se ofrece', async () => {
    mockFetch(apiOk({ ...chargeDetail, status: 'VOID' }));
    renderPage('/admin/billing/companies/:id/charges/:chargeId/void', '/admin/billing/companies/4/charges/31/void', <VoidChargePage />, { targets: BACK });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Anular cargo' })).toHaveAttribute('title', 'El cargo ya está anulado'));
  });

  function renderVoidPayment(state: unknown) {
    const mock = mockFetch(apiOk({ payment: { ...payment, status: 'VOID' }, account }));
    render(
      <MemoryRouter initialEntries={[{ pathname: '/admin/billing/companies/4/payments/51/void', state }]}>
        <FeedbackProvider>
          <WithCatalogs>
            <Routes>
              <Route path="/admin/billing/companies/:id/payments/:paymentId/void" element={<VoidPaymentPage />} />
              <Route path="/admin/billing/companies/:id" element={<p>Pagos de la empresa</p>} />
            </Routes>
          </WithCatalogs>
        </FeedbackProvider>
      </MemoryRouter>,
    );
    return mock.calls;
  }

  it('anular un pago con sus datos (desde la lista): confirma y regresa a los pagos', async () => {
    const calls = renderVoidPayment({ payment });
    expect(screen.getByText('$500.00 MXN · 1 oct 2026 · Transferencia')).toBeInTheDocument();
    await userEvent.type(reason(), 'Pago duplicado');
    await userEvent.click(screen.getByRole('button', { name: 'Anular pago' }));
    const dialog = await screen.findByRole('alertdialog', { name: /^¿Anular el pago de \$500\.00\sMXN\?$/ });
    expect(dialog).toHaveTextContent('Los cargos que cubría vuelven a quedar por pagar');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Anular pago' }));
    expect(await screen.findByText('Pagos de la empresa')).toBeInTheDocument();
    expect(JSON.parse(posts(calls)[0].init.body as string)).toEqual({ reason: 'Pago duplicado' });
  });

  it('anular un pago abierto desde un enlace (sin sus datos) se identifica por su número', async () => {
    renderVoidPayment({ payment: { ...payment, id: 99 } }); // datos de otro pago: no cuentan
    expect(screen.getByText('Pago 51')).toBeInTheDocument();
    await userEvent.type(reason(), 'Captura equivocada');
    await userEvent.click(screen.getByRole('button', { name: 'Anular pago' }));
    const dialog = await screen.findByRole('alertdialog', { name: '¿Anular el pago?' });
    expect(dialog).toHaveTextContent('PagoPago 51');
    expect(dialog).toHaveTextContent('MotivoCaptura equivocada');
  });

  it('un pago ya anulado no se puede volver a anular', () => {
    renderVoidPayment({ payment: { ...payment, status: 'VOID' } satisfies Payment });
    expect(screen.getByRole('button', { name: 'Anular pago' })).toHaveAttribute('title', 'El pago ya está anulado');
  });
});

describe('ChargeDetailPage (detalle de un cargo)', () => {
  function renderCharge(reply: () => Response) {
    mockFetch(reply);
    renderPage('/admin/billing/companies/:id/charges/:chargeId', '/admin/billing/companies/4/charges/31', <ChargeDetailPage />);
  }
  const fact = (label: string, section?: string) => (section ? within(screen.getByRole('heading', { name: section }).closest('section') as HTMLElement) : screen).getByText(label).nextElementSibling;

  it('periodo, precio aplicado, detalle por mes, totales con lo pagado y los pagos aplicados; "Anular cargo"', async () => {
    renderCharge(() => apiOk({ ...chargeDetail, overdue: true }));
    expect(await screen.findByRole('heading', { name: 'Cargo 1' })).toBeInTheDocument();
    expect(screen.getAllByText('Vencido').length).toBeGreaterThan(0);
    expect(fact('Vence')).toHaveTextContent('10 oct 2026');
    expect(fact('Se cobró')).toHaveTextContent('300 días-persona (270 de empleados, 30 de validadores)');
    expect(fact('Precio (sin IVA)')).toHaveTextContent('$120.00 MXN por mes');
    expect(fact('Moneda')).toHaveTextContent('MXN · Peso mexicano');
    expect(fact('IVA', 'Precio aplicado')).toHaveTextContent('16 %');
    expect(screen.getByText('septiembre de 2026').closest('tr')).toHaveTextContent('30 días300 días-persona (270 de empleados, 30 de validadores)$1,200.00');
    expect(screen.getByLabelText('Totales del cargo').textContent).toBe('Subtotal$1,200.00\u00a0MXNIVA$192.00\u00a0MXNTotal$1,392.00\u00a0MXNPagado$0.00\u00a0MXNSaldo$1,392.00\u00a0MXN');
    expect(screen.getByText('SPEI-1').closest('li')).toHaveTextContent('$500.00');
    expect(screen.getByRole('link', { name: 'Anular cargo' })).toHaveAttribute('href', '/admin/billing/companies/4/charges/31/void');
  });

  it('anulado: quién, cuándo y por qué; sin pagos aplicados; si no carga, "Volver a cargar"', async () => {
    let tries = 0;
    renderCharge(() =>
      tries++ === 0
        ? apiFail(500, 'INTERNAL_ERROR', 'Falló')
        : apiOk({ ...chargeDetail, status: 'VOID', allocations: [{ ...chargeDetail.allocations[0], reference: null }], voided_at: '2026-10-03T12:00:00Z', void_reason: 'Duplicado', voided_by: null }),
    );
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo cargar el cargo' });
    await userEvent.click(within(popup).getAllByRole('button', { name: 'Cerrar' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByRole('heading', { name: 'Anulado' })).toBeInTheDocument();
    expect(fact('Motivo')).toHaveTextContent('Duplicado');
    expect(fact('Por')).toHaveTextContent('—');
    expect(screen.getByText('Sin referencia')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Anular cargo' })).toBeNull();
  });

  it('sin pagos aplicados lo dice; uno anulado sin motivo registrado muestra "—"; con monto fijo se cobran días', async () => {
    renderCharge(() => apiOk({ ...chargeDetail, pricing_mode: 'FLAT', units: 30, status: 'VOID', allocations: [], voided_at: null, void_reason: null, voided_by: 'admin@plataforma.com' }));
    expect(await screen.findByText('Sin pagos aplicados')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Días cobrados' })).toBeInTheDocument();
    expect(fact('Se cobró')).toHaveTextContent('30 días');
    expect(fact('Motivo')).toHaveTextContent('—');
    expect(fact('Por')).toHaveTextContent('admin@plataforma.com');
  });
});
