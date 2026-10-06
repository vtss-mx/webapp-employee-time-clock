import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n/core';
import type * as GoogleMaps from '../../services/maps/googleMaps';
import { MapsApiError, type FoundPlace, type PlaceSuggestion, type SearchRequest, type SearchSession, type SearchSource } from '../../services/maps/googleMaps';
import { renderWithProviders } from '../../test/render';
import { EMPTY_ADDRESS, type AddressValues, type GeoPoint } from '../../utils/address';
import type * as ConfigModule from '../../utils/config';
import type * as Geolocation from '../../utils/geolocation';
import { LocationError, type DeviceLocation } from '../../utils/geolocation';
import { LocationPicker } from './LocationPicker';
import type { MapView } from './MapCanvas';

// Google Maps simulado (el SDK real se valida en navegador) con las APIs que cada prueba habilita.
const mapsConfig = vi.hoisted(() => ({ apiKey: 'clave-de-prueba', places: false, geocoding: true, geolocation: true }));
vi.mock('../../utils/config', async (importOriginal) => {
  const actual = await importOriginal<typeof ConfigModule>();
  return { config: { ...actual.config, maps: mapsConfig } };
});
const maps = vi.hoisted(() => ({
  reverseGeocode: vi.fn<(point: GeoPoint) => Promise<Partial<AddressValues>>>(),
  geocodeAddress: vi.fn<(text: string, country: string) => Promise<FoundPlace | null>>(),
  searchSource: vi.fn<() => SearchSource | null>(),
  searchPlaces: vi.fn<(input: string, session: SearchSession, request?: SearchRequest) => Promise<PlaceSuggestion[]>>(),
  resolvePlace: vi.fn<(suggestion: PlaceSuggestion) => Promise<FoundPlace>>(),
  approximateLocation: vi.fn<() => Promise<{ point: GeoPoint; accuracy: number }>>(),
}));
vi.mock('../../services/maps/googleMaps', async (importOriginal) => ({ ...(await importOriginal<typeof GoogleMaps>()), mapsService: maps }));
// Ubicación del navegador simulada (el aviso nativo de permiso no existe en jsdom).
const device = vi.hoisted(() => ({ currentLocation: vi.fn<() => Promise<DeviceLocation>>() }));
vi.mock('../../utils/geolocation', async (importOriginal) => ({ ...(await importOriginal<typeof Geolocation>()), currentLocation: device.currentLocation }));
// Lo que se reporta al ADMIN (una API de Google sin habilitar): su regla se prueba en clientErrorService.test.
const reporter = vi.hoisted(() => ({ reportMapsProblem: vi.fn<(problem: GoogleMaps.MapsApiError) => void>() }));
vi.mock('../../services/clientErrorService', () => reporter);
// El mapa real se prueba en MapCanvas.test: aquí solo importa lo que entrega.
vi.mock('./MapCanvas', async () => {
  const { MapsApiError: ProblemError } = await vi.importActual<typeof GoogleMaps>('../../services/maps/googleMaps');
  type Props = { point: GeoPoint | null; radius: number | null; onPick: (p: GeoPoint) => void; onFailure: (e: GoogleMaps.MapsApiError) => void; onView: (view: MapView) => void };
  return {
    MapCanvas: ({ point, radius, onPick, onFailure, onView }: Props) => (
      <div data-testid="map" data-point={point ? `${point.lat},${point.lng}` : ''} data-radius={radius ?? ''}>
        <button type="button" onClick={() => onPick({ lat: 29.0729, lng: -110.9559 })}>
          Tocar el mapa
        </button>
        <button type="button" onClick={() => onFailure(new ProblemError('maps', 'denied'))}>
          Rechazar la clave
        </button>
        <button type="button" onClick={() => onView({ center: { lat: 20.6597, lng: -103.3496 }, zoom: 13 })}>
          Acercar a Guadalajara
        </button>
        <button type="button" onClick={() => onView({ center: { lat: 23.6, lng: -102.5 }, zoom: 5 })}>
          Ver todo el país
        </button>
      </div>
    ),
  };
});

const TAPPED: GeoPoint = { lat: 29.0729, lng: -110.9559 };
const FOUND = { street: 'Calle Dr. Paliza', exterior_number: '71', postal_code: '83000', country_code: 'MX', state: 'Sonora', municipality: 'Hermosillo', city: 'Hermosillo', neighborhood: 'Centro' };
const WRITTEN: AddressValues = { ...EMPTY_ADDRESS, street: 'Calle Dr. Paliza', exterior_number: '71', neighborhood: 'Centro', postal_code: '83000', city: 'Hermosillo', state: 'Sonora' };

