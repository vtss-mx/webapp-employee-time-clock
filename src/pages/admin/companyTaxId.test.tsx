import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n/core';
import { billingReply } from '../../test/billing';
import { catalogsWith } from '../../test/catalogs';
import { company, pick, renderPage, retype, rowsOf } from '../../test/companyPages';
import { apiOk, envelope, jsonResponse, liveCheck, mockFetch, type MockCall } from '../../test/http';
import type { CompanyDetail } from '../../types';
import { formatDate } from '../../utils/format';
import { CompanyCreatePage } from './CompanyCreatePage';
import { CompanyDetailPage } from './CompanyDetailPage';
import { CompanyEditPage } from './CompanyEditPage';

/**
 * Identificador fiscal de una empresa de cualquier país (decisión del dueño del producto, 2026-10-06): país fiscal con
 * búsqueda, tipo según el país (del catálogo del backend) y número con su formato y su ejemplo; opcional, validado en
 * vivo con «país:tipo», confirmado con «antes → después» y mostrado como «EIN · 123456789 · Estados Unidos».
 */

const EIN = { tax_country: 'US', tax_id_type: 'US_EIN', tax_id: '123456789' };
const NONE = { tax_country: null, tax_id_type: null, tax_id: null };

interface ServerOptions {
  detail?: CompanyDetail;
  /** Respuesta de la validación en vivo del identificador. */
  live?: (call: MockCall) => Response;
  /** Respuesta del alta o de la edición. */
  save?: () => Response;
}

function server({ detail = company, live = () => liveCheck(), save }: ServerOptions = {}) {
  return mockFetch((call) => {
    if (call.url.includes('field=company_tax_id')) return live(call);
    if (call.url.includes('/validation')) return liveCheck();
    const billing = billingReply(call);
    if (billing) return billing;
    if (call.init.method === 'POST' || call.init.method === 'PUT') return save ? save() : apiOk({ ...detail, ...EIN }, { status: 201 });
    return apiOk(detail);
  });
}
const sentBody = (calls: MockCall[], method: string) => JSON.parse(calls.find((c) => c.init.method === method && c.url.endsWith('/companies') === (method === 'POST'))?.init.body as string) as Record<string, unknown>;
const taxCalls = (calls: MockCall[]) => calls.filter((c) => c.url.includes('field=company_tax_id')).map((c) => new URL(c.url, 'http://x').searchParams);
const renderCreate = () => renderPage('/admin/companies/new', '/admin/companies/new', <CompanyCreatePage />, { targets: { '/admin/companies/:id': 'Detalle de empresa' } });
const renderEdit = () => renderPage('/admin/companies/:id/edit', '/admin/companies/4/edit', <CompanyEditPage />, { targets: { '/admin/companies/:id': 'Detalle de empresa' } });
const country = () => screen.getByRole('button', { name: 'País fiscal' });
const idType = () => screen.getByRole('button', { name: 'Tipo de identificador' });

async function fillTheRest() {
  await userEvent.type(screen.getByLabelText('Nombre comercial'), 'Northwind');
  await userEvent.type(screen.getByLabelText('Razón social'), 'Northwind Traders LLC');
  await userEvent.type(screen.getByLabelText('Teléfono'), '6621234567');
  await userEvent.type(screen.getByLabelText('Correo del administrador'), 'admin@northwind.com');
  await userEvent.type(screen.getByLabelText('Contraseña inicial'), 'Empresa1234');
  await userEvent.type(screen.getByLabelText(/Confirmar contraseña/), 'Empresa1234');
  await userEvent.type(screen.getByLabelText('Precio por empleado activo'), '120');
}

