import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { catalogsFixture, catalogsWith } from '../../test/catalogs';
import { apiFail, apiOk, mockFetch } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import type { ApiKey } from '../../types';
import type { CatalogApi } from '../../utils/catalogs';
import { ApiKeyFormPage } from './ApiKeyFormPage';
import { ApiKeysPage } from './ApiKeysPage';

const key = (over: Partial<ApiKey> = {}): ApiKey => ({
  id: 1,
  name: 'Nómina',
  prefix: 'tck_Ab3dE9fG',
  scopes: ['EMPLOYEES_READ', 'ATTENDANCE_READ'],
  status: 'ACTIVE',
  created_at: '2026-10-01T12:00:00Z',
  created_by: 'admin@empresa.com',
  expires_at: '2027-10-01T12:00:00Z',
  last_used_at: new Date(Date.now() - 5 * 60_000).toISOString(),
  last_used_ip: '189.203.10.4',
  revoked_at: null,
  revoked_by: null,
  ...over,
});
const page = (items: ApiKey[]) => ({ items, total: items.length, page: 1, size: 10 });
const SECRET = 'tck_secretoDeEjemplo0123456789abcdefghijklmn';

function renderList() {
  return renderWithProviders(
    <Routes>
      <Route path="/company/integrations" element={<ApiKeysPage />} />
      <Route path="/company/integrations/new" element={<p>Crear llave</p>} />
    </Routes>,
    { route: '/company/integrations' },
  );
}

function renderForm(catalogs?: CatalogApi) {
  return renderWithProviders(
    <Routes>
      <Route path="/company/integrations/new" element={<ApiKeyFormPage />} />
      <Route path="/company/integrations" element={<p>Integraciones</p>} />
    </Routes>,
    { route: '/company/integrations/new', catalogs },
  );
}