/** Texto, país y referencia de la última búsqueda (sin la señal ni a quién informar). */
const lastSearch = () => {
  const [input, , request] = maps.searchPlaces.mock.calls[maps.searchPlaces.mock.calls.length - 1];
  return [input, { country: request?.country, near: request?.near }];
};
const DEFAULTS = { ...mapsConfig };

/** Promesa que la prueba cumple o rechaza cuando quiere. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

interface HarnessProps {
  initialPoint?: GeoPoint | null;
  address?: AddressValues;
  error?: string;
  disabled?: boolean;
  onPoint: (point: GeoPoint | null) => void;
  onAddress: (found: Partial<AddressValues>) => void;
}

/** El formulario que usa el selector: guarda el punto que recibe. */
function Harness({ initialPoint = null, address = EMPTY_ADDRESS, error, disabled, onPoint, onAddress }: HarnessProps) {
  const [point, setPoint] = useState<GeoPoint | null>(initialPoint);
  return (
    <LocationPicker
      point={point}
      radius={150}
      address={address}
      error={error}
      disabled={disabled}
      onPoint={(next) => {
        onPoint(next);
        setPoint(next);
      }}
      onAddress={onAddress}
    />
  );
}

function renderPicker(props: Partial<Omit<HarnessProps, 'onPoint' | 'onAddress'>> = {}) {
  const onPoint = vi.fn<(point: GeoPoint | null) => void>();
  const onAddress = vi.fn<(found: Partial<AddressValues>) => void>();
  const view = renderWithProviders(<Harness {...props} onPoint={onPoint} onAddress={onAddress} />);
  return { ...view, onPoint, onAddress };
}

const locateButton = () => screen.queryByRole('button', { name: 'Mi ubicación' });
const geocodeButton = () => screen.queryByRole('button', { name: 'Ubicar la dirección escrita' });

/** Popup con ese título (advertencia/error: alertdialog; información: dialog). */
async function popup(title: string) {
  const heading = await screen.findByText(title);
  const dialog = heading.closest<HTMLElement>('[role="dialog"], [role="alertdialog"]');
  if (!dialog) throw new Error(`"${title}" no está en un popup`);
  return dialog;
}

const noPopup = () => expect(screen.queryByRole('dialog') ?? screen.queryByRole('alertdialog')).toBeNull();

beforeEach(() => {
  Object.assign(mapsConfig, DEFAULTS);
  reporter.reportMapsProblem.mockReset();
  Object.values(maps).forEach((fn) => fn.mockReset());
  device.currentLocation.mockReset();
  maps.reverseGeocode.mockResolvedValue(FOUND);
  maps.searchSource.mockReturnValue('places');
});

describe('LocationPicker: configuración', () => {
  it('sin clave de Google el domicilio se captura a mano y no hay mapa', () => {
    mapsConfig.apiKey = '';
    renderPicker();
    expect(screen.getByText('El mapa no está configurado: el domicilio se captura a mano y no se puede exigir ubicación.')).toBeInTheDocument();
    expect(screen.queryByTestId('map')).toBeNull();
    expect(locateButton()).toBeNull();
  });

  it('con clave muestra el mapa (con el radio), "Mi ubicación" y, sin Places ni Geocoding, sin buscador', () => {
    mapsConfig.geocoding = false;
    renderPicker();
    expect(screen.getByTestId('map')).toHaveAttribute('data-radius', '150');
    expect(locateButton()).toBeEnabled();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByText('Toca el mapa para marcar el punto del acceso')).toBeInTheDocument();
  });

  it('sin Places pero con Geocoding hay buscador: busca con la geocodificación de lo escrito y llena todo', async () => {
    maps.searchSource.mockReturnValue('geocoding');
    const place: FoundPlace = { point: { lat: 29.07, lng: -110.95 }, address: FOUND, label: 'Calle Dr. Paliza 71, Centro, 83000 Hermosillo' };
    maps.searchPlaces.mockResolvedValue([
      { source: 'geocoding', id: 'g1', primary: 'Calle Dr. Paliza 71', secondary: 'Centro, 83000 Hermosillo', distanceMeters: null, point: place.point, parts: [], label: place.label },
    ]);
    maps.resolvePlace.mockResolvedValue(place);
    const { onPoint, onAddress } = renderPicker();
    await userEvent.type(screen.getByRole('combobox', { name: 'Buscar un lugar o una dirección' }), 'Paliza 71');
    await userEvent.click(await screen.findByRole('option', { name: /Calle Dr\. Paliza 71/ }));
    await waitFor(() => expect(onAddress).toHaveBeenCalledExactlyOnceWith(FOUND));
    expect(onPoint).toHaveBeenCalledExactlyOnceWith(place.point);
    expect(lastSearch()).toEqual(['Paliza 71', { country: 'MX', near: null }]);
    noPopup();
  });
});

