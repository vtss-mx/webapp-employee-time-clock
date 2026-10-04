import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import type { WorkSite } from '../../../types';
import type { GeoPoint } from '../../../utils/address';
import type * as ConfigModule from '../../../utils/config';
import { SiteFormPage } from './SiteFormPage';
import { SitesPage } from './SitesPage';

// Google Maps simulado (el SDK real se valida en el navegador): mapa con un botón para "tocarlo".
vi.mock('../../../utils/config', async (importOriginal) => {
  const actual = await importOriginal<typeof ConfigModule>();
  return { config: { ...actual.config, maps: { apiKey: 'clave-de-prueba', places: false, geocoding: true, geolocation: false } } };
});
const maps = vi.hoisted(() => ({ reverseGeocode: vi.fn(), geocodeAddress: vi.fn(), approximateLocation: vi.fn() }));
vi.mock('../../../services/maps/googleMaps', async (importOriginal) => ({ ...(await importOriginal<object>()), mapsService: maps }));
vi.mock('../../../components/location/MapCanvas', () => ({
  MapCanvas: ({ point, radius, onPick }: { point: GeoPoint | null; radius: number | null; onPick: (p: GeoPoint) => void }) => (
    <div data-testid="map" data-point={point ? `${point.lat},${point.lng}` : ''} data-radius={radius ?? ''}>
      <button type="button" onClick={() => onPick({ lat: 29.1, lng: -110.9 })}>
        Tocar el mapa
      </button>
    </div>
  ),
}));

const FOUND = { street: 'Blvd. Kino', exterior_number: '100', postal_code: '83150', country_code: 'MX', state: 'Sonora', municipality: 'Hermosillo', city: 'Hermosillo' };

const plant: WorkSite = {
  id: 3,
  name: 'Planta Norte',
  radius_m: 100,
  active: true,
  employees: 12,
  created_at: '2026-10-01T00:00:00Z',
  address: { ...FOUND, interior_number: 'B', latitude: 29.1, longitude: -110.9 },
};

const page = (items: WorkSite[]) => ({ items, total: items.length, page: 1, size: 10 });
const map = () => screen.getByTestId('map');
const bodyOf = (call: MockCall | undefined) => JSON.parse(call?.init.body as string) as unknown;
/** Petición que crea, cambia o borra (POST, PUT, PATCH o DELETE). */
const isWrite = (call: MockCall) => call.init.method !== 'GET';
/** Filas de una sección de la confirmación ("Se creará", "Cambios"), como texto. */
const rows = (dialog: HTMLElement, region: string) => within(within(dialog).getByRole('region', { name: region })).getAllByRole('listitem').map((row) => row.textContent);

function renderForm(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/company/sites" element={<p>Lista de sitios</p>} />
      <Route path="/company/sites/new" element={<SiteFormPage />} />
      <Route path="/company/sites/:id/edit" element={<SiteFormPage />} />
    </Routes>,
    { route },
  );
}

beforeEach(() => {
  Object.values(maps).forEach((fn) => fn.mockReset());
  maps.reverseGeocode.mockResolvedValue(FOUND);
});
afterEach(() => vi.unstubAllGlobals());

