import { fireEvent, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FeedbackProvider } from '../../context/FeedbackContext';
import { setLocale } from '../../i18n/core';
import { usePlanPreview } from '../../hooks/usePlanPreview';
import { billingService } from '../../services/billingService';
import { account, noPlanAccount, preview } from '../../test/billing';
import { company, pick, renderPage, retype, rowsOf, settle } from '../../test/companyPages';
import { apiFail, apiOk, envelope, jsonResponse, liveCheck, mockFetch, type MockCall } from '../../test/http';
import type { BillingAccount, BillingPlanInput, CompanyDetail, PlanPreview } from '../../types';
import { CompanyEditPage } from './CompanyEditPage';

interface ServerOptions {
  current?: BillingAccount;
  /** Respuesta de la cuenta de cobranza (por omisión, `current`). */
  accountReply?: () => Response;
  savePlan?: () => Response;
  /** La empresa que se edita y la respuesta al guardarla. */
  detail?: CompanyDetail;
  update?: () => Response;
}

function server({ current = account, accountReply = () => apiOk(current), savePlan = () => apiOk(current), detail = company, update = () => apiOk(detail) }: ServerOptions = {}) {
  return mockFetch((call) => {
    if (call.url.includes('/validation')) return liveCheck();
    if (call.url.endsWith('/billing/preview')) return apiOk(preview);
    if (call.url.endsWith('/billing/companies/4/plan')) return savePlan();
    if (call.url.endsWith('/billing/companies/4')) return accountReply();
    return call.init.method === 'PUT' ? update() : apiOk(detail);
  });
}
const sent = (calls: MockCall[], method: string) => calls.filter((c) => c.init.method === method);
const renderEdit = () => renderPage('/admin/companies/:id/edit', '/admin/companies/4/edit', <CompanyEditPage />, { targets: { '/admin/companies/:id': 'Detalle de empresa' } });
const saveButton = () => screen.getByRole('button', { name: 'Guardar cambios' });
async function confirmSave() {
  await waitFor(() => expect(saveButton()).toBeEnabled());
  await userEvent.click(saveButton());
  return screen.findByRole('dialog', { name: '¿Guardar los cambios de Panificadora?' });
}

