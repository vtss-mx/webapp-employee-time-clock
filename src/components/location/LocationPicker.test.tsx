import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as GoogleMaps from '../../services/maps/googleMaps';
import { MapsApiError, type FoundPlace, type PlaceSuggestion } from '../../services/maps/googleMaps';
import { renderWithProviders } from '../../test/render';
import { EMPTY_ADDRESS, type AddressValues, type GeoPoint } from '../../utils/address';
import type * as ConfigModule from '../../utils/config';
import type * as Geolocation from '../../utils/geolocation';
import { LocationError, type DeviceLocation } from '../../utils/geolocation';
import { LocationPicker } from './LocationPicker';

// Google Maps simulado (el SDK real se valida en navegador) con las APIs que cada prueba habilita.
const mapsConfig = vi.hoisted(() => ({ apiKey: 'clave-de-prueba', places: false, geocoding: true, geolocation: true }));
vi.mock('../../utils/config', async (importOriginal) => {
  const actual = await importOriginal<typeof ConfigModule>();
  return { config: { ...actual.config, maps: mapsConfig } };
});
const maps = vi.hoisted(() => ({
  reverseGeocode: vi.fn<(point: GeoPoint) => Promise<Partial<AddressValues>>>(),
  geocodeAddress: vi.fn<(text: string, country: string) => Promise<FoundPlace | null>>(),
  newSearchSession: vi.fn<() => Promise<unknown>>(),
  suggestPlaces: vi.fn<(input: string, token: unknown, country?: string) => Promise<PlaceSuggestion[]>>(),
  resolvePlace: vi.fn<(suggestion: PlaceSuggestion) => Promise<FoundPlace>>(),
  approximateLocation: vi.fn<() => Promise<{ point: GeoPoint; accuracy: number }>>(),
}));
vi.mock('../../services/maps/googleMaps', async (importOriginal) => ({ ...(await importOriginal<typeof GoogleMaps>()), mapsService: maps }));
// Ubicación del navegador simulada (el aviso nativo de permiso no existe en jsdom).
const device = vi.hoisted(() => ({ currentLocation: vi.fn<() => Promise<DeviceLocation>>() }));
vi.mock('../../utils/geolocation', async (importOriginal) => ({ ...(await importOriginal<typeof Geolocation>()), currentLocation: device.currentLocation }));
// El mapa real se prueba en MapCanvas.test: aquí solo importa lo que entrega.
vi.mock('./MapCanvas', async () => {
  const { MapsApiError: ProblemError } = await vi.importActual<typeof GoogleMaps>('../../services/maps/googleMaps');
  return {
    MapCanvas: ({ point, radius, onPick, onFailure }: { point: GeoPoint | null; radius: number | null; onPick: (p: GeoPoint) => void; onFailure: (e: GoogleMaps.MapsApiError) => void }) => (
      <div data-testid="map" data-point={point ? `${point.lat},${point.lng}` : ''} data-radius={radius ?? ''}>
        <button type="button" onClick={() => onPick({ lat: 29.0729, lng: -110.9559 })}>
          Tocar el mapa
        </button>
        <button type="button" onClick={() => onFailure(new ProblemError('maps', 'denied'))}>
          Rechazar la clave
        </button>
      </div>
    ),
  };
});

const TAPPED: GeoPoint = { lat: 29.0729, lng: -110.9559 };
const FOUND = { street: 'Calle Dr. Paliza', exterior_number: '71', postal_code: '83000', country_code: 'MX', state: 'Sonora', municipality: 'Hermosillo', city: 'Hermosillo' };
const WRITTEN: AddressValues = { ...EMPTY_ADDRESS, street: 'Calle Dr. Paliza', exterior_number: '71', postal_code: '83000', city: 'Hermosillo', state: 'Sonora' };
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

async function closePopup(title: string) {
  await userEvent.click(within(await popup(title)).getByRole('button', { name: 'Entendido' }));
  await waitFor(() => expect(screen.queryByText(title)).toBeNull());
}

const noPopup = () => expect(screen.queryByRole('dialog') ?? screen.queryByRole('alertdialog')).toBeNull();

beforeEach(() => {
  Object.assign(mapsConfig, DEFAULTS);
  Object.values(maps).forEach((fn) => fn.mockReset());
  device.currentLocation.mockReset();
  maps.reverseGeocode.mockResolvedValue(FOUND);
});