describe('Integraciones (API): llaves de la empresa', () => {
  it('lista las llaves con su estado, permisos, uso y la guía de conexión', async () => {
    mockFetch(apiOk(page([key(), key({ id: 2, name: 'ERP', status: 'REVOKED', scopes: ['VALIDATORS_READ'], last_used_at: null, expires_at: null, revoked_at: '2026-10-02T12:00:00Z', revoked_by: 'rh@empresa.com' })])));
    renderList();
    const nomina = (await screen.findByText('Nómina')).closest('li')!;
    expect(within(nomina).getByText('tck_Ab3dE9fG…')).toBeInTheDocument();
    expect(within(nomina).getByText('Activa')).toBeInTheDocument();
    expect(within(nomina).getByText('Empleados')).toBeInTheDocument();
    expect(within(nomina).getByText('Identificaciones')).toBeInTheDocument();
    expect(within(nomina).getByText(/Último uso hace 5 minutos · IP 189.203.10.4/)).toBeInTheDocument();
    const erp = screen.getByText('ERP').closest('li')!;
    expect(within(erp).getByText('Revocada')).toBeInTheDocument();
    expect(within(erp).getByText(/Aún sin usar/)).toBeInTheDocument();
    expect(within(erp).getByText(/por rh@empresa.com/)).toBeInTheDocument();
    expect(within(erp).queryByRole('button', { name: 'Rotar' })).toBeNull(); // una revocada ya no tiene acciones
    expect(screen.getByText(`${window.location.origin}/api/integrations/v1`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar URL base' })).toBeInTheDocument();
  });

  it('sin llaves: estado vacío que invita a crear la primera', async () => {
    mockFetch(apiOk(page([])));
    renderList();
    expect(await screen.findByText('No hay llaves de la API')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).toBeNull();
    await userEvent.click(screen.getAllByRole('link', { name: 'Crear llave' })[0]);
    expect(screen.getByText('Crear llave')).toBeInTheDocument();
  });

  it('rotar muestra la llave nueva una sola vez; revocar pide confirmación', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { calls } = mockFetch((call) => {
      if (call.url.endsWith('/rotate')) return apiOk({ ...key({ id: 3 }), secret: SECRET }, { status: 201 });
      if (call.init.method === 'DELETE') return apiOk(key({ status: 'REVOKED' }));
      return apiOk(page([key()]));
    });
    renderList();
    await userEvent.click(await screen.findByRole('button', { name: 'Rotar' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Rotar llave' }));
    const secret = await screen.findByRole('dialog', { name: 'Copia la llave de «Nómina»' });
    expect(within(secret).getByText(SECRET)).toBeInTheDocument();
    expect(within(secret).queryByLabelText('Cerrar')).toBeNull(); // solo se cierra confirmando
    await userEvent.click(within(secret).getByRole('button', { name: 'Copiar llave' }));
    expect(writeText).toHaveBeenCalledWith(SECRET);
    expect(await within(secret).findByText('Copiado')).toBeInTheDocument();
    await userEvent.click(within(secret).getByRole('button', { name: 'Ya la guardé' }));

    await userEvent.click(screen.getByRole('button', { name: 'Revocar' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Revocar llave' }));
    expect(await screen.findByText('Llave revocada')).toBeInTheDocument();
    expect(calls.find((c) => c.init.method === 'DELETE')?.url).toBe('/api/api-keys/1');
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('cancelar la confirmación no cambia la llave; uso sin IP registrada', async () => {
    const { calls } = mockFetch(apiOk(page([key({ last_used_ip: null })])));
    renderList();
    expect(await screen.findByText('Último uso hace 5 minutos')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Revocar' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Revocar «Nómina»' });
    expect(dialog).toHaveTextContent('No se puede deshacer');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(calls).toHaveLength(1); // solo la carga de la lista
  });

  it('tras revocar vuelve a pedir la lista; mientras llega se atenúa', async () => {
    let release: (response: Response) => void = () => undefined;
    let lists = 0;
    mockFetch((call) => {
      if (call.init.method === 'DELETE') return apiOk(key({ status: 'REVOKED' }));
      lists += 1;
      return lists === 1 ? apiOk(page([key()])) : new Promise<Response>((done) => (release = done));
    });
    renderList();
    await userEvent.click(await screen.findByRole('button', { name: 'Revocar' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Revocar llave' }));
    expect(await screen.findByText('Llave revocada')).toBeInTheDocument();
    expect(screen.getByText('Nómina').closest('ul')).toHaveClass('is-loading');
    release(apiOk(page([key({ status: 'REVOKED', revoked_at: '2026-10-02T12:00:00Z' })])));
    await waitFor(() => expect(screen.getByText('Nómina').closest('ul')).not.toHaveClass('is-loading'));
    expect(screen.queryByRole('button', { name: 'Revocar' })).toBeNull();
  });

  it('si rotar falla lo explica', async () => {
    mockFetch((call) => (call.url.endsWith('/rotate') ? apiFail(409, 'API_KEY_REVOKED', 'Una llave revocada no se puede rotar') : apiOk(page([key()]))));
    renderList();
    await userEvent.click(await screen.findByRole('button', { name: 'Rotar' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Rotar llave' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo rotar la llave' })).toBeInTheDocument();
  });
});

describe('Crear llave (pantalla)', () => {
  it('exige nombre y al menos un permiso; envía permisos y vigencia y muestra el secreto', async () => {
    const { calls } = mockFetch(apiOk({ ...key({ name: 'Nómina' }), secret: SECRET }, { status: 201 }));
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Crear llave' }));
    expect(screen.getByText('Escribe para qué sistema es la llave')).toBeInTheDocument();
    expect(screen.getByText('Elige al menos un permiso.')).toBeInTheDocument();
    expect(calls).toHaveLength(0);

    await userEvent.type(screen.getByLabelText(/Nombre/), ' Nómina ');
    await userEvent.click(screen.getByRole('switch', { name: 'Empleados' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Identificaciones' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Identificaciones' })); // al final, sin este
    await userEvent.click(screen.getByLabelText('Vence en'));
    await userEvent.click(screen.getByRole('option', { name: /Sin vencimiento/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Crear llave' }));

    expect(await screen.findByText('Integraciones')).toBeInTheDocument();
    expect(await screen.findByText(SECRET)).toBeInTheDocument();
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ name: 'Nómina', scopes: ['EMPLOYEES_READ'], expires_in_days: null });
  });

  it('un permiso nuevo del catálogo se ofrece (ícono genérico); otro error al crear se explica', async () => {
    const audit = { code: 'AUDIT_READ', name: 'Auditoría', description: null, sort_order: 4, active: true };
    mockFetch(apiFail(503, 'SERVICE_UNAVAILABLE', 'Servicio no disponible'));
    renderForm(catalogsWith({ api_scopes: [...catalogsFixture.api_scopes, audit as (typeof catalogsFixture.api_scopes)[number]] }));
    await userEvent.type(screen.getByLabelText(/Nombre/), 'Auditor');
    await userEvent.click(screen.getByRole('switch', { name: 'Auditoría' }));
    await userEvent.click(screen.getByRole('button', { name: 'Crear llave' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo crear la llave' })).toHaveTextContent('Servicio no disponible');
  });

  it('al llegar al tope de llaves lo explica', async () => {
    mockFetch(apiFail(409, 'API_KEY_LIMIT', 'Tu empresa ya tiene 10 llaves sin revocar.'));
    renderForm();
    await userEvent.type(screen.getByLabelText(/Nombre/), 'ERP');
    await userEvent.click(screen.getByRole('switch', { name: 'Validadores' }));
    await userEvent.click(screen.getByRole('button', { name: 'Crear llave' }));
    expect(await screen.findByRole('alertdialog', { name: 'Llegaste al tope de llaves' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Crear llave' })).toBeEnabled());
  });
});
