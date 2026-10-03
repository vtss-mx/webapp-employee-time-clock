import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as GoogleMaps from '../../services/maps/googleMaps';
import type * as ConfigModule from '../../utils/config';
import { sampleValidator } from '../../test/fixtures';
import { apiFail, apiOk, envelope, jsonResponse, liveCheck, mockFetch } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import type { Validator } from '../../types';
import type { GeoPoint } from '../../utils/address';
import { ValidatorFormPage } from './ValidatorFormPage';

// Google Maps simulado: el SDK real se valida en navegador.
vi.mock('../../utils/config', async (importOriginal) => {
  const actual = await importOriginal<typeof ConfigModule>();
  return { config: { ...actual.config, maps: { apiKey: 'clave-de-prueba', places: true, geocoding: true, geolocation: false } } };
});
const maps = vi.hoisted(() => ({
  reverseGeocode: vi.fn(),
  geocodeAddress: vi.fn(),
  newSearchSession: vi.fn(),
  suggestPlaces: vi.fn(),
  resolvePlace: vi.fn(),
  approximateLocation: vi.fn(),
}));
vi.mock('../../services/maps/googleMaps', async (importOriginal) => ({ ...(await importOriginal<object>()), mapsService: maps }));
vi.mock('../../components/location/MapCanvas', async () => {
  const { MapsApiError } = await vi.importActual<typeof GoogleMaps>('../../services/maps/googleMaps');
  return {
    MapCanvas: ({ point, radius, onPick, onFailure }: { point: GeoPoint | null; radius: number | null; onPick: (p: GeoPoint) => void; onFailure: (e: GoogleMaps.MapsApiError) => void }) => (
      <div data-testid="map" data-point={point ? `${point.lat},${point.lng}` : ''} data-radius={radius ?? ''}>
        <button type="button" onClick={() => onPick({ lat: 29.0729, lng: -110.9559 })}>
          Tocar el mapa
        </button>
        <button type="button" onClick={() => onFailure(new MapsApiError('maps', 'denied'))}>
          Rechazar la clave
        </button>
      </div>
    ),
  };
});

const { MapsApiError } = await vi.importActual<typeof GoogleMaps>('../../services/maps/googleMaps');

const FOUND = { street: 'Calle Dr. Paliza', exterior_number: '71', postal_code: '83000', country_code: 'MX', state: 'Sonora', municipality: 'Hermosillo', city: 'Hermosillo' };
const map = () => screen.getByTestId('map');

function renderAt(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/company/validators" element={<p>Lista de validadores</p>} />
      <Route path="/company/validators/new" element={<ValidatorFormPage />} />
      <Route path="/company/validators/:id/edit" element={<ValidatorFormPage />} />
    </Routes>,
    { route },
  );
}

/** Cierra el popup con ese título (advertencia/error: alertdialog; información/éxito: dialog). */
async function closePopup(title: string) {
  const heading = await screen.findByText(title);
  const popup = heading.closest<HTMLElement>('[role="dialog"], [role="alertdialog"]');
  if (!popup) throw new Error(`"${title}" no está en un popup`);
  await userEvent.click(within(popup).getByRole('button', { name: 'Entendido' }));
}

beforeEach(() => {
  Object.values(maps).forEach((fn) => fn.mockReset());
  maps.newSearchSession.mockResolvedValue({});
  maps.reverseGeocode.mockResolvedValue(FOUND);
});
afterEach(() => vi.unstubAllGlobals());