describe('CompanyEditPage: plan y cobro', () => {
  it('carga el plan guardado; un cambio se confirma "antes → después" (aplica desde el próximo cargo) y solo se envía el plan', async () => {
    const { calls } = server();
    renderEdit();
    expect(await screen.findByLabelText('Precio por empleado activo')).toHaveValue('120');
    expect(screen.getByLabelText('Días de gracia')).toHaveValue('10');
    // Con cargos o pagos, la moneda queda fija y la ayuda explica por qué.
    expect(screen.getByRole('button', { name: /Moneda/ })).toBeDisabled();
    expect(screen.getByText(/No se puede cambiar: la empresa ya tiene cargos o pagos/)).toHaveClass('field__hint');
    await waitFor(() => expect(saveButton()).toHaveAttribute('title', 'No hay cambios por guardar'));
    // La vista previa usa los empleados que ya tiene la empresa (no un campo aparte).
    expect(screen.getByRole('complementary', { name: 'Vista previa del cobro' })).toHaveTextContent('Calculado con los activos actuales: 3 empleados');

    await retype('Precio por empleado activo', '150');
    await retype('Días de gracia', '15');
    const dialog = await confirmSave();
    expect(rowsOf(dialog, 'Cambios')).toEqual(['Precio (sin IVA)Antes: $120.00\u00a0MXN por mesDespués: $150.00\u00a0MXN por mes', 'Días de graciaAntes: 10 díasDespués: 15 días']);
    expect(dialog).toHaveTextContent('Los cambios del plan aplican desde el próximo cargo: los cargos ya emitidos no cambian.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('Detalle de empresa')).toBeInTheDocument();
    const puts = sent(calls, 'PUT');
    expect(puts.map((c) => c.url)).toEqual(['/api/admin/billing/companies/4/plan']); // los datos de la empresa no cambiaron
    expect(JSON.parse(puts[0].init.body as string)).toMatchObject({ unit_price: '150.00', grace_days: 15, starts_on: '2026-09-01' });
  });

  it('el límite de validadores no baja de los activos; el cambio se confirma, se envía y la vista previa los cuenta', async () => {
    const withValidators = { ...company, max_validators: 3, active_validators: 2 };
    const { calls } = server({ detail: withValidators });
    renderEdit();
    const field = await screen.findByLabelText('Límite de validadores');
    expect(field).toHaveValue('3');
    expect(field).toHaveAccessibleDescription('Tiene 2 validadores activos: el límite no puede ser menor. Cada uno se cobra como un empleado.');
    const box = screen.getByRole('complementary', { name: 'Vista previa del cobro' });
    expect(box).toHaveTextContent('Calculado con los activos actuales: 3 empleados y 2 validadores · Cada validador activo se cobra como un empleado.');
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/billing/preview') && (JSON.parse(c.init.body as string) as { validators: number }).validators === 2)).toBe(true));
    await retype('Límite de validadores', '1');
    expect(field).toHaveAccessibleDescription('Escribe un número de 2 a 1,000');
    expect(saveButton()).toBeDisabled();
    await retype('Límite de validadores', '5');
    const dialog = await confirmSave();
    expect(rowsOf(dialog, 'Cambios')).toEqual(['Límite de validadoresAntes: 3 validadores activosDespués: 5 validadores activos']);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('Detalle de empresa')).toBeInTheDocument();
    expect(JSON.parse(sent(calls, 'PUT')[0].init.body as string)).toEqual({ max_validators: 5 });
  });

  it('si mientras tanto la empresa activó más validadores, el servidor lo rechaza en el campo y explica qué hacer', async () => {
    const message = 'La empresa tiene 3 validadores activos y el límite no puede ser menor. Pídele que desactive los que sobran primero.';
    const errors = [{ code: 'VALIDATOR_LIMIT_BELOW_ACTIVE', message, field: 'max_validators', details: { active: 3 } }];
    const refuse = () => jsonResponse(envelope(null, { status: 409, code: 'VALIDATOR_LIMIT_BELOW_ACTIVE', message, errors }), 409);
    server({ detail: { ...company, max_validators: 3, active_validators: 2 }, update: refuse });
    renderEdit();
    await screen.findByLabelText('Límite de validadores');
    await retype('Límite de validadores', '2');
    await userEvent.click(within(await confirmSave()).getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo guardar' })).toHaveTextContent(message);
    expect(screen.getByLabelText('Límite de validadores')).toHaveAccessibleDescription(message);
  });

  it('cambiar la empresa y el plan guarda ambos (primero la empresa); sin cambios del plan no hay nota', async () => {
    const { calls } = server();
    renderEdit();
    await screen.findByLabelText('Límite de empleados');
    await retype('Límite de empleados', '80');
    let dialog = await confirmSave();
    expect(dialog).not.toHaveTextContent('aplican desde el próximo cargo');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await retype('IVA', '8');
    dialog = await confirmSave();
    expect(rowsOf(dialog, 'Cambios')).toEqual(['Límite de empleadosAntes: 50 empleadosDespués: 80 empleados', 'IVAAntes: 16 %Después: 8 %']);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('Detalle de empresa')).toBeInTheDocument();
    expect(sent(calls, 'PUT').map((c) => c.url)).toEqual(['/api/admin/companies/4', '/api/admin/billing/companies/4/plan']);
  });

  it('sin plan: "Cobrar a esta empresa" muestra el plan; con precio se crea al guardar ("Sin plan → ...")', async () => {
    const { calls } = server({ current: noPlanAccount });
    renderEdit();
    const charge = await screen.findByRole('switch', { name: 'Cobrar a esta empresa' });
    expect(screen.queryByLabelText('Precio por empleado activo')).toBeNull();
    await userEvent.click(charge);
    await userEvent.type(screen.getByLabelText('Precio por empleado activo'), '99.5');
    const dialog = await confirmSave();
    expect(rowsOf(dialog, 'Cambios')[0]).toBe('Modalidad de cobroAntes: Sin planDespués: Por empleado activo');
    expect(rowsOf(dialog, 'Cambios')[1]).toBe('MonedaAntes: Sin capturarDespués: MXN · Peso mexicano');
    expect(rowsOf(dialog, 'Cambios')[2]).toBe('Precio (sin IVA)Antes: Sin capturarDespués: $99.50\u00a0MXN por mes');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('Detalle de empresa')).toBeInTheDocument();
    expect(JSON.parse(sent(calls, 'PUT')[0].init.body as string)).toMatchObject({ unit_price: '99.50', pricing_mode: 'PER_USER' });
  });

  it('sin plan pero con un pago en dólares: el plan nuevo empieza (fijo) en USD', async () => {
    const { calls } = server({ current: { ...noPlanAccount, currency: 'USD', currency_locked: true } });
    renderEdit();
    await userEvent.click(await screen.findByRole('switch', { name: 'Cobrar a esta empresa' }));
    expect(screen.getByRole('button', { name: /Moneda/ })).toHaveTextContent('USD · Dólar estadounidense');
    expect(screen.getByRole('button', { name: /Moneda/ })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Precio por empleado activo'), '9');
    expect(screen.getByText('USD', { selector: '.number-field__unit' })).toBeInTheDocument();
    await userEvent.click(within(await confirmSave()).getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('Detalle de empresa')).toBeInTheDocument();
    expect(JSON.parse(sent(calls, 'PUT')[0].init.body as string)).toMatchObject({ unit_price: '9.00', currency: 'USD' });
  });

  it('sin movimientos la moneda se cambia ("antes → después"); si el servidor la encuentra fija (422), lo dice en su campo', async () => {
    const error = { code: 'CURRENCY_LOCKED', message: 'La moneda ya no se puede cambiar: la empresa tiene cargos o pagos en MXN', field: 'currency', details: null };
    server({ current: { ...account, currency_locked: false }, savePlan: () => jsonResponse(envelope(null, { status: 422, code: 'CURRENCY_LOCKED', message: error.message, errors: [error] }), 422) });
    renderEdit();
    await screen.findByLabelText('Precio por empleado activo');
    expect(screen.getByRole('button', { name: /Moneda/ })).toBeEnabled();
    await pick(/Moneda/, /EUR · Euro/);
    const dialog = await confirmSave();
    expect(rowsOf(dialog, 'Cambios')).toEqual([
      'MonedaAntes: MXN · Peso mexicanoDespués: EUR · Euro',
      'Precio (sin IVA)Antes: $120.00\u00a0MXN por mesDespués: €120.00\u00a0EUR por mes',
    ]);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByRole('alertdialog', { name: 'No se pudo guardar' });
    expect(screen.getByText(error.message, { selector: '.field__error' })).toBeInTheDocument();
  });

  it('si la cobranza no carga, la empresa se edita igual y el plan se puede volver a cargar', async () => {
    let attempts = 0;
    server({ accountReply: () => (attempts++ === 0 ? apiFail(500, 'INTERNAL_ERROR', 'Falló') : apiOk(account)) });
    renderEdit();
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo cargar el plan de cobro' });
    await userEvent.click(within(popup).getAllByRole('button', { name: 'Cerrar' })[0]);
    expect(screen.getByLabelText('Nombre comercial')).toHaveValue('Panificadora');
    await userEvent.click(screen.getByRole('button', { name: 'Cargar el plan de cobro' }));
    expect(await screen.findByLabelText('Precio por empleado activo')).toHaveValue('120');
  });

  it('un rechazo del plan (422) queda en su campo; un plan incompleto no deja guardar y un envío forzado lo marca', async () => {
    const error = { code: 'VALIDATION_ERROR', message: 'Máximo 90 días', field: 'grace_days', details: null };
    server({ savePlan: () => jsonResponse(envelope(null, { status: 422, code: 'VALIDATION_ERROR', message: 'Datos inválidos', errors: [error] }), 422) });
    renderEdit();
    await screen.findByLabelText('Días de gracia');
    await retype('Días de gracia', '20');
    await userEvent.click(within(await confirmSave()).getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo guardar' })).toBeInTheDocument();
    expect(screen.getByLabelText('Días de gracia')).toHaveAccessibleDescription('Máximo 90 días');
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));

    await retype('Precio por empleado activo', '');
    expect(saveButton()).toHaveAttribute('title', 'Completa correctamente todos los campos obligatorios');
    fireEvent.submit(saveButton().closest('form') as HTMLFormElement);
    expect(screen.getByLabelText('Precio por empleado activo')).toHaveAccessibleDescription('Escribe el precio');
  });
});