describe('LocationPicker: marcar el punto', () => {
  it('tocar el mapa marca el punto y llena el domicilio con lo que Google conoce ahí', async () => {
    const lookup = deferred<Partial<AddressValues>>();
    maps.reverseGeocode.mockReturnValue(lookup.promise);
    const { onPoint, onAddress } = renderPicker();
    await userEvent.click(screen.getByRole('button', { name: 'Tocar el mapa' }));
    expect(onPoint).toHaveBeenCalledExactlyOnceWith(TAPPED);
    expect(screen.getByText('Punto: 29.07290, -110.95590')).toBeInTheDocument();
    expect(screen.getByTestId('map')).toHaveAttribute('data-point', '29.0729,-110.9559');
    expect(screen.getByText('· buscando el domicilio…')).toBeInTheDocument();
    expect(locateButton()).toBeDisabled(); // una tarea a la vez

    lookup.resolve(FOUND);
    await waitFor(() => expect(onAddress).toHaveBeenCalledExactlyOnceWith(FOUND));
    expect(maps.reverseGeocode).toHaveBeenCalledWith(TAPPED);
    expect(screen.queryByText('· buscando el domicilio…')).toBeNull();
    expect(locateButton()).toBeEnabled();
  });

  it('si Google no conoce una dirección en ese punto, el domicilio escrito no se toca', async () => {
    maps.reverseGeocode.mockResolvedValue({});
    const { onPoint, onAddress } = renderPicker();
    await userEvent.click(screen.getByRole('button', { name: 'Tocar el mapa' }));
    await waitFor(() => expect(maps.reverseGeocode).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('· buscando el domicilio…')).toBeNull());
    expect(onPoint).toHaveBeenCalledWith(TAPPED);
    expect(onAddress).not.toHaveBeenCalled();
  });

  it('sin Geocoding solo marca el punto (no busca el domicilio ni ofrece ubicar la dirección)', async () => {
    mapsConfig.geocoding = false;
    const { onPoint, onAddress } = renderPicker({ address: WRITTEN });
    expect(geocodeButton()).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Tocar el mapa' }));
    expect(onPoint).toHaveBeenCalledWith(TAPPED);
    expect(maps.reverseGeocode).not.toHaveBeenCalled();
    expect(onAddress).not.toHaveBeenCalled();
  });

  it('si se sale mientras se busca el domicilio, no se aplica', async () => {
    const lookup = deferred<Partial<AddressValues>>();
    maps.reverseGeocode.mockReturnValue(lookup.promise);
    const { onAddress, unmount } = renderPicker();
    await userEvent.click(screen.getByRole('button', { name: 'Tocar el mapa' }));
    unmount();
    lookup.resolve(FOUND);
    await lookup.promise;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onAddress).not.toHaveBeenCalled();
  });

  it('"Quitar punto" lo borra', async () => {
    const { onPoint } = renderPicker({ initialPoint: TAPPED });
    expect(screen.getByText('Punto: 29.07290, -110.95590')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Quitar punto' }));
    expect(onPoint).toHaveBeenCalledExactlyOnceWith(null);
    expect(screen.getByText('Toca el mapa para marcar el punto del acceso')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quitar punto' })).toBeNull();
  });

  it('deshabilitado no deja cambiar el punto con los botones', () => {
    renderPicker({ initialPoint: TAPPED, address: WRITTEN, disabled: true });
    expect(locateButton()).toBeDisabled();
    expect(geocodeButton()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Quitar punto' })).toBeDisabled();
  });

  it('el error del formulario se muestra bajo el mapa', () => {
    const { container } = renderPicker({ error: 'Marca en el mapa el punto del acceso para exigir ubicación' });
    expect(screen.getByRole('alert')).toHaveTextContent('Marca en el mapa el punto del acceso para exigir ubicación');
    expect(container.querySelector('.location-picker')).toHaveClass('has-error');
  });
});

describe('LocationPicker: "Mi ubicación"', () => {
  it('usa la ubicación del navegador y llena el domicilio de ese punto', async () => {
    device.currentLocation.mockResolvedValue({ latitude: 19.4326, longitude: -99.1332, accuracy: 12 });
    const { onPoint, onAddress } = renderPicker();
    await userEvent.click(locateButton() as HTMLElement);
    await waitFor(() => expect(onPoint).toHaveBeenCalledExactlyOnceWith({ lat: 19.4326, lng: -99.1332 }));
    await waitFor(() => expect(onAddress).toHaveBeenCalledWith(FOUND));
    expect(maps.approximateLocation).not.toHaveBeenCalled();
  });

  it.each(['unavailable', 'timeout'] as const)('sin lectura precisa (%s, p. ej. macOS sin GPS) pide la de la red Wi-Fi antes que a Google', async (problem) => {
    device.currentLocation.mockRejectedValueOnce(new LocationError(problem)).mockResolvedValueOnce({ latitude: 29.08, longitude: -110.96, accuracy: 80 });
    const { onPoint } = renderPicker();
    await userEvent.click(locateButton() as HTMLElement);
    await waitFor(() => expect(onPoint).toHaveBeenCalledExactlyOnceWith({ lat: 29.08, lng: -110.96 }));
    expect(device.currentLocation).toHaveBeenLastCalledWith({ highAccuracy: false, maxAgeMs: 300_000, timeoutMs: 10_000 });
    expect(maps.approximateLocation).not.toHaveBeenCalled();
    noPopup();
  });

  it.each(['unavailable', 'timeout', 'unsupported', 'insecure'] as const)('si el navegador no la da (%s) se estima con Google por red', async (problem) => {
    device.currentLocation.mockRejectedValue(new LocationError(problem));
    maps.approximateLocation.mockResolvedValue({ point: { lat: 19.43, lng: -99.13 }, accuracy: 1500 });
    const { onPoint } = renderPicker();
    await userEvent.click(locateButton() as HTMLElement);
    await waitFor(() => expect(onPoint).toHaveBeenCalledExactlyOnceWith({ lat: 19.43, lng: -99.13 }));
    noPopup();
  });

  it('con el permiso bloqueado no se estima: se explica cómo permitirlo', async () => {
    device.currentLocation.mockRejectedValue(new LocationError('denied'));
    const { onPoint } = renderPicker();
    await userEvent.click(locateButton() as HTMLElement);
    const dialog = await popup('Permite el acceso a tu ubicación');
    expect(dialog).toHaveAttribute('role', 'alertdialog');
    expect(dialog).toHaveTextContent('Android: toca el candado junto a la dirección');
    expect(maps.approximateLocation).not.toHaveBeenCalled();
    expect(onPoint).not.toHaveBeenCalled();
  });

  it('sin la Geolocation API de Google se explica el problema del navegador', async () => {
    mapsConfig.geolocation = false;
    device.currentLocation.mockRejectedValue(new LocationError('timeout'));
    renderPicker();
    await userEvent.click(locateButton() as HTMLElement);
    expect(await popup('La ubicación tardó demasiado')).toHaveTextContent('Activa la ubicación precisa del dispositivo e intenta de nuevo.');
    expect(maps.approximateLocation).not.toHaveBeenCalled();
  });

  it('cualquier otra falla al ubicar se avisa con su mensaje', async () => {
    device.currentLocation.mockRejectedValue(new Error('Falla inesperada del dispositivo'));
    renderPicker();
    await userEvent.click(locateButton() as HTMLElement);
    expect(await popup('No se pudo ubicar el punto')).toHaveTextContent('Falla inesperada del dispositivo');
    expect(maps.approximateLocation).not.toHaveBeenCalled();
    expect(locateButton()).toBeEnabled();
  });

  it('si Google tampoco la estima: lo dice bajo el mapa (sin popups); sin red, que revise la conexión; apagada, nada', async () => {
    device.currentLocation.mockRejectedValue(new LocationError('unavailable'));
    maps.approximateLocation.mockRejectedValue(new MapsApiError('geolocation', 'denied'));
    renderPicker();
    await userEvent.click(locateButton() as HTMLElement);
    expect(await screen.findByText('No se pudo obtener tu ubicación. Marca el punto en el mapa.')).toBeInTheDocument();
    noPopup();
    expect(reporter.reportMapsProblem).toHaveBeenCalledWith(expect.objectContaining({ api: 'geolocation', problem: 'denied' }));

    maps.approximateLocation.mockRejectedValue(new MapsApiError('geolocation', 'failed'));
    await userEvent.click(locateButton() as HTMLElement);
    expect(await screen.findByText('Google Maps no respondió. Revisa tu conexión e intenta de nuevo.')).toBeInTheDocument();
    noPopup();

    maps.approximateLocation.mockRejectedValue(new MapsApiError('geolocation', 'off'));
    await userEvent.click(locateButton() as HTMLElement);
    await waitFor(() => expect(maps.approximateLocation).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(locateButton()).toBeEnabled());
    expect(document.querySelector('.location-picker__notice')).toBeNull(); // cada acción limpia el aviso anterior
    noPopup();
  });

  it('si Google no llena el domicilio desde el punto, lo dice bajo el mapa y el punto queda marcado', async () => {
    maps.reverseGeocode.mockRejectedValue(new MapsApiError('geocoding', 'denied'));
    const { onPoint } = renderPicker();
    await userEvent.click(screen.getByRole('button', { name: 'Tocar el mapa' }));
    expect(await screen.findByText(/No se pudo completar el domicilio desde el mapa/)).toBeInTheDocument();
    expect(onPoint).toHaveBeenCalled();
    noPopup();
    expect(reporter.reportMapsProblem).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ api: 'geocoding', problem: 'denied' }));
  });
});

