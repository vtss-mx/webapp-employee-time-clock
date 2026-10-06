import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { preview } from '../../test/billing';
import { company, pick, renderPage, retype, rowsOf } from '../../test/companyPages';
import { apiFail, apiOk, jsonResponse, envelope, liveCheck, mockFetch, type MockCall } from '../../test/http';
import { CompanyCreatePage } from './CompanyCreatePage';

/** Datos de la empresa y de su administrador; `taxId` vacío = sin identificador fiscal (es opcional). */
async function fillCompany({ taxId = 'PNO120315AB1' } = {}) {
  await userEvent.type(screen.getByLabelText('Nombre comercial'), 'Panificadora');
  await userEvent.type(screen.getByLabelText('Razón social'), 'Panificadora del Norte SA de CV');
  if (taxId) await userEvent.type(screen.getByLabelText('Identificador fiscal'), taxId);
  await userEvent.type(screen.getByLabelText('Teléfono'), '6621234567');
  await userEvent.type(screen.getByLabelText('Correo del administrador'), 'admin@pan.com');
  await userEvent.type(screen.getByLabelText('Contraseña inicial'), 'Empresa1234');
  await userEvent.type(screen.getByLabelText(/Confirmar contraseña/), 'Empresa1234');
}

/** Servidor: validación en vivo, vista previa (personalizable) y el alta. */
function server({ previewReply = () => apiOk(preview), create = () => apiOk(company, { status: 201 }) }: { previewReply?: () => Response; create?: () => Response } = {}) {
  return mockFetch((call) => {
    if (call.url.includes('/validation')) return liveCheck();
    return call.url.endsWith('/billing/preview') ? previewReply() : create();
  });
}
const previews = (calls: MockCall[]) =>
  calls.filter((c) => c.url.endsWith('/billing/preview')).map((c) => JSON.parse(c.init.body as string) as { plan: Record<string, unknown>; employees: number; validators: number });
const posts = (calls: MockCall[]) => calls.filter((c) => c.url.endsWith('/admin/companies'));
const renderCreate = () => renderPage('/admin/companies/new', '/admin/companies/new', <CompanyCreatePage />, { targets: { '/admin/companies/:id': 'Detalle de empresa' } });
const previewBox = () => screen.getByRole('complementary', { name: 'Vista previa del cobro' });