describe('LocationPicker: configuración', () => {
  it('sin clave de Google el domicilio se captura a mano y no hay mapa', () => {
    mapsConfig.apiKey = '';
    renderPicker();
    expect(screen.getByText('El mapa no está configurado: el domicilio se captura a mano y no se puede exigir ubicación.')).toBeInTheDocument();
    expect(screen.queryByTestId('map')).toBeNull();
    expect(locateButton()).toBeNull();
  });

  it('con clave muestra el mapa (con el radio), "Mi ubicación" y, sin Places, sin buscador', () => {
    renderPicker();
    expect(screen.getByTestId('map')).toHaveAttribute('data-radius', '150');
    expect(locateButton()).toBeEnabled();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByText('Toca el mapa para marcar el punto del acceso')).toBeInTheDocument();
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
    expect(screen.getByText('· buscando el domicilio...')).toBeInTheDocument();
    expect(locateButton()).toBeDisabled(); // una tarea a la vez

    lookup.resolve(FOUND);
    await waitFor(() => expect(onAddress).toHaveBeenCalledExactlyOnceWith(FOUND));
    expect(maps.reverseGeocode).toHaveBeenCalledWith(TAPPED);
    expect(screen.queryByText('· buscando el domicilio...')).toBeNull();
    expect(locateButton()).toBeEnabled();
  });

  it('si Google no conoce una dirección en ese punto, el domicilio escrito no se toca', async () => {
    maps.reverseGeocode.mockResolvedValue({});
    const { onPoint, onAddress } = renderPicker();
    await userEvent.click(screen.getByRole('button', { name: 'Tocar el mapa' }));
    await waitFor(() => expect(maps.reverseGeocode).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('· buscando el domicilio...')).toBeNull());
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
    expect(await popup('La ubicación tardó demasiado')).toHaveTextContent('No se obtuvo la ubicación a tiempo.');
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

  it('si Google tampoco la estima: sin la API se explica una sola vez; sin red, cada vez; apagada, nunca', async () => {
    device.currentLocation.mockRejectedValue(new LocationError('unavailable'));
    maps.approximateLocation.mockRejectedValue(new MapsApiError('geolocation', 'denied'));
    renderPicker();
    await userEvent.click(locateButton() as HTMLElement);
    expect(await popup('No se pudo estimar tu ubicación')).toHaveTextContent('Geolocation API');
    await closePopup('No se pudo estimar tu ubicación');
    await userEvent.click(locateButton() as HTMLElement);
    await waitFor(() => expect(maps.approximateLocation).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(locateButton()).toBeEnabled());
    noPopup(); // ya se explicó

    maps.approximateLocation.mockRejectedValue(new MapsApiError('geolocation', 'failed'));
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await userEvent.click(locateButton() as HTMLElement);
      await closePopup('No se pudo consultar Google Maps');
    }

    maps.approximateLocation.mockRejectedValue(new MapsApiError('geolocation', 'off'));
    await userEvent.click(locateButton() as HTMLElement);
    await waitFor(() => expect(maps.approximateLocation).toHaveBeenCalledTimes(5));
    await waitFor(() => expect(locateButton()).toBeEnabled());
    noPopup();
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
    expect(maps.geocodeAddress).toHaveBeenCalledWith('Calle Dr. Paliza 71, 83000 Hermosillo, Sonora, MX', 'MX');
    expect(onAddress).not.toHaveBeenCalled(); // el domicilio escrito se respeta
  });

  it('si Google no encuentra la dirección lo explica', async () => {
    maps.geocodeAddress.mockResolvedValue(null);
    const { onPoint } = renderPicker({ address: WRITTEN });
    await userEvent.click(geocodeButton() as HTMLElement);
    const dialog = await popup('No encontramos esa dirección');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveTextContent('Revisa el domicilio o marca el punto directamente en el mapa.');
    expect(onPoint).not.toHaveBeenCalled();
  });

  it('si el mapa no está disponible se explica y se quita "Mi ubicación"', async () => {
    renderPicker();
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar la clave' }));
    expect(await popup('El mapa no está disponible')).toHaveTextContent('Maps JavaScript API');
    expect(locateButton()).toBeNull();
  });

  it('con Places, el lugar buscado marca su punto y llena el domicilio; si Places falla se explica', async () => {
    mapsConfig.places = true;
    const place: FoundPlace = { point: { lat: 29.07, lng: -110.95 }, address: FOUND, label: 'Plaza Zaragoza, Hermosillo' };
    maps.newSearchSession.mockResolvedValue({});
    maps.suggestPlaces.mockResolvedValueOnce([{ id: 'p1', primary: 'Plaza Zaragoza', secondary: 'Centro', prediction: {} as google.maps.places.PlacePrediction }]);
    maps.resolvePlace.mockResolvedValue(place);
    const { onPoint, onAddress } = renderPicker({ address: { ...EMPTY_ADDRESS, country_code: 'US' } });
    const search = screen.getByRole('combobox', { name: 'Buscar un lugar o una dirección' });
    await userEvent.type(search, 'Plaza');
    await userEvent.click(await screen.findByRole('option', { name: /Plaza Zaragoza/ }));
    await waitFor(() => expect(onAddress).toHaveBeenCalledExactlyOnceWith(FOUND));
    expect(onPoint).toHaveBeenCalledExactlyOnceWith(place.point);
    expect(maps.suggestPlaces).toHaveBeenCalledWith('Plaza', {}, 'US');
    expect(maps.reverseGeocode).not.toHaveBeenCalled(); // el lugar ya trae su domicilio

    maps.suggestPlaces.mockRejectedValue(new MapsApiError('places', 'denied'));
    await userEvent.clear(search);
    await userEvent.type(search, 'Catedral');
    expect(await popup('La búsqueda de lugares no está disponible')).toHaveTextContent('Places API (New)');
  });
});