describe('LocationPicker: dirección escrita y búsqueda', () => {
  it.each([
    ['sin calle', { street: '  ' }],
    ['sin ciudad', { city: '' }],
  ])('"Ubicar la dirección escrita" %s no se puede usar', (_case, missing) => {
    renderPicker({ address: { ...WRITTEN, ...missing } });
    expect(geocodeButton()).toBeDisabled();
  });

  it('"Ubicar la dirección escrita" marca el punto que Google encuentra', async () => {
    maps.geocodeAddress.mockResolvedValue({ point: TAPPED, address: FOUND, label: 'Calle Dr. Paliza 71, Hermosillo' });
    const { onPoint, onAddress } = renderPicker({ address: WRITTEN });
    await userEvent.click(geocodeButton() as HTMLElement);
    await waitFor(() => expect(onPoint).toHaveBeenCalledExactlyOnceWith(TAPPED));
    expect(maps.geocodeAddress).toHaveBeenCalledWith('Calle Dr. Paliza 71, Centro, 83000 Hermosillo, Sonora, MX', 'MX'); // con la colonia
    expect(onAddress).not.toHaveBeenCalled(); // el domicilio escrito se respeta
  });

  it('si Google no encuentra la dirección lo dice bajo el mapa (sin popups)', async () => {
    maps.geocodeAddress.mockResolvedValue(null);
    const { onPoint } = renderPicker({ address: WRITTEN });
    await userEvent.click(geocodeButton() as HTMLElement);
    expect(await screen.findByText('No se encontró la dirección. Revisa el domicilio o marca el punto en el mapa.')).toBeInTheDocument();
    expect(onPoint).not.toHaveBeenCalled();
    noPopup();
  });

  it('si el mapa no está disponible se quita "Mi ubicación" (el mapa dice que se escriba a mano)', async () => {
    renderPicker();
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar la clave' }));
    await waitFor(() => expect(locateButton()).toBeNull());
    noPopup();
    expect(reporter.reportMapsProblem).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ api: 'maps', problem: 'denied' }));
  });

  it('con Places, el lugar buscado marca su punto y llena el domicilio; si Places falla se explica', async () => {
    mapsConfig.places = true;
    const place: FoundPlace = { point: { lat: 29.07, lng: -110.95 }, address: FOUND, label: 'Plaza Zaragoza, Hermosillo' };
    maps.searchPlaces.mockResolvedValueOnce([{ source: 'places', id: 'p1', primary: 'Plaza Zaragoza', secondary: 'Centro', distanceMeters: null, prediction: {} as google.maps.places.PlacePrediction }]);
    maps.resolvePlace.mockResolvedValue(place);
    const { onPoint, onAddress } = renderPicker({ address: { ...EMPTY_ADDRESS, country_code: 'US' } });
    const search = screen.getByRole('combobox', { name: 'Buscar un lugar o una dirección' });
    await userEvent.type(search, 'Plaza');
    await userEvent.click(await screen.findByRole('option', { name: /Plaza Zaragoza/ }));
    await waitFor(() => expect(onAddress).toHaveBeenCalledExactlyOnceWith(FOUND));
    expect(onPoint).toHaveBeenCalledExactlyOnceWith(place.point);
    expect(lastSearch()).toEqual(['Plaza', { country: 'US', near: null }]); // sin punto ni zona: solo el país
    expect(maps.reverseGeocode).not.toHaveBeenCalled(); // el lugar ya trae su domicilio

    // Sin ninguna API para buscar: la lista dice que no hay resultados (nunca un popup).
    maps.searchPlaces.mockRejectedValue(new MapsApiError('places', 'denied'));
    await userEvent.clear(search);
    await userEvent.type(search, 'Catedral');
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
    expect(search).toHaveAttribute('aria-expanded', 'true');
    noPopup();
    expect(reporter.reportMapsProblem).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ api: 'places', problem: 'denied' }));
  });
});

