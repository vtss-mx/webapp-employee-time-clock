import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as GoogleMaps from '../../services/maps/googleMaps';
import type * as ConfigModule from '../../utils/config';
import { setLocale } from '../../i18n/core';
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
  searchSource: vi.fn(),
  searchPlaces: vi.fn(),
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

const FOUND = { street: 'Calle Dr. Paliza', exterior_number: '71', postal_code: '83000', country_code: 'MX', state: 'Sonora', municipality: 'Hermosillo', city: 'Hermosillo', neighborhood: 'Centro' };
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

/** Las filas de una sección de la confirmación ("Se registrará" o "Cambios"), como texto. */
const rows = (dialog: HTMLElement, region: string) => within(within(dialog).getByRole('region', { name: region })).getAllByRole('listitem').map((li) => li.textContent);

/** Cierra el popup con ese título (advertencia/error: alertdialog; información/éxito: dialog). */
async function closePopup(title: string) {
  const heading = await screen.findByText(title);
  const popup = heading.closest<HTMLElement>('[role="dialog"], [role="alertdialog"]');
  if (!popup) throw new Error(`"${title}" no está en un popup`);
  await userEvent.click(within(popup).getByRole('button', { name: 'Entendido' }));
}

beforeEach(() => {
  Object.values(maps).forEach((fn) => fn.mockReset());
  maps.searchSource.mockReturnValue('places');
  maps.reverseGeocode.mockResolvedValue(FOUND);
});
afterEach(() => vi.unstubAllGlobals());