describe('alta: identificador fiscal de cualquier país', () => {
  it('propone México y su RFC; otro país propone su tipo, el número se normaliza y se valida en vivo con «país:tipo»', async () => {
    const { calls } = server();
    renderCreate();
    expect(country()).toHaveTextContent('México');
    expect(country()).toHaveAccessibleDescription('Donde la empresa está registrada ante el fisco');
    expect(idType()).toHaveTextContent('RFC');
    expect(idType()).toHaveAccessibleDescription('Registro Federal de Contribuyentes');
    await pick(/País fiscal/, /Estados Unidos/);
    expect(idType()).toHaveTextContent('EIN');
    const number = screen.getByLabelText('Identificador fiscal');
    expect(number).toHaveAttribute('placeholder', '123456789');
    expect(number).toHaveAccessibleDescription('Opcional · 9 dígitos · p. ej. 123456789');
    await userEvent.type(number, '12-3456789-99');
    expect(number).toHaveValue('123456789'); // sin separadores y hasta el largo de su tipo
    await waitFor(() => expect(taxCalls(calls).at(-1)?.get('related')).toBe('US:US_EIN'));
    await fillTheRest();
    const save = screen.getByRole('button', { name: 'Registrar empresa' });
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);
    const dialog = await screen.findByRole('dialog', { name: '¿Registrar la empresa Northwind?' });
    expect(rowsOf(dialog, 'Se registrará')).toContain('Identificador fiscalEIN · 123456789 · Estados Unidos');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar empresa' }));
    expect(await screen.findByText('Detalle de empresa')).toBeInTheDocument();
    expect(sentBody(calls, 'POST')).toMatchObject(EIN);
  });

  it('los tipos dependen del país; un formato que no cumple se marca al salir y uno que el servidor rechaza bloquea', async () => {
    server({ live: () => liveCheck('INVALID_FORMAT', 'El dígito verificador de SIRET no coincide. Revisa el número.', 'company_tax_id') });
    renderCreate();
    await pick(/País fiscal/, /Guatemala/);
    expect(idType()).toHaveTextContent('ID fiscal'); // un país sin tipos propios: «Otro identificador fiscal»
    await userEvent.click(idType());
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent)).toEqual(['ID fiscalOtro identificador fiscal']);
    await userEvent.keyboard('{Escape}');
    await pick(/País fiscal/, /Francia/);
    expect(idType()).toHaveTextContent('SIREN');
    await pick(/Tipo de identificador/, /SIRET/);
    const number = screen.getByLabelText('Identificador fiscal');
    expect(number).toHaveAccessibleDescription('Opcional · 14 dígitos: el SIREN y 5 del establecimiento · p. ej. 73282932000074');
    await userEvent.type(number, '1234');
    fireEvent.blur(number);
    expect(number).toHaveAccessibleDescription('El número de SIRET debe tener 14 caracteres');
    await retype('Identificador fiscal', '73282932000075');
    expect(await screen.findByText('El dígito verificador de SIRET no coincide. Revisa el número.')).toBeInTheDocument();
    await fillTheRest();
    expect(screen.getByRole('button', { name: 'Registrar empresa' })).toBeDisabled();
  });

  it('un rechazo del servidor en el país o en el tipo queda en su campo', async () => {
    const errors = [
      { code: 'VALUE_ERROR', message: 'Elige un país de la lista', field: 'tax_country', details: null },
      { code: 'VALUE_ERROR', message: 'Elige un tipo de identificador de la lista', field: 'tax_id_type', details: null },
    ];
    server({ save: () => jsonResponse(envelope(null, { status: 422, code: 'VALIDATION_ERROR', message: 'Datos inválidos', errors }), 422) });
    renderCreate();
    await userEvent.type(screen.getByLabelText('Identificador fiscal'), 'PNO120315AB1');
    await fillTheRest();
    const save = screen.getByRole('button', { name: 'Registrar empresa' });
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Registrar la empresa Northwind?' })).getByRole('button', { name: 'Registrar empresa' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo registrar la empresa' })).toBeInTheDocument();
    expect(country()).toHaveAccessibleDescription('Elige un país de la lista');
    expect(idType()).toHaveAccessibleDescription('Elige un tipo de identificador de la lista');
  });

  it('con un servidor anterior (sin el catálogo de tipos) el número se captura sin regla del cliente', async () => {
    server();
    renderPage('/admin/companies/new', '/admin/companies/new', <CompanyCreatePage />, { catalogs: catalogsWith({ tax_id_types: [] }) });
    expect(idType()).toHaveTextContent('Selecciona una opción');
    const number = screen.getByLabelText('Identificador fiscal');
    expect(number).toHaveAccessibleDescription('Opcional');
    await userEvent.type(number, 'abc-123');
    expect(number).toHaveValue('ABC123');
  });

  it('en inglés: etiquetas, ayudas y la confirmación', async () => {
    await setLocale('en-US');
    server();
    renderCreate();
    expect(screen.getByRole('button', { name: 'Tax country' })).toHaveAccessibleDescription('Where the company is registered for taxes');
    expect(screen.getByRole('button', { name: 'ID type' })).toHaveTextContent('RFC');
    expect(screen.getByLabelText('Tax ID')).toHaveAccessibleDescription('Optional · 12 caracteres (persona moral) o 13 (persona física) · e.g., PNO120315AB1');
  });
});

describe('edición y ficha: identificador fiscal', () => {
  it('cambiar de país, tipo y número se confirma «antes → después» y viaja completo', async () => {
    const { calls } = server();
    renderEdit();
    expect(await screen.findByLabelText('Identificador fiscal')).toHaveValue('PNO120315AB1');
    await pick(/País fiscal/, /Estados Unidos/);
    await retype('Identificador fiscal', '98-7654321');
    const save = screen.getByRole('button', { name: 'Guardar cambios' });
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);
    const dialog = await screen.findByRole('dialog', { name: '¿Guardar los cambios de Panificadora?' });
    expect(rowsOf(dialog, 'Cambios')).toEqual(['Identificador fiscalAntes: RFC · PNO120315AB1 · MéxicoDespués: EIN · 987654321 · Estados Unidos']);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('Detalle de empresa')).toBeInTheDocument();
    expect(sentBody(calls, 'PUT')).toEqual({ tax_country: 'US', tax_id_type: 'US_EIN', tax_id: '987654321' });
    expect(taxCalls(calls).at(-1)?.get('exclude_id')).toBe('4');
  });

  it('sin número, cambiar el país o el tipo no es un cambio', async () => {
    server({ detail: { ...company, ...NONE } });
    renderEdit();
    expect(await screen.findByLabelText('Identificador fiscal')).toHaveValue('');
    await pick(/País fiscal/, /Canadá/);
    expect(idType()).toHaveTextContent('BN');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar cambios' })).toHaveAttribute('title', 'No hay cambios por guardar'));
  });

  it('la ficha muestra el tipo, el número y el país', async () => {
    server({ detail: { ...company, ...EIN } });
    renderPage('/admin/companies/:id', '/admin/companies/4', <CompanyDetailPage />);
    expect(await screen.findByText(`EIN · 123456789 · Estados Unidos · desde ${formatDate(company.created_at)}`)).toBeInTheDocument();
    expect(screen.getByText('EIN · 123456789 · Estados Unidos', { selector: 'dd' })).toBeInTheDocument();
  });
});