describe('CompanyEditPage: identificador fiscal opcional (empresas de cualquier país)', () => {
  /** Sin número, el país y el tipo viajan igual (el backend los ignora): el identificador se borra completo. */
  const cleared = { tax_country: 'MX', tax_id_type: 'MX_RFC', tax_id: null };

  it('borrarlo se confirma "antes → Sin capturar" y se envía null', async () => {
    const { calls } = server();
    renderEdit();
    await userEvent.clear(await screen.findByLabelText('Identificador fiscal'));
    const dialog = await confirmSave();
    expect(rowsOf(dialog, 'Cambios')).toEqual(['Identificador fiscalAntes: RFC · PNO120315AB1 · MéxicoDespués: Sin capturar']);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('Detalle de empresa')).toBeInTheDocument();
    expect(sent(calls, 'PUT').map((c) => JSON.parse(c.init.body as string) as unknown)).toEqual([cleared]);
  });

  it('en inglés: sin asterisco, con su ayuda, y borrarlo se confirma como "Not provided"', async () => {
    await setLocale('en-US');
    const { calls } = server();
    renderEdit();
    const taxId = await screen.findByLabelText('Tax ID');
    expect(taxId).not.toBeRequired();
    // El formato y el ejemplo son del catálogo del backend (los de prueba vienen en español).
    expect(taxId).toHaveAccessibleDescription('Optional · 12 caracteres (persona moral) o 13 (persona física) · e.g., PNO120315AB1');
    await userEvent.clear(taxId);
    const save = screen.getByRole('button', { name: 'Save changes' });
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);
    const dialog = await screen.findByRole('dialog', { name: 'Save the changes to Panificadora?' });
    expect(rowsOf(dialog, 'Changes')).toEqual(['Tax IDBefore: RFC · PNO120315AB1 · MéxicoAfter: Not provided']);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Detalle de empresa')).toBeInTheDocument();
    expect(sent(calls, 'PUT').map((c) => JSON.parse(c.init.body as string) as unknown)).toEqual([cleared]);
  });
});