describe('ValidatorFormPage: alta', () => {
  it('cuenta, lugar buscado (llena el domicilio), requiere ubicación con radio y alta', async () => {
    const saved: Validator = { ...sampleValidator, location_required: true, location_radius_m: 200 };
    const { calls } = mockFetch((call) => (call.url.startsWith('/api/validation') ? liveCheck() : apiOk(saved)));
    maps.searchPlaces.mockResolvedValue([{ source: 'places', id: 'p1', primary: 'Plaza Zaragoza', secondary: 'Centro, Hermosillo', distanceMeters: null, prediction: {} }]);
    maps.resolvePlace.mockResolvedValue({ point: { lat: 29.07, lng: -110.95 }, address: FOUND, label: 'Plaza Zaragoza, Hermosillo' });
    renderAt('/company/validators/new');

    await userEvent.type(screen.getByLabelText(/Nombre o ubicación/), 'Recepción planta 1');
    await userEvent.type(screen.getByLabelText(/Correo de acceso/), 'recepcion@empresa.com');
    await userEvent.type(screen.getByLabelText(/Contraseña inicial/), 'Valida1234');
    await userEvent.type(screen.getByLabelText(/Confirmar contraseña/), 'Valida1234');

    const search = screen.getByRole('combobox', { name: 'Buscar un lugar o una dirección' });
    await userEvent.type(search, 'Plaza Zar');
    expect(await screen.findByRole('option', { name: /Plaza Zaragoza/ })).toBeInTheDocument();
    expect(maps.searchPlaces).toHaveBeenLastCalledWith('Plaza Zar', { token: null }, expect.objectContaining({ country: 'MX', near: null }));
    await userEvent.keyboard('{ArrowDown}{ArrowUp}{Enter}');
    await waitFor(() => expect(screen.getByLabelText('Calle o vialidad')).toHaveValue('Calle Dr. Paliza'));
    expect(search).toHaveValue('Plaza Zaragoza, Hermosillo');
    expect(screen.getByLabelText('Código postal')).toHaveValue('83000');
    expect(screen.getByLabelText('Municipio o alcaldía')).toHaveValue('Hermosillo');
    expect(screen.getByLabelText('Colonia o barrio')).toHaveValue('Centro');
    expect(map()).toHaveAttribute('data-point', '29.07,-110.95');

    await userEvent.click(screen.getByRole('switch', { name: 'Requiere ubicación' }));
    await userEvent.click(screen.getByRole('button', { name: '200 m' }));
    expect(map()).toHaveAttribute('data-radius', '200');
    expect(screen.getByText(/Solo podrá iniciar sesión a no más de 200 m/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Agregar validador' }));
    // Antes de crearlo confirma qué se registrará (la contraseña nunca se muestra).
    const confirm = await screen.findByRole('dialog', { name: '¿Agregar el validador Recepción planta 1?' });
    expect(rows(confirm, 'Se registrará')).toEqual([
      'NombreRecepción planta 1',
      'Correo de accesorecepcion@empresa.com',
      'Modo de identificaciónQR o rostro',
      'DomicilioCalle Dr. Paliza 71, Centro, 83000 Hermosillo, Sonora',
      'Punto en el mapa29.07000, -110.95000',
      'Exige ubicaciónSí, a 200 m',
    ]);
    expect(confirm).not.toHaveTextContent('Valida1234');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Agregar validador' }));

    expect(await screen.findByText('Lista de validadores')).toBeInTheDocument();
    const popup = await screen.findByRole('dialog', { name: 'Validador agregado' });
    expect(popup).toHaveTextContent('Solo podrá iniciar sesión a no más de 200 m del punto marcado.');
    const post = calls.find((c) => c.init.method === 'POST');
    expect(JSON.parse(post?.init.body as string)).toEqual({
      name: 'Recepción planta 1',
      mode: 'QR_OR_FACE',
      email: 'recepcion@empresa.com',
      password: 'Valida1234',
      address: { ...FOUND, interior_number: null, reference_notes: null, latitude: 29.07, longitude: -110.95 },
      location_required: true,
      location_radius_m: 200,
    });
  });

  it('tocar el mapa marca el punto y llena el domicilio; sin Geocoding se explica una sola vez', async () => {
    mockFetch(() => liveCheck());
    renderAt('/company/validators/new');
    await userEvent.click(screen.getByRole('button', { name: 'Tocar el mapa' }));
    await waitFor(() => expect(screen.getByLabelText('Estado o provincia')).toHaveValue('Sonora'));
    expect(screen.getByText('Punto: 29.07290, -110.95590')).toBeInTheDocument();
    expect(maps.reverseGeocode).toHaveBeenCalledWith({ lat: 29.0729, lng: -110.9559 });

    maps.reverseGeocode.mockRejectedValue(new MapsApiError('geocoding', 'denied'));
    await userEvent.type(screen.getByLabelText('Número interior'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Tocar el mapa' }));
    // Sin Geocoding: se dice bajo el mapa (nunca un popup) y el punto queda marcado.
    expect(await screen.findByText(/No se pudo completar el domicilio desde el mapa/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tocar el mapa' }));
    await waitFor(() => expect(maps.reverseGeocode).toHaveBeenCalledTimes(3));
    expect(screen.queryByRole('alertdialog')).toBeNull();
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
    await userEvent.type(screen.getByLabelText(/Radio permitido/), '5{Enter}'); // Enter envía sin salir del campo (salir lo ajusta al mínimo)
    const popup = await screen.findByRole('alertdialog', { name: 'Revisa los datos' });
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
    maps.searchPlaces.mockRejectedValue(new MapsApiError('places', 'denied')); // ni Places ni el respaldo
    maps.geocodeAddress.mockResolvedValueOnce(null).mockResolvedValueOnce({ point: { lat: 20.5, lng: -100.4 }, address: {}, label: 'x' });
    renderAt('/company/validators/new');

    await userEvent.click(screen.getByRole('button', { name: 'Mi ubicación' }));
    await waitFor(() => expect(map()).toHaveAttribute('data-point', '19.43,-99.13'));
    await waitFor(() => expect(screen.getByLabelText('Calle o vialidad')).toHaveValue('Calle Dr. Paliza'));

    await userEvent.click(screen.getByRole('button', { name: 'Ubicar la dirección escrita' }));
    expect(await screen.findByText(/No se encontró la dirección/)).toBeInTheDocument();
    expect(maps.geocodeAddress).toHaveBeenCalledWith('Calle Dr. Paliza 71, Centro, 83000 Hermosillo, Sonora, MX', 'MX');
    await userEvent.click(screen.getByRole('button', { name: 'Ubicar la dirección escrita' }));
    await waitFor(() => expect(map()).toHaveAttribute('data-point', '20.5,-100.4'));

    await userEvent.type(screen.getByRole('combobox', { name: 'Buscar un lugar o una dirección' }), 'Zócalo');
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument(); // la lista lo dice, sin popup
    await userEvent.type(screen.getByRole('combobox', { name: 'Buscar un lugar o una dirección' }), ' CDMX');
    await new Promise((r) => setTimeout(r, 400));
    expect(maps.searchPlaces).toHaveBeenCalledTimes(1); // sin las APIs no se vuelve a intentar
    await userEvent.click(screen.getByRole('button', { name: 'Borrar búsqueda' }));
  });

  it('si Google rechaza la clave del mapa se avisa y se captura a mano', async () => {
    mockFetch(() => liveCheck());
    renderAt('/company/validators/new');
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar la clave' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Mi ubicación' })).toBeNull());
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByLabelText('Calle o vialidad')).toBeEnabled();
  });
});

describe('ValidatorFormPage: edición', () => {
  it('carga el validador, cambia nombre y exige ubicación (sus sesiones se cierran)', async () => {
    const saved: Validator = { ...sampleValidator, name: 'Acceso norte', location_required: true, location_radius_m: 150 };
    const { calls } = mockFetch(apiOk(sampleValidator), apiOk(saved));
    renderAt('/company/validators/3/edit');
    expect(await screen.findByDisplayValue('Recepción planta 1')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Correo de acceso/)).toBeNull();
    expect(screen.getByLabelText('Calle o vialidad')).toHaveValue('Calle Dr. Paliza');
    expect(map()).toHaveAttribute('data-point', '29.0729,-110.9559');

    await userEvent.clear(screen.getByLabelText(/Nombre o ubicación/));
    await userEvent.type(screen.getByLabelText(/Nombre o ubicación/), 'Acceso norte');
    await userEvent.click(screen.getByRole('switch', { name: 'Requiere ubicación' }));
    await userEvent.clear(screen.getByLabelText(/Radio permitido/));
    await userEvent.type(screen.getByLabelText(/Radio permitido/), '150');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const confirm = await screen.findByRole('dialog', { name: '¿Guardar los cambios de Recepción planta 1?' });
    expect(rows(confirm, 'Cambios')).toEqual(['NombreAntes: Recepción planta 1Después: Acceso norte', 'Exige ubicaciónAntes: NoDespués: Sí, a 150 m']);
    expect(confirm).toHaveTextContent('Su sesión abierta se cerrará: deberá iniciar sesión de nuevo desde ese lugar.');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Guardar cambios' }));

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
    expect(screen.getByLabelText('Calle o vialidad')).toHaveValue('');
    for (const [label, value] of [['Calle o vialidad', 'Juárez'], ['Número exterior', 'S/N'], ['Colonia o barrio', 'Centro'], ['Código postal', '99999'], ['Estado o provincia', 'Sonora'], ['Municipio o alcaldía', 'Cajeme'], ['Ciudad o localidad', 'Obregón']]) {
      await userEvent.type(screen.getByLabelText(label), value);
    }
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const confirm = await screen.findByRole('dialog', { name: '¿Guardar los cambios de Recepción planta 1?' });
    // Sin domicilio antes; el municipio se dice porque no es la ciudad. El punto sigue sin marcar.
    expect(rows(confirm, 'Cambios')).toEqual(['DomicilioAntes: Sin capturarDespués: Juárez S/N, Centro, 99999 Obregón, Sonora (municipio Cajeme)']);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Guardar cambios' }));
    await closePopup('No se pudo guardar el validador');
    expect(screen.getByLabelText('Código postal')).toHaveAccessibleDescription('Ese código postal no existe');
    await userEvent.type(screen.getByLabelText('Código postal'), '1');
    expect(screen.getByLabelText('Código postal')).not.toHaveAccessibleDescription('Ese código postal no existe');
  });

  it('sin ubicación exigida: puede iniciar sesión desde cualquier lugar y su sesión sigue abierta', async () => {
    const { calls } = mockFetch(apiOk(sampleValidator), apiOk({ ...sampleValidator, name: 'Acceso sur' }));
    renderAt('/company/validators/3/edit');
    await userEvent.clear(await screen.findByLabelText(/Nombre o ubicación/));
    await userEvent.type(screen.getByLabelText(/Nombre o ubicación/), 'Acceso sur');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const confirm = await screen.findByRole('dialog', { name: '¿Guardar los cambios de Recepción planta 1?' });
    expect(rows(confirm, 'Cambios')).toEqual(['NombreAntes: Recepción planta 1Después: Acceso sur']);
    expect(confirm).not.toHaveTextContent('Su sesión abierta se cerrará');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Guardar cambios' }));
    const popup = await screen.findByRole('dialog', { name: 'Validador actualizado' });
    expect(popup).toHaveTextContent('Puede iniciar sesión desde cualquier lugar.');
    expect(popup).not.toHaveTextContent('Su sesión abierta se cerró');
    expect(JSON.parse(calls[1].init.body as string)).toMatchObject({ name: 'Acceso sur', location_required: false });
  });

  it('cambiar solo las referencias también es un cambio: se confirma en su propia fila y se envía limpio', async () => {
    const { calls } = mockFetch(apiOk(sampleValidator), apiOk(sampleValidator));
    renderAt('/company/validators/3/edit');
    expect(await screen.findByDisplayValue('Recepción planta 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Colonia o barrio')).toHaveValue('Centro');
    await userEvent.type(screen.getByLabelText('Referencias'), ' Puerta 2 {Enter}{Enter}Timbre ');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const confirm = await screen.findByRole('dialog', { name: '¿Guardar los cambios de Recepción planta 1?' });
    expect(rows(confirm, 'Cambios')).toEqual(['ReferenciasAntes: Sin capturarDespués: Puerta 2\nTimbre']);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByRole('dialog', { name: 'Validador actualizado' });
    expect(JSON.parse(calls[1].init.body as string).address).toMatchObject({ neighborhood: 'Centro', reference_notes: 'Puerta 2\nTimbre' });
  });

  it('si no carga ofrece reintentar', async () => {
    mockFetch(apiFail(404, 'VALIDATOR_NOT_FOUND', 'Validador no encontrado'), apiOk(sampleValidator));
    renderAt('/company/validators/9/edit');
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo cargar el validador' });
    await userEvent.click(within(popup).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByDisplayValue('Recepción planta 1')).toBeInTheDocument();
  });
});