describe('CompanyCreatePage: plan y cobro', () => {
  it('el ADMIN le da lugares para validadores desde el alta: se confirman, se envían y el aviso dice que se cobran', async () => {
    const { calls } = server({ create: () => apiOk({ ...company, max_validators: 3 }, { status: 201 }) });
    renderCreate();
    await fillCompany();
    await userEvent.type(screen.getByLabelText('Precio por empleado activo'), '120');
    const field = screen.getByLabelText('Límite de validadores');
    expect(field).toHaveValue('0');
    expect(field).toHaveAccessibleDescription('0 apaga el módulo. Cada validador activo se cobra como un empleado.');
    await userEvent.clear(field);
    await userEvent.tab();
    expect(field).toHaveAccessibleDescription('Escribe cuántos validadores activos puede tener (0 apaga el módulo)');
    expect(screen.getByRole('button', { name: 'Registrar empresa' })).toBeDisabled();
    await userEvent.type(field, '3');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Registrar empresa' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Registrar empresa' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Registrar la empresa Panificadora?' });
    expect(rowsOf(dialog, 'Se registrará')).toContain('Límite de validadores3 validadores activos');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar empresa' }));
    const popup = await screen.findByRole('dialog', { name: 'Empresa registrada' });
    expect(popup).toHaveTextContent('Puede tener hasta 3 validadores activos; cada uno se cobra como un empleado.');
    expect(JSON.parse(posts(calls)[0].init.body as string)).toMatchObject({ max_validators: 3 });
  });

  it('captura todo el plan (en dólares, monto fijo, por año, cada 3 meses, demo, descuento en los primeros cargos, sin IVA) y lo envía', async () => {
    const { calls } = server();
    renderCreate();
    await fillCompany();
    const save = screen.getByRole('button', { name: 'Registrar empresa' });
    await waitFor(() => expect(save).toBeDisabled()); // sin precio no se puede registrar

    // La moneda sale del catálogo (lista propia); el precio y el descuento se escriben en ella.
    await pick(/Moneda/, /USD · Dólar estadounidense/);
    expect(screen.getByText(/Cargos, pagos, saldo y pronóstico van en esta moneda/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Monto fijo' }));
    expect(screen.getByLabelText('Precio de la empresa')).toHaveAccessibleDescription('Sin IVA, por mes');
    expect(within(previewBox()).queryByText(/Calculado para/)).toBeNull(); // monto fijo: no depende de empleados
    await userEvent.type(screen.getByLabelText('Precio de la empresa'), '5000');
    await pick(/El precio es/, /Por año/);
    expect(screen.getByLabelText('Precio de la empresa')).toHaveAccessibleDescription('Sin IVA, por año');
    await retype('Un cargo cada', '3');
    expect(screen.getByLabelText('Un cargo cada')).toHaveAttribute('aria-valuetext', '3 meses');
    await retype('Días de demo sin cobro', '15');
    await retype('IVA', '0');
    await retype('Días de gracia', '5');
    await retype('Inicio del cobro', '01112026');

    await userEvent.click(screen.getByRole('switch', { name: 'Descuento' }));
    await userEvent.click(within(screen.getByRole('radiogroup', { name: 'Tipo de descuento' })).getByRole('radio', { name: 'Monto fijo' }));
    await userEvent.type(screen.getByLabelText('Monto del descuento por cargo'), '500');
    await pick(/Se aplica/, /Solo en los primeros cargos/);
    await userEvent.type(screen.getByLabelText('En los primeros'), '1');
    expect(screen.getByLabelText('En los primeros')).toHaveAttribute('aria-valuetext', '1 cargo');
    await retype('En los primeros', '2');
    await pick(/Se aplica/, /Cada cierto número de cargos/);
    expect(screen.getByLabelText('Cada')).toHaveValue('2'); // "cada N cargos" usa el mismo número
    await pick(/Se aplica/, /Solo en los primeros cargos/);

    await waitFor(() => expect(save).toBeEnabled());
    // La vista previa se pide con el plan completo; con monto fijo los empleados no cuentan.
    await waitFor(() => expect(previews(calls).at(-1)).toMatchObject({ plan: { pricing_mode: 'FLAT', interval_months: 3, currency: 'USD' }, employees: 0, validators: 0 }));
    await userEvent.click(save);
    const dialog = await screen.findByRole('dialog', { name: '¿Registrar la empresa Panificadora?' });
    expect(rowsOf(dialog, 'Se registrará').slice(-9)).toEqual([
      'Modalidad de cobroMonto fijo',
      'MonedaUSD · Dólar estadounidense',
      'Precio (sin IVA)$5,000.00\u00a0USD por año',
      'CargoCada 3 meses',
      'Inicio del cobro1 nov 2026',
      'Demo sin cobro15 días',
      'Descuento$500.00\u00a0USD en los primeros 2 cargos',
      'IVA0 %',
      'Días de gracia5 días',
    ]);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar empresa' }));
    expect(await screen.findByText('Detalle de empresa')).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: 'Empresa registrada' })).toHaveTextContent('Su cobro inicia el');
    expect(JSON.parse(posts(calls)[0].init.body as string).billing).toEqual({
      pricing_mode: 'FLAT',
      unit_price: '5000.00',
      price_period: 'YEAR',
      interval_months: 3,
      starts_on: '2026-11-01',
      trial_days: 15,
      discount: { type: 'AMOUNT', value: '500.00', recurrence: 'FIRST', periods: 2 },
      tax_rate: '0.00',
      grace_days: 5,
      currency: 'USD',
    });
  });

  it('vista previa: la calcula el servidor tras una pausa, con el límite de empleados (sin campo aparte), y nunca bloquea el alta', async () => {
    const { calls } = server();
    renderCreate();
    expect(within(previewBox()).getByText('Completa el plan para ver el cobro')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Precio por empleado activo'), '120');
    expect(previewBox().querySelector('[aria-label="Cargando"]')).not.toBeNull();
    const box = previewBox();
    expect(await within(box).findByText('Primer cargo')).toBeInTheDocument();
    expect(box).toHaveTextContent('Cargo 1');
    expect(box).toHaveTextContent('4 oct 2026 – 31 oct 2026 · corte 31 oct 2026');
    expect(box).toHaveTextContent('28 días cobrables · 280 días-persona');
    expect(box).toHaveTextContent('Montos en MXN · Peso mexicano');
    expect(within(box).getByLabelText('Totales: Cada periodo después').textContent).toBe('Subtotal$1,200.00\u00a0MXNDescuento−$120.00\u00a0MXNIVA$172.80\u00a0MXNTotal$1,252.80\u00a0MXN');
    expect(within(box).getByLabelText('Totales: Primer cargo')).not.toHaveTextContent('Descuento'); // sin descuento, no se muestra
    expect(box).toHaveTextContent('Equivalente mensual $1,252.80 MXN con IVA');
    // Sin límite de empleados: el costo de uno, y la vista previa dice cómo ver el total.
    expect(previews(calls)).toEqual([{ plan: expect.objectContaining({ unit_price: '120.00', pricing_mode: 'PER_USER' }) as object, employees: 1, validators: 0 }]);
    expect(box).toHaveTextContent('Calculado para 1 empleado: escribe el límite de empleados para ver el total');
    expect(within(box).queryByRole('textbox')).toBeNull(); // ningún campo de empleados duplicado

    await retype('Límite de empleados', '25');
    await waitFor(() => expect(previews(calls).at(-1)?.employees).toBe(25));
    expect(box).toHaveTextContent('Calculado con los límites de la empresa: 25 empleados');
    expect(box).not.toHaveTextContent('Cada validador activo se cobra como un empleado.');
    // Con lugares para validadores: se suman a la vista previa (cada uno se cobra como un empleado).
    await retype('Límite de validadores', '2');
    await waitFor(() => expect(previews(calls).at(-1)).toMatchObject({ employees: 25, validators: 2 }));
    expect(box).toHaveTextContent('Calculado con los límites de la empresa: 25 empleados y 2 validadores · Cada validador activo se cobra como un empleado.');
    await retype('Límite de empleados', '');
    await waitFor(() => expect(previews(calls).at(-1)).toMatchObject({ employees: 1, validators: 2 }));
    expect(box).toHaveTextContent('Calculado para 1 empleado y 2 validadores: escribe el límite');
  });

  it('el primer periodo en demo no emite cargo; un plan que el servidor rechaza (422) se explica sin popup', async () => {
    let reply = () => apiOk({ ...preview, first: null, trial_ends_on: '2026-10-18' });
    server({ previewReply: () => reply() });
    renderCreate();
    await userEvent.type(screen.getByLabelText('Precio por empleado activo'), '120');
    expect(await within(previewBox()).findByText('Todo el primer periodo es demo: ese cargo no se emite.')).toBeInTheDocument();
    expect(previewBox()).toHaveTextContent('Demo sin cobro hasta el 18 oct 2026');

    reply = () => apiFail(422, 'VALIDATION_ERROR', 'El descuento no puede ser mayor que el subtotal');
    await retype('Precio por empleado activo', '100');
    expect(await within(previewBox()).findByText('No se pudo calcular este plan')).toBeInTheDocument();
    expect(previewBox()).toHaveTextContent('El descuento no puede ser mayor que el subtotal');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('una falla real de la vista previa se avisa en popup y "Calcular de nuevo" la vuelve a pedir', async () => {
    let failures = 1;
    const { calls } = server({ previewReply: () => (failures-- > 0 ? apiFail(503, 'SERVICE_UNAVAILABLE', 'Servicio ocupado') : apiOk(preview)) });
    renderCreate();
    await userEvent.type(screen.getByLabelText('Precio por empleado activo'), '120');
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo calcular la vista previa del cobro' }, { timeout: 8000 });
    await userEvent.click(within(popup).getAllByRole('button', { name: 'Cerrar' })[0]);
    await userEvent.click(within(previewBox()).getByRole('button', { name: 'Calcular de nuevo' }));
    expect(await within(previewBox()).findByText('Primer cargo')).toBeInTheDocument();
    expect(previews(calls).length).toBeGreaterThan(1);
  });

  it('un rechazo del plan al registrar (422 billing.*) queda en su campo; un envío forzado incompleto marca el precio', async () => {
    const error = { code: 'VALIDATION_ERROR', message: 'El precio excede el máximo', field: 'billing.unit_price', details: null };
    server({ create: () => jsonResponse(envelope(null, { status: 422, code: 'VALIDATION_ERROR', message: 'Datos inválidos', errors: [error] }), 422) });
    renderCreate();
    await fillCompany();
    fireEvent.submit(screen.getByRole('button', { name: 'Registrar empresa' }).closest('form') as HTMLFormElement);
    expect(screen.getByLabelText('Precio por empleado activo')).toHaveAccessibleDescription('Escribe el precio');

    await userEvent.type(screen.getByLabelText('Precio por empleado activo'), '120');
    const save = screen.getByRole('button', { name: 'Registrar empresa' });
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Registrar la empresa Panificadora?' })).getByRole('button', { name: 'Registrar empresa' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo registrar la empresa' })).toHaveTextContent('Datos inválidos');
    expect(screen.getByLabelText('Precio por empleado activo')).toHaveAccessibleDescription('El precio excede el máximo');
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    await userEvent.type(screen.getByLabelText('Precio por empleado activo'), '5'); // cambiarlo descarta el error del servidor
    expect(screen.getByLabelText('Precio por empleado activo')).toHaveAccessibleDescription('Sin IVA, por mes por cada empleado activo');
  });
});