describe('LocationPicker: el buscador prefiere lo cercano', () => {
  const GUADALAJARA = { lat: 20.6597, lng: -103.3496 };
  const search = () => screen.getByRole('combobox', { name: 'Buscar un lugar o una dirección' });

  beforeEach(() => {
    mapsConfig.places = true;
    maps.searchPlaces.mockResolvedValue([]);
  });

  it('sin punto: la zona que se ve del mapa, solo si ya se acercó a una ciudad (no el país completo)', async () => {
    renderPicker();
    await userEvent.click(screen.getByRole('button', { name: 'Ver todo el país' }));
    await userEvent.type(search(), 'Oxxo');
    await waitFor(() => expect(lastSearch()).toEqual(['Oxxo', { country: 'MX', near: null }]));

    await userEvent.click(screen.getByRole('button', { name: 'Acercar a Guadalajara' }));
    await userEvent.type(search(), ' Centro');
    await waitFor(() => expect(lastSearch()).toEqual(['Oxxo Centro', { country: 'MX', near: GUADALAJARA }]));
  });

  it('con punto marcado: el punto manda (aunque el mapa muestre otra zona)', async () => {
    renderPicker({ initialPoint: TAPPED });
    await userEvent.click(screen.getByRole('button', { name: 'Acercar a Guadalajara' }));
    await userEvent.type(search(), 'Oxxo');
    await waitFor(() => expect(maps.searchPlaces).toHaveBeenCalled());
    expect(lastSearch()).toEqual(['Oxxo', { country: 'MX', near: TAPPED }]);
  });
});