describe('ValidatorFormPage: confirmación antes de guardar', () => {
  it('alta: cancelar no envía nada y el formulario sigue con lo escrito (sin punto ni ubicación exigida)', async () => {
    const { calls } = mockFetch(() => liveCheck());
    renderAt('/company/validators/new');
    await userEvent.type(screen.getByLabelText(/Nombre o ubicación/), 'Comedor');
    await userEvent.type(screen.getByLabelText(/Correo de acceso/), 'comedor@empresa.com');
    await userEvent.type(screen.getByLabelText(/Contraseña inicial/), 'Valida1234');
    await userEvent.type(screen.getByLabelText(/Confirmar contraseña/), 'Valida1234');
    for (const [label, value] of [['Calle o vialidad', 'Juárez'], ['Número exterior', 'S/N'], ['Colonia o barrio', 'Centro'], ['Código postal', '83000'], ['Estado o provincia', 'Sonora'], ['Municipio o alcaldía', 'Hermosillo'], ['Ciudad o localidad', 'Hermosillo']]) {
      await userEvent.type(screen.getByLabelText(label), value);
    }
    const add = screen.getByRole('button', { name: 'Agregar validador' });
    await waitFor(() => expect(add).toBeEnabled()); // el correo ya se verificó
    await userEvent.click(add);
    const confirm = await screen.findByRole('dialog', { name: '¿Agregar el validador Comedor?' });
    expect(rows(confirm, 'Se registrará').slice(3)).toEqual(['DomicilioJuárez S/N, Centro, 83000 Hermosillo, Sonora', 'Punto en el mapaSin marcar', 'Exige ubicaciónNo']);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls.some((c) => c.init.method === 'POST')).toBe(false);
    expect(screen.getByLabelText(/Nombre o ubicación/)).toHaveValue('Comedor');
    expect(add).toBeEnabled();
  });

  it('edición sin cambios avisa "Sin cambios" y no envía nada; cancelar los cambios tampoco', async () => {
    const { calls } = mockFetch(apiOk(sampleValidator));
    renderAt('/company/validators/3/edit');
    expect(await screen.findByDisplayValue('Recepción planta 1')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('dialog', { name: 'Sin cambios' })).toHaveTextContent('No hay nada que guardar');
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));

    await userEvent.click(screen.getByText('Solo QR'));
    await userEvent.click(screen.getByRole('button', { name: 'Quitar punto' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const confirm = await screen.findByRole('dialog', { name: '¿Guardar los cambios de Recepción planta 1?' });
    expect(rows(confirm, 'Cambios')).toEqual(['Modo de identificaciónAntes: QR o rostroDespués: Solo QR', 'Punto en el mapaAntes: 29.07290, -110.95590Después: Sin marcar']);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls.filter((c) => c.init.method === 'PUT')).toHaveLength(0);
    expect(screen.getByRole('radio', { name: /Solo QR/ })).toBeChecked();
    expect(map()).toHaveAttribute('data-point', '');
  });
});