describe('CompanyCreatePage: identificador fiscal opcional (empresas de cualquier país)', () => {
  it('sin asterisco y con su ayuda; vacío no se consulta, la confirmación no lo lista y viaja como null', async () => {
    const { calls } = server({ create: () => apiOk({ ...company, tax_country: null, tax_id_type: null, tax_id: null }, { status: 201 }) });
    renderCreate();
    const taxId = screen.getByLabelText('Identificador fiscal');
    expect(taxId).not.toBeRequired();
    expect(screen.getByText('Identificador fiscal').closest('label')).not.toHaveClass('is-required');
    expect(screen.getByText('País fiscal').closest('label')).not.toHaveClass('is-required');
    expect(screen.getByText('Nombre comercial').closest('label')).toHaveClass('is-required');
    expect(taxId).toHaveAccessibleDescription('Opcional · 12 caracteres (persona moral) o 13 (persona física) · p. ej. PNO120315AB1');
    await fillCompany({ taxId: '' });
    await userEvent.type(screen.getByLabelText('Precio por empleado activo'), '120');
    const save = screen.getByRole('button', { name: 'Registrar empresa' });
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);
    const dialog = await screen.findByRole('dialog', { name: '¿Registrar la empresa Panificadora?' });
    expect(rowsOf(dialog, 'Se registrará').join(' | ')).not.toContain('Identificador fiscal');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar empresa' }));
    expect(await screen.findByRole('dialog', { name: 'Empresa registrada' })).toBeInTheDocument();
    expect(JSON.parse(posts(calls)[0].init.body as string)).toMatchObject({ name: 'Panificadora', tax_id: null });
    expect(calls.some((c) => c.url.includes('field=company_tax_id'))).toBe(false);
  });
});