describe('Sitios: listado', () => {
  it('muestra cada sitio (ciudad, domicilio, radio, empleados y estado), busca, filtra y abre la edición', async () => {
    const office = { ...plant, id: 4, name: 'Oficina centro', radius_m: 1500, active: false, employees: 0, address: { ...plant.address, city: '', municipality: 'Cajeme' } };
    const { calls } = mockFetch(apiOk(page([plant, office])));
    renderWithProviders(
      <Routes>
        <Route path="/company/sites" element={<SitesPage />} />
        <Route path="/company/sites/:id/edit" element={<p>Editar sitio</p>} />
      </Routes>,
      { route: '/company/sites' },
    );
    const row = (await screen.findByText('Planta Norte')).closest('tr') as HTMLElement;
    expect(within(row).getByText('Hermosillo')).toBeInTheDocument();
    expect(within(row).getByText('Blvd. Kino 100 Int. B, 83150 Hermosillo, Sonora')).toBeInTheDocument();
    expect(within(row).getByText('100 m')).toBeInTheDocument();
    expect(within(row).getByText('12')).toBeInTheDocument();
    expect(within(row).getByText('Activo')).toBeInTheDocument();
    const other = screen.getByText('Oficina centro').closest('tr') as HTMLElement;
    expect(within(other).getByText('Cajeme')).toBeInTheDocument();
    expect(within(other).getByText('1.5 km')).toBeInTheDocument();
    expect(within(other).getByText('Inactivo')).toBeInTheDocument();
    expect(screen.getByText(/2 sitios/)).toBeInTheDocument();

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar sitios' }), 'norte');
    await waitFor(() => expect(calls.at(-1)?.url).toContain('search=norte'));
    await userEvent.click(screen.getByRole('button', { name: /Filtrar por estado/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Inactivos' }));
    await waitFor(() => expect(calls.at(-1)?.url).toContain('active=false'));

    await userEvent.click(screen.getByText('Planta Norte'));
    expect(await screen.findByText('Editar sitio')).toBeInTheDocument();
  });

  it('sin sitios invita a crear el primero; con búsqueda dice que nada coincide', async () => {
    mockFetch(apiOk(page([])));
    renderWithProviders(<SitesPage />, { route: '/company/sites' });
    expect(await screen.findByText('Aún no hay sitios de trabajo')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Nuevo sitio' })[1]).toHaveAttribute('href', '/company/sites/new');
    expect(screen.getByText(/0 sitios/)).toBeInTheDocument();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar sitios' }), 'zzz');
    expect(await screen.findByText('Ningún sitio coincide con la búsqueda')).toBeInTheDocument();
  });

  it('un solo sitio se cuenta en singular', async () => {
    mockFetch(apiOk(page([plant])));
    renderWithProviders(<SitesPage />, { route: '/company/sites' });
    expect(await screen.findByText(/1 sitio ·/)).toBeInTheDocument();
  });
});

describe('Sitios: alta', () => {
  it('nombre, radio sugerido (el círculo del mapa lo muestra), punto en el mapa que llena el domicilio y alta', async () => {
    const { calls } = mockFetch(apiOk({ ...plant, radius_m: 200 }, { status: 201 }));
    renderForm('/company/sites/new');
    expect(map()).toHaveAttribute('data-radius', '100'); // radio por omisión
    expect(screen.getByText('Toca el mapa para marcar el punto del sitio')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/Nombre del sitio/), ' Planta Norte ');
    await userEvent.click(screen.getByRole('button', { name: '200 m' }));
    expect(screen.getByRole('button', { name: '200 m' })).toHaveAttribute('aria-pressed', 'true');
    expect(map()).toHaveAttribute('data-radius', '200');
    await userEvent.clear(screen.getByLabelText(/Radio para checar/));
    await userEvent.type(screen.getByLabelText(/Radio para checar/), '5');
    expect(map()).toHaveAttribute('data-radius', ''); // radio inválido: sin círculo
    await userEvent.click(screen.getByRole('button', { name: '200 m' }));

    await userEvent.click(screen.getByRole('button', { name: 'Tocar el mapa' }));
    await waitFor(() => expect(screen.getByLabelText('Calle')).toHaveValue('Blvd. Kino'));
    expect(map()).toHaveAttribute('data-point', '29.1,-110.9');
    await userEvent.click(screen.getByRole('button', { name: 'Crear sitio' }));

    // Antes de enviar se confirma lo que se creará: nombre, domicilio, punto y radio.
    const confirm = await screen.findByRole('dialog', { name: '¿Crear el sitio Planta Norte?' });
    expect(confirm).toHaveTextContent('Tu personal podrá checar aquí y elegirlo en las asignaciones de turno.');
    expect(rows(confirm, 'Se creará')).toEqual(['NombrePlanta Norte', 'DomicilioBlvd. Kino 100, 83150 Hermosillo, Sonora', 'Punto en el mapa29.10000, -110.90000', 'Radio para checar200 m']);
    expect(calls.filter(isWrite)).toHaveLength(0);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Crear sitio' }));

    expect(await screen.findByText('Lista de sitios')).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: 'Sitio creado' })).toHaveTextContent('Planta Norte ya se puede elegir al asignar turnos. Se puede checar en sitio a no más de 200 m del punto marcado.');
    expect(bodyOf(calls.find((c) => c.init.method === 'POST'))).toEqual({
      name: 'Planta Norte',
      radius_m: 200,
      address: { ...FOUND, interior_number: null, latitude: 29.1, longitude: -110.9 },
    });
  });

  it('cancelar la confirmación del alta no envía nada y deja lo capturado', async () => {
    const { calls } = mockFetch(apiOk(plant, { status: 201 }));
    renderForm('/company/sites/new');
    await userEvent.type(screen.getByLabelText(/Nombre del sitio/), 'Planta Norte');
    await userEvent.click(screen.getByRole('button', { name: 'Tocar el mapa' }));
    await waitFor(() => expect(screen.getByLabelText('Calle')).toHaveValue('Blvd. Kino'));
    await userEvent.click(screen.getByRole('button', { name: 'Crear sitio' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Crear el sitio Planta Norte?' })).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog', { name: '¿Crear el sitio Planta Norte?' })).toBeNull();
    expect(calls.filter(isWrite)).toHaveLength(0);
    expect(screen.getByLabelText(/Nombre del sitio/)).toHaveValue('Planta Norte');
    expect(screen.getByLabelText('Calle')).toHaveValue('Blvd. Kino');
    expect(map()).toHaveAttribute('data-point', '29.1,-110.9');
    expect(screen.getByRole('button', { name: 'Crear sitio' })).toBeEnabled(); // no quedó "Guardando…"
    expect(screen.queryByText('Lista de sitios')).toBeNull();
  });

  it('sin punto en el mapa ni datos no se envía: lo explica y marca los campos', async () => {
    const { calls } = mockFetch(apiOk(plant));
    renderForm('/company/sites/new');
    await userEvent.click(screen.getByRole('button', { name: 'Crear sitio' }));
    const popup = await screen.findByRole('alertdialog', { name: 'Revisa la información' });
    expect(popup).toHaveTextContent('Marca en el mapa el punto del sitio');
    expect(popup).toHaveTextContent('Escribe un nombre');
    await userEvent.click(within(popup).getByRole('button', { name: 'Entendido' }));
    expect(screen.getAllByText(/Marca en el mapa el punto del sitio/).length).toBeGreaterThan(0);
    expect(calls).toHaveLength(0);
  });

  it('cancelar regresa al listado', async () => {
    mockFetch(apiOk(plant));
    renderForm('/company/sites/new');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText('Lista de sitios')).toBeInTheDocument();
  });
});