describe('ValidatorFormPage: fallas e inglés', () => {
  it('si el servidor no acepta el alta lo explica con su título', async () => {
    mockFetch((call) => (call.url.startsWith('/api/validation') ? liveCheck() : apiFail(409, 'VALIDATOR_LIMIT', 'Llegaste al tope de validadores')));
    renderAt('/company/validators/new');
    await userEvent.type(screen.getByLabelText(/Nombre o ubicación/), 'Recepción planta 1');
    await userEvent.type(screen.getByLabelText(/Correo de acceso/), 'recepcion@empresa.com');
    await userEvent.type(screen.getByLabelText(/Contraseña inicial/), 'Valida1234');
    await userEvent.type(screen.getByLabelText(/Confirmar contraseña/), 'Valida1234');
    await userEvent.click(screen.getByRole('button', { name: 'Tocar el mapa' }));
    await waitFor(() => expect(screen.getByLabelText('Calle o vialidad')).toHaveValue('Calle Dr. Paliza'));
    expect(await screen.findByText('Disponible')).toBeInTheDocument(); // el correo ya se verificó (mientras tanto no se envía)
    await userEvent.click(screen.getByRole('button', { name: 'Agregar validador' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Agregar el validador Recepción planta 1?' })).getByRole('button', { name: 'Agregar validador' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo agregar el validador' })).toHaveTextContent('Llegaste al tope de validadores');
  });

  it('en inglés: campos y ayudas; el resumen de lo que falta sigue al idioma con el popup abierto', async () => {
    await setLocale('en-US');
    const { calls } = mockFetch(() => liveCheck());
    renderAt('/company/validators/new');
    expect(screen.getByRole('heading', { name: 'Add validator' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Name or location/)).toBeInTheDocument();
    expect(screen.getByText('It can sign in from anywhere.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('switch', { name: 'Requires location' }));
    expect(screen.getByText('Between 10 and 10,000 m. Consider the size of the place and the GPS margin.')).toBeInTheDocument();
    expect(screen.getByText(/It can only sign in within 100 m of the point on the map/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('switch', { name: 'Requires location' })); // sin exigirla, el punto no falta
    await userEvent.click(screen.getByRole('button', { name: 'Add validator' }));
    const popup = await screen.findByRole('alertdialog', { name: 'Check the details' });
    expect(popup).toHaveTextContent('Enter a name or location (e.g., "Plant 1 reception")');
    expect(popup).not.toHaveTextContent('Mark the entrance point on the map');
    await act(() => setLocale('es-MX'));
    expect(screen.getByRole('alertdialog', { name: 'Revisa los datos' })).toHaveTextContent('Escribe un nombre o ubicación');
    expect(calls.some((c) => c.init.method === 'POST')).toBe(false);
  });
});