describe('ValidatorFormPage: alta', () => {
  it('cuenta, lugar buscado (llena el domicilio), requiere ubicación con radio y alta', async () => {
    const saved: Validator = { ...sampleValidator, location_required: true, location_radius_m: 200 };
    const { calls } = mockFetch((call) => (call.url.startsWith('/api/validation') ? liveCheck() : apiOk(saved)));
    maps.suggestPlaces.mockResolvedValue([{ id: 'p1', primary: 'Plaza Zaragoza', secondary: 'Centro, Hermosillo', prediction: {} }]);
    maps.resolvePlace.mockResolvedValue({ point: { lat: 29.07, lng: -110.95 }, address: FOUND, label: 'Plaza Zaragoza, Hermosillo' });
    renderAt('/company/validators/new');

    await userEvent.type(screen.getByLabelText(/Nombre o ubicación/), 'Recepción planta 1');
    await userEvent.type(screen.getByLabelText(/Correo de acceso/), 'recepcion@empresa.com');
    await userEvent.type(screen.getByLabelText(/Contraseña inicial/), 'Valida1234');
    await userEvent.type(screen.getByLabelText(/Confirmar contraseña/), 'Valida1234');

    const search = screen.getByRole('combobox', { name: 'Buscar un lugar o una dirección' });
    await userEvent.type(search, 'Plaza Zar');
    expect(await screen.findByRole('option', { name: /Plaza Zaragoza/ })).toBeInTheDocument();
    expect(maps.suggestPlaces).toHaveBeenLastCalledWith('Plaza Zar', {}, 'MX');
    await userEvent.keyboard('{ArrowDown}{ArrowUp}{Enter}');
    await waitFor(() => expect(screen.getByLabelText('Calle')).toHaveValue('Calle Dr. Paliza'));
    expect(search).toHaveValue('Plaza Zaragoza, Hermosillo');
    expect(screen.getByLabelText('Código postal')).toHaveValue('83000');
    expect(screen.getByLabelText('Municipio o alcaldía')).toHaveValue('Hermosillo');
    expect(map()).toHaveAttribute('data-point', '29.07,-110.95');

    await userEvent.click(screen.getByRole('switch', { name: 'Requiere ubicación' }));
    await userEvent.click(screen.getByRole('button', { name: '200 m' }));
    expect(map()).toHaveAttribute('data-radius', '200');
    expect(screen.getByText(/Solo podrá iniciar sesión a no más de 200 m/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Agregar validador' }));

    expect(await screen.findByText('Lista de validadores')).toBeInTheDocument();
    const popup = await screen.findByRole('dialog', { name: 'Validador agregado' });
    expect(popup).toHaveTextContent('Solo podrá iniciar sesión a no más de 200 m del punto marcado.');
    const post = calls.find((c) => c.init.method === 'POST');
    expect(JSON.parse(post?.init.body as string)).toEqual({
      name: 'Recepción planta 1',
      mode: 'QR_OR_FACE',
      email: 'recepcion@empresa.com',
      password: 'Valida1234',
      address: { ...FOUND, interior_number: null, latitude: 29.07, longitude: -110.95 },
      location_required: true,
      location_radius_m: 200,
    });
  });

  it('tocar el mapa marca el punto y llena el domicilio; sin Geocoding se explica una sola vez', async () => {
    mockFetch(() => liveCheck());
    renderAt('/company/validators/new');
    await userEvent.click(screen.getByRole('button', { name: 'Tocar el mapa' }));
    await waitFor(() => expect(screen.getByLabelText('Estado')).toHaveValue('Sonora'));
    expect(screen.getByText('Punto: 29.07290, -110.95590')).toBeInTheDocument();
    expect(maps.reverseGeocode).toHaveBeenCalledWith({ lat: 29.0729, lng: -110.9559 });

    maps.reverseGeocode.mockRejectedValue(new MapsApiError('geocoding', 'denied'));
    await userEvent.type(screen.getByLabelText('Número interior'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Tocar el mapa' }));
    await closePopup('El autollenado del domicilio no está disponible');
    await userEvent.click(screen.getByRole('button', { name: 'Tocar el mapa' }));
    await waitFor(() => expect(maps.reverseGeocode).toHaveBeenCalledTimes(3));
    expect(screen.queryByRole('alertdialog')).toBeNull(); // no se repite
    expect(screen.getByLabelText('Número interior')).toHaveValue('2');

    await userEvent.click(screen.getByRole('button', { name: 'Quitar punto' }));
    expect(screen.getByText('Toca el mapa para marcar el punto del acceso')).toBeInTheDocument();
    expect(map()).toHaveAttribute('data-point', '');
  });

  it('requerir ubicación sin punto o con un radio fuera de rango no se envía', async () => {
    const { calls } = mockFetch(() => liveCheck());
    renderAt('/company/validators/new');
    await userEvent.click(screen.getByRole('switch', { name: 'Requiere ubicación' }));
    await userEvent.clear(screen.getByLabelText(/Radio permitido/));
    await userEvent.type(screen.getByLabelText(/Radio permitido/), '5');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar validador' }));
    const popup = await screen.findByRole('alertdialog', { name: 'Revisa la información' });
    expect(popup).toHaveTextContent('Marca en el mapa el punto del acceso para exigir ubicación');
    expect(popup).toHaveTextContent('Entre 10 y 10,000 m');
    expect(popup).toHaveTextContent('Escribe la calle');
    await userEvent.click(within(popup).getByRole('button', { name: 'Entendido' }));
    expect(screen.getAllByText('Marca en el mapa el punto del acceso para exigir ubicación').length).toBeGreaterThan(0);
    expect(calls.some((c) => c.init.method === 'POST')).toBe(false);
  });

  it('"Mi ubicación", ubicar la dirección escrita y la búsqueda sin Places habilitada', async () => {
    mockFetch(() => liveCheck());
    vi.stubGlobal('isSecureContext', true);
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: 19.43, longitude: -99.13, accuracy: 10 } } as GeolocationPosition) },
      configurable: true,
    });
    maps.suggestPlaces.mockRejectedValue(new MapsApiError('places', 'denied'));
    maps.geocodeAddress.mockResolvedValueOnce(null).mockResolvedValueOnce({ point: { lat: 20.5, lng: -100.4 }, address: {}, label: 'x' });
    renderAt('/company/validators/new');

    await userEvent.click(screen.getByRole('button', { name: 'Mi ubicación' }));
    await waitFor(() => expect(map()).toHaveAttribute('data-point', '19.43,-99.13'));
    await waitFor(() => expect(screen.getByLabelText('Calle')).toHaveValue('Calle Dr. Paliza'));

    await userEvent.click(screen.getByRole('button', { name: 'Ubicar la dirección escrita' }));
    await closePopup('No encontramos esa dirección');
    expect(maps.geocodeAddress).toHaveBeenCalledWith('Calle Dr. Paliza 71, 83000 Hermosillo, Sonora, MX', 'MX');
    await userEvent.click(screen.getByRole('button', { name: 'Ubicar la dirección escrita' }));
    await waitFor(() => expect(map()).toHaveAttribute('data-point', '20.5,-100.4'));

    await userEvent.type(screen.getByRole('combobox', { name: 'Buscar un lugar o una dirección' }), 'Zócalo');
    await closePopup('La búsqueda de lugares no está disponible');
    await userEvent.type(screen.getByRole('combobox', { name: 'Buscar un lugar o una dirección' }), ' CDMX');
    await new Promise((r) => setTimeout(r, 400));
    expect(maps.suggestPlaces).toHaveBeenCalledTimes(1); // sin la API no se vuelve a intentar
    await userEvent.click(screen.getByRole('button', { name: 'Borrar búsqueda' }));
  });

  it('si Google rechaza la clave del mapa se avisa y se captura a mano', async () => {
    mockFetch(() => liveCheck());
    renderAt('/company/validators/new');
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar la clave' }));
    await closePopup('El mapa no está disponible');
    expect(screen.queryByRole('button', { name: 'Mi ubicación' })).toBeNull();
    expect(screen.getByLabelText('Calle')).toBeEnabled();
  });
});