describe('LocationPicker en inglés (en-US)', () => {
  it('cambio en caliente: el punto, los botones y el aviso bajo el mapa pasan a inglés (el aviso guarda su código)', async () => {
    maps.reverseGeocode.mockRejectedValue(new MapsApiError('geocoding', 'denied'));
    renderPicker({ address: WRITTEN });
    expect(screen.getByText('Toca el mapa para marcar el punto del acceso')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tocar el mapa' }));
    expect(await screen.findByText(/No se pudo completar el domicilio desde el mapa/)).toBeInTheDocument();
    await act(() => setLocale('en-US'));
    expect(screen.getByText("Couldn't fill in the address from the map. Type it in; the point is still marked.")).toBeInTheDocument();
    expect(screen.getByText('Point: 29.07290, -110.95590')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My location' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Locate the typed address' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Remove point' })).toBeInTheDocument();
  });

  it('el popup del permiso bloqueado, abierto, sigue al idioma', async () => {
    device.currentLocation.mockRejectedValue(new LocationError('denied'));
    renderPicker();
    await userEvent.click(locateButton() as HTMLElement);
    await popup('Permite el acceso a tu ubicación');
    await act(() => setLocale('en-US'));
    const dialog = await popup('Allow access to your location');
    expect(dialog).toHaveTextContent('Locating you on the map requires location permission, and it is blocked in this browser.');
    expect(dialog).toHaveTextContent('Android: tap the lock next to the address › Permissions › Location › Allow.');
    expect(dialog).toHaveTextContent('Tap “My location” again (or mark the point on the map).');
  });
});