describe('Sitios: edición', () => {
  it('sin cambios no envía; los cambios se confirman; un nombre ya usado se marca en su campo; corregido, guarda y vuelve al listado', async () => {
    let puts = 0;
    const { calls } = mockFetch((call) => {
      if (call.init.method !== 'PUT') return apiOk(plant);
      puts += 1;
      return puts === 1 ? apiFail(409, 'SITE_NAME_TAKEN', 'Ya existe un sitio con ese nombre') : apiOk({ ...plant, name: 'Planta Sur' });
    });
    renderForm('/company/sites/3/edit');
    const name = await screen.findByLabelText(/Nombre del sitio/);
    expect(name).toHaveValue('Planta Norte');
    expect(screen.getByLabelText('Número interior')).toHaveValue('B');
    expect(map()).toHaveAttribute('data-point', '29.1,-110.9');

    // Sin cambios: se avisa y no se envía nada.
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('dialog', { name: 'Sin cambios' })).toHaveTextContent('No modificaste ningún dato');
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(calls.filter(isWrite)).toHaveLength(0);

    // Con cambios se confirma "antes → después"; cancelar no envía y deja lo escrito.
    await userEvent.clear(name);
    await userEvent.type(name, 'Planta Centro');
    await userEvent.click(screen.getByRole('button', { name: '300 m' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const confirm = await screen.findByRole('dialog', { name: '¿Guardar los cambios del sitio Planta Norte?' });
    expect(within(confirm).getByRole('region', { name: 'Cambios' })).toHaveTextContent('2 cambios');
    expect(rows(confirm, 'Cambios')).toEqual(['NombreAntes: Planta NorteDespués: Planta Centro', 'Radio para checarAntes: 100 mDespués: 300 m']);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    expect(calls.filter(isWrite)).toHaveLength(0);
    expect(name).toHaveValue('Planta Centro');
    expect(screen.getByLabelText(/Radio para checar/)).toHaveValue('300');

    const save = async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
      await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Guardar los cambios del sitio Planta Norte?' })).getByRole('button', { name: 'Guardar cambios' }));
    };
    await save();
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'No se pudo guardar el sitio' })).getByRole('button', { name: 'Entendido' }));
    expect(screen.getByText('Ya existe un sitio con ese nombre')).toBeInTheDocument();

    await userEvent.clear(name);
    await userEvent.type(name, 'Planta Sur');
    await save();
    expect(await screen.findByText('Lista de sitios')).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: 'Sitio actualizado' })).toHaveTextContent('Planta Sur quedó actualizado.');
    expect(calls.filter((c) => c.init.method === 'PUT').map((c) => c.url)).toEqual(['/api/sites/3', '/api/sites/3']);
  });

  it('un sitio sin punto pide marcarlo antes de guardar', async () => {
    mockFetch(apiOk({ ...plant, address: { ...plant.address, latitude: null, longitude: null } }));
    renderForm('/company/sites/3/edit');
    expect(await screen.findByLabelText(/Nombre del sitio/)).toHaveValue('Planta Norte');
    expect(map()).toHaveAttribute('data-point', '');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('alertdialog', { name: 'Revisa la información' })).toHaveTextContent('Marca en el mapa el punto del sitio');
  });

  it('si no carga ofrece volver a cargar', async () => {
    let attempts = 0;
    mockFetch(() => {
      attempts += 1;
      return attempts === 1 ? apiFail(404, 'SITE_NOT_FOUND', 'Sitio no encontrado') : apiOk(plant);
    });
    renderForm('/company/sites/3/edit');
    await screen.findByRole('alertdialog', { name: 'No se pudo cargar el sitio' });
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('heading', { name: 'Editar sitio' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByLabelText(/Nombre del sitio/)).toHaveValue('Planta Norte');
  });

  it('desactivar y activar se confirman (cancelar no envía nada); un error se explica', async () => {
    let patches = 0;
    const { calls } = mockFetch((call) => {
      if (call.init.method !== 'PATCH') return apiOk(plant);
      patches += 1;
      if (patches === 2) return apiFail(500, 'INTERNAL_ERROR', 'Falla inesperada');
      return apiOk({ ...plant, active: (bodyOf(call) as { active: boolean }).active });
    });
    renderForm('/company/sites/3/edit');
    const section = (await screen.findByRole('heading', { name: /Estado del sitio/ })).closest('section') as HTMLElement;
    expect(within(section).getByText('Activo')).toBeInTheDocument();

    await userEvent.click(within(section).getByRole('button', { name: 'Desactivar' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: '¿Desactivar el sitio Planta Norte?' })).getByRole('button', { name: 'Cancelar' }));
    expect(calls.some((c) => c.init.method === 'PATCH')).toBe(false);
    expect(within(section).getByText('Activo')).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Desactivar' })).toBeEnabled();

    await userEvent.click(within(section).getByRole('button', { name: 'Desactivar' }));
    const confirm = await screen.findByRole('alertdialog', { name: '¿Desactivar el sitio Planta Norte?' });
    expect(confirm).toHaveTextContent('Nadie podrá checar en este sitio');
    expect(rows(confirm, 'Cambios')).toEqual(['EstadoAntes: ActivoDespués: Inactivo']);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Desactivar' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'El sitio quedó inactivo' })).getByRole('button', { name: 'Entendido' }));
    expect(within(section).getByText('Inactivo')).toBeInTheDocument();

    const activate = async () => {
      await userEvent.click(within(section).getByRole('button', { name: 'Activar' }));
      const dialog = await screen.findByRole('dialog', { name: '¿Activar el sitio Planta Norte?' });
      expect(rows(dialog, 'Cambios')).toEqual(['EstadoAntes: InactivoDespués: Activo']);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Activar' }));
    };
    await activate();
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'No se pudo activar Planta Norte' })).getByRole('button', { name: 'Entendido' }));
    await activate();
    expect(await screen.findByRole('dialog', { name: 'El sitio quedó activo' })).toBeInTheDocument();
    expect(calls.filter((c) => c.init.method === 'PATCH').map(bodyOf)).toEqual([{ active: false }, { active: true }, { active: true }]);
  });

  it('eliminar se confirma (cancelar no envía nada); si está en uso sugiere desactivarlo; si no, vuelve al listado', async () => {
    let deletes = 0;
    const { calls } = mockFetch((call) => {
      if (call.init.method !== 'DELETE') return apiOk(plant);
      deletes += 1;
      if (deletes === 1) return apiFail(409, 'SITE_IN_USE', 'El sitio está en asignaciones de turno: desactívalo en lugar de eliminarlo');
      if (deletes === 2) return apiFail(500, 'INTERNAL_ERROR', 'Falla inesperada');
      return apiOk(null);
    });
    renderForm('/company/sites/3/edit');
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));
    const cancelled = await screen.findByRole('alertdialog', { name: '¿Eliminar el sitio Planta Norte?' });
    expect(cancelled).toHaveTextContent('Solo se puede eliminar un sitio que no está en ninguna asignación de turno.');
    expect(cancelled.querySelector('.confirm-note')).toHaveTextContent('Esta acción no se puede deshacer.');
    await userEvent.click(within(cancelled).getByRole('button', { name: 'Cancelar' }));
    expect(calls.some((c) => c.init.method === 'DELETE')).toBe(false);
    expect(screen.getByLabelText(/Nombre del sitio/)).toHaveValue('Planta Norte');

    const remove = async () => {
      await userEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));
      const confirm = await screen.findByRole('alertdialog', { name: '¿Eliminar el sitio Planta Norte?' });
      await userEvent.click(within(confirm).getByRole('button', { name: 'Eliminar' }));
    };
    await remove();
    const inUse = await screen.findByRole('alertdialog', { name: 'El sitio está en uso: desactívalo' });
    expect(inUse).toHaveTextContent('desactívalo en lugar de eliminarlo');
    await userEvent.click(within(inUse).getByRole('button', { name: 'Entendido' }));
    await remove();
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'No se pudo eliminar Planta Norte' })).getByRole('button', { name: 'Entendido' }));
    await remove();
    expect(await screen.findByText('Lista de sitios')).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: 'El sitio se eliminó' })).toHaveTextContent('Planta Norte ya no aparece en tu empresa.');
  });
});