describe('ValidatorFormPage: edición', () => {
  it('carga el validador, cambia nombre y exige ubicación (sus sesiones se cierran)', async () => {
    const saved: Validator = { ...sampleValidator, name: 'Acceso norte', location_required: true, location_radius_m: 150 };
    const { calls } = mockFetch(apiOk(sampleValidator), apiOk(saved));
    renderAt('/company/validators/3/edit');
    expect(await screen.findByDisplayValue('Recepción planta 1')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Correo de acceso/)).toBeNull();
    expect(screen.getByLabelText('Calle')).toHaveValue('Calle Dr. Paliza');
    expect(map()).toHaveAttribute('data-point', '29.0729,-110.9559');

    await userEvent.clear(screen.getByLabelText(/Nombre o ubicación/));
    await userEvent.type(screen.getByLabelText(/Nombre o ubicación/), 'Acceso norte');
    await userEvent.click(screen.getByRole('switch', { name: 'Requiere ubicación' }));
    await userEvent.clear(screen.getByLabelText(/Radio permitido/));
    await userEvent.type(screen.getByLabelText(/Radio permitido/), '150');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    const popup = await screen.findByRole('dialog', { name: 'Validador actualizado' });
    expect(popup).toHaveTextContent('Su sesión abierta se cerró');
    expect(calls[1].url).toBe('/api/validators/3');
    expect(JSON.parse(calls[1].init.body as string)).toMatchObject({
      name: 'Acceso norte',
      location_required: true,
      location_radius_m: 150,
      address: { latitude: 29.0729, longitude: -110.9559, street: 'Calle Dr. Paliza' },
    });
  });

  it('validador sin domicilio: se completa; los errores del servidor vuelven a su campo', async () => {
    const legacy: Validator = { ...sampleValidator, address: null };
    const invalidPostalCode = { code: 'VALUE_ERROR', message: 'Ese código postal no existe', field: 'address.postal_code', details: null };
    const radiusMissing = { code: 'LOCATION_RADIUS_REQUIRED', message: 'Indica el radio', field: 'location_radius_m', details: null };
    mockFetch(apiOk(legacy), jsonResponse(envelope(null, { status: 422, code: 'VALIDATION_ERROR', message: 'Datos inválidos', errors: [invalidPostalCode, radiusMissing] }), 422));
    renderAt('/company/validators/3/edit');
    expect(await screen.findByDisplayValue('Recepción planta 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Calle')).toHaveValue('');
    for (const [label, value] of [['Calle', 'Juárez'], ['Número exterior', 'S/N'], ['Código postal', '99999'], ['Estado', 'Sonora'], ['Municipio o alcaldía', 'Cajeme'], ['Ciudad', 'Obregón']]) {
      await userEvent.type(screen.getByLabelText(label), value);
    }
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await closePopup('No se pudo guardar el validador');
    expect(screen.getByLabelText('Código postal')).toHaveAccessibleDescription('Ese código postal no existe');
    await userEvent.type(screen.getByLabelText('Código postal'), '1');
    expect(screen.getByLabelText('Código postal')).not.toHaveAccessibleDescription('Ese código postal no existe');
  });

  it('si no carga ofrece reintentar', async () => {
    mockFetch(apiFail(404, 'VALIDATOR_NOT_FOUND', 'Validador no encontrado'), apiOk(sampleValidator));
    renderAt('/company/validators/9/edit');
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo cargar el validador' });
    await userEvent.click(within(popup).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByDisplayValue('Recepción planta 1')).toBeInTheDocument();
  });
});