describe('usePlanPreview (vista previa del backend)', () => {
  const wrapper = ({ children }: { children: ReactNode }) => <FeedbackProvider>{children}</FeedbackProvider>;
  const plan = { pricing_mode: 'PER_USER', unit_price: '120.00' } as BillingPlanInput;

  it('sin plan no pide nada; una respuesta que llega tarde (de un plan anterior) no pisa la nueva', async () => {
    const pending: Array<{ resolve: (value: PlanPreview) => void; signal?: AbortSignal }> = [];
    vi.spyOn(billingService, 'preview').mockImplementation((_plan, _headcount, signal) => new Promise((resolve) => pending.push({ resolve, signal })));
    const { result, rerender } = renderHook(({ input, employees }) => usePlanPreview(input, { employees, validators: 0 }), {
      wrapper,
      initialProps: { input: null as BillingPlanInput | null, employees: 1 },
    });
    expect(result.current.state).toEqual({ status: 'idle' });

    rerender({ input: plan, employees: 1 });
    expect(result.current.state).toEqual({ status: 'loading', preview: null });
    await waitFor(() => expect(pending).toHaveLength(1));
    rerender({ input: plan, employees: 2 }); // otro plan: la petición anterior se cancela
    expect(pending[0].signal?.aborted).toBe(true);
    await waitFor(() => expect(pending).toHaveLength(2));
    await settle(() => pending[0].resolve({ ...preview, monthly_equivalent: '1.00' }));
    expect(result.current.state.status).toBe('loading');
    await settle(() => pending[1].resolve(preview));
    expect(result.current.state).toEqual({ status: 'ready', preview });

    rerender({ input: plan, employees: 3 }); // mientras recalcula conserva la vista anterior
    expect(result.current.state).toEqual({ status: 'loading', preview });
    rerender({ input: null, employees: 3 });
    expect(result.current.state).toEqual({ status: 'idle' });
  });

  it('una falla de una petición ya cancelada no se avisa', async () => {
    let reject: (error: unknown) => void = () => undefined;
    vi.spyOn(billingService, 'preview').mockImplementation(() => new Promise((_resolve, fail) => (reject = fail)));
    const { result, rerender } = renderHook<ReturnType<typeof usePlanPreview>, { input: BillingPlanInput | null }>(({ input }) => usePlanPreview(input, { employees: 1, validators: 0 }), { wrapper, initialProps: { input: plan } });
    await waitFor(() => expect(billingService.preview).toHaveBeenCalledTimes(1));
    rerender({ input: null });
    await settle(() => reject(new Error('cancelada')));
    expect(result.current.state).toEqual({ status: 'idle' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
