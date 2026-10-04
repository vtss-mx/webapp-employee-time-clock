import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as GoogleMaps from '../../services/maps/googleMaps';
import { MapsApiError, type FoundPlace, type PlaceSuggestion, type SearchOptions } from '../../services/maps/googleMaps';
import type { GeoPoint } from '../../utils/address';
import type * as Geolocation from '../../utils/geolocation';
import type { DeviceLocation } from '../../utils/geolocation';
import { PlaceSearch } from './PlaceSearch';

// Places de Google simulado (el SDK real se valida en navegador).
const maps = vi.hoisted(() => ({
  newSearchSession: vi.fn<() => Promise<unknown>>(),
  suggestPlaces: vi.fn<(input: string, token: unknown, options?: SearchOptions) => Promise<PlaceSuggestion[]>>(),
  resolvePlace: vi.fn<(suggestion: PlaceSuggestion) => Promise<FoundPlace>>(),
}));
vi.mock('../../services/maps/googleMaps', async (importOriginal) => ({ ...(await importOriginal<typeof GoogleMaps>()), mapsService: maps }));
// Ubicación que el dispositivo ya conoce (solo con el permiso ya dado; jsdom no la tiene).
const device = vi.hoisted(() => ({ knownLocation: vi.fn<() => Promise<DeviceLocation | null>>() }));
vi.mock('../../utils/geolocation', async (importOriginal) => ({ ...(await importOriginal<typeof Geolocation>()), knownLocation: device.knownLocation }));

const suggestion = (id: string, primary: string, secondary = '', distanceMeters: number | null = null): PlaceSuggestion => ({
  id,
  primary,
  secondary,
  distanceMeters,
  prediction: {} as google.maps.places.PlacePrediction,
});
const PLAZA = suggestion('p1', 'Plaza Zaragoza', 'Centro, Hermosillo');
const CATEDRAL = suggestion('p2', 'Catedral de Hermosillo', 'Centro');
const PALIZA = suggestion('p3', 'Calle Dr. Paliza 71'); // sin zona
const PLACE: FoundPlace = { point: { lat: 29.0729, lng: -110.9559 }, address: { street: 'Calle Dr. Paliza', city: 'Hermosillo' }, label: 'Plaza Zaragoza, Hermosillo' };
const TOKEN = { session: 1 };
const HERE: GeoPoint = { lat: 29.0729, lng: -110.9559 };
/** Lo que se pide a Google sin punto de referencia. */
const ANYWHERE = { country: undefined, near: null };

/** Promesa que la prueba cumple o rechaza cuando quiere. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Más que la pausa entre teclas: si iba a consultar, ya lo habría hecho. */
const pastDebounce = () => new Promise((resolve) => setTimeout(resolve, 400));

function renderSearch(props: { country?: string; near?: GeoPoint | null; disabled?: boolean } = {}) {
  const onSelect = vi.fn<(place: FoundPlace) => void>();
  const onError = vi.fn<(error: MapsApiError) => void>();
  // Teclas que llegan a lo que contiene al buscador (p. ej. un popup que se cierra con Escape).
  const parentKeys: string[] = [];
  const view = render(
    <div onKeyDown={(event) => parentKeys.push(event.key)}>
      <PlaceSearch {...props} onSelect={onSelect} onError={onError} />
    </div>,
  );
  const input = screen.getByRole('combobox', { name: 'Buscar un lugar o una dirección' });
  const rerender = (next: { country?: string; near?: GeoPoint | null }) =>
    view.rerender(
      <div onKeyDown={(event) => parentKeys.push(event.key)}>
        <PlaceSearch {...props} {...next} onSelect={onSelect} onError={onError} />
      </div>,
    );
  return { ...view, input, onSelect, onError, parentKeys, rerender };
}

const list = () => screen.queryByRole('listbox', { name: 'Lugares encontrados' });
const option = (name: RegExp) => screen.getByRole('option', { name });
const spinner = () => screen.queryByRole('status', { name: 'Cargando' });
const clearButton = () => screen.queryByRole('button', { name: 'Borrar búsqueda' });

beforeEach(() => {
  maps.newSearchSession.mockReset().mockResolvedValue(TOKEN);
  maps.suggestPlaces.mockReset().mockResolvedValue([PLAZA, CATEDRAL, PALIZA]);
  maps.resolvePlace.mockReset().mockResolvedValue(PLACE);
  device.knownLocation.mockReset().mockResolvedValue(null);
});

describe('PlaceSearch: sugerencias', () => {
  it('con menos de 3 letras no consulta a Google ni abre la lista', async () => {
    const { input } = renderSearch();
    await userEvent.click(input); // sin sugerencias, enfocar no abre nada
    await userEvent.type(input, 'Pl');
    await pastDebounce();
    expect(maps.newSearchSession).not.toHaveBeenCalled();
    expect(maps.suggestPlaces).not.toHaveBeenCalled();
    expect(list()).toBeNull();
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('sugiere lugares del país mientras se escribe, con una sola sesión de búsqueda', async () => {
    const { input } = renderSearch({ country: 'MX' });
    await userEvent.type(input, 'Plaza');
    const listbox = await screen.findByRole('listbox', { name: 'Lugares encontrados' });
    expect(maps.suggestPlaces).toHaveBeenCalledExactlyOnceWith('Plaza', TOKEN, { country: 'MX', near: null });
    expect(within(listbox).getAllByRole('option')).toHaveLength(3);
    expect(option(/Plaza Zaragoza/)).toHaveTextContent('Plaza ZaragozaCentro, Hermosillo');
    expect(option(/Calle Dr\. Paliza 71/).querySelector('small')).toBeNull(); // sin zona no hay segunda línea
    expect(screen.getByText('Resultados de Google')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-controls', listbox.id);
    expect(input).toHaveAttribute('aria-activedescendant', option(/Plaza Zaragoza/).id);

    await userEvent.type(input, ' Z');
    await waitFor(() => expect(maps.suggestPlaces).toHaveBeenLastCalledWith('Plaza Z', TOKEN, { country: 'MX', near: null }));
    expect(maps.newSearchSession).toHaveBeenCalledTimes(1); // la misma sesión para toda la búsqueda
  });

  it('flechas para moverse (sin salirse de la lista) y Enter para elegir sin enviar el formulario', async () => {
    const { input, onSelect } = renderSearch();
    await userEvent.type(input, 'Plaza');
    await screen.findByRole('listbox');
    expect(maps.suggestPlaces).toHaveBeenCalledWith('Plaza', TOKEN, ANYWHERE);
    expect(option(/Plaza Zaragoza/)).toHaveAttribute('aria-selected', 'true');

    await userEvent.keyboard('{ArrowDown}');
    expect(option(/Catedral/)).toHaveAttribute('aria-selected', 'true');
    expect(option(/Catedral/)).toHaveClass('select__option', 'is-active');
    expect(option(/Plaza Zaragoza/)).not.toHaveClass('is-active');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(option(/Calle Dr\. Paliza/)).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
    expect(option(/Plaza Zaragoza/)).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowDown}');

    const notPrevented = fireEvent.keyDown(input, { key: 'Enter' });
    expect(notPrevented).toBe(false); // Enter elige: no envía el formulario que contiene al buscador
    expect(list()).toBeNull();
    await waitFor(() => expect(onSelect).toHaveBeenCalledExactlyOnceWith(PLACE));
    expect(maps.resolvePlace).toHaveBeenCalledExactlyOnceWith(CATEDRAL);
    expect(input).toHaveValue('Plaza Zaragoza, Hermosillo');
  });

  it('elegir termina la sesión de búsqueda: la siguiente búsqueda abre otra', async () => {
    const { input, onSelect } = renderSearch();
    await userEvent.type(input, 'Plaza');
    await userEvent.click(await screen.findByRole('option', { name: /Plaza Zaragoza/ }));
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(PLACE));
    await userEvent.clear(input);
    await userEvent.type(input, 'Catedral');
    await waitFor(() => expect(maps.suggestPlaces).toHaveBeenLastCalledWith('Catedral', TOKEN, ANYWHERE));
    expect(maps.newSearchSession).toHaveBeenCalledTimes(2);
  });

  it('Escape cierra la lista sin cerrar lo que la contiene; con la lista cerrada Escape y Enter siguen su curso', async () => {
    const { input, parentKeys } = renderSearch();
    await userEvent.type(input, 'Plaza');
    await screen.findByRole('listbox');
    await userEvent.keyboard('{Escape}');
    expect(list()).toBeNull();
    expect(parentKeys).not.toContain('Escape');

    await userEvent.keyboard('{Escape}{Enter}');
    expect(parentKeys).toEqual(expect.arrayContaining(['Escape', 'Enter']));
    expect(maps.resolvePlace).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).not.toHaveAttribute('aria-controls');
    expect(input).not.toHaveAttribute('aria-activedescendant');

    await userEvent.keyboard('{ArrowDown}'); // la flecha vuelve a abrir las sugerencias
    expect(list()).toBeInTheDocument();
    expect(option(/Catedral/)).toHaveAttribute('aria-selected', 'true');
  });

  it('tocar fuera cierra la lista y volver al buscador la abre otra vez', async () => {
    const { input } = renderSearch();
    await userEvent.type(input, 'Plaza');
    await screen.findByRole('listbox');
    await userEvent.click(document.body);
    expect(list()).toBeNull();
    await userEvent.click(input);
    expect(list()).toBeInTheDocument();
  });

  it('pasar el puntero marca la opción y un clic la elige', async () => {
    const { input, onSelect } = renderSearch();
    await userEvent.type(input, 'Plaza');
    await screen.findByRole('listbox');
    await userEvent.hover(option(/Calle Dr\. Paliza/));
    expect(option(/Calle Dr\. Paliza/)).toHaveClass('is-active');
    await userEvent.click(option(/Calle Dr\. Paliza/));
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(PLACE));
    expect(maps.resolvePlace).toHaveBeenCalledWith(PALIZA);
  });

  it('"Borrar búsqueda" limpia el texto y las sugerencias', async () => {
    const { input } = renderSearch();
    expect(clearButton()).toBeNull(); // sin texto no hay nada que borrar
    await userEvent.type(input, 'Plaza');
    await screen.findByRole('listbox');
    await userEvent.click(clearButton() as HTMLElement);
    expect(input).toHaveValue('');
    expect(list()).toBeNull();
  });

  it('deshabilitado no deja escribir', () => {
    const { input } = renderSearch({ disabled: true });
    expect(input).toBeDisabled();
  });
});

describe('PlaceSearch: respuestas tardías y fallas', () => {
  it('solo cuenta la última búsqueda: una respuesta que llega tarde se ignora', async () => {
    const late = deferred<PlaceSuggestion[]>();
    const current = deferred<PlaceSuggestion[]>();
    maps.suggestPlaces.mockReturnValueOnce(late.promise).mockReturnValueOnce(current.promise);
    const { input } = renderSearch();
    await userEvent.type(input, 'Cat');
    await waitFor(() => expect(maps.suggestPlaces).toHaveBeenCalledTimes(1));
    expect(spinner()).toBeInTheDocument();
    expect(clearButton()).toBeNull(); // mientras busca se ve el indicador, no el botón de borrar

    await userEvent.type(input, 'e');
    late.resolve([CATEDRAL]);
    await waitFor(() => expect(maps.suggestPlaces).toHaveBeenCalledTimes(2));
    expect(list()).toBeNull();
    expect(spinner()).toBeInTheDocument(); // la búsqueda vigente sigue en curso

    current.resolve([PLAZA]);
    expect(await screen.findByRole('option', { name: /Plaza Zaragoza/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Catedral/ })).toBeNull();
    expect(spinner()).toBeNull();
    expect(clearButton()).toBeInTheDocument();
  });

  it('una falla que llega tarde no se informa ni detiene la búsqueda vigente', async () => {
    const late = deferred<PlaceSuggestion[]>();
    maps.suggestPlaces.mockReturnValueOnce(late.promise);
    const { input, onError } = renderSearch();
    await userEvent.type(input, 'Cat');
    await waitFor(() => expect(maps.suggestPlaces).toHaveBeenCalledTimes(1));
    await userEvent.type(input, 'e');
    late.reject(new MapsApiError('places', 'denied'));
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    expect(maps.suggestPlaces).toHaveBeenLastCalledWith('Cate', TOKEN, ANYWHERE);
    expect(onError).not.toHaveBeenCalled();
  });

  it('sin red se avisa y se puede volver a intentar; sin la API habilitada ya no se consulta', async () => {
    const offline = new MapsApiError('places', 'failed', 'Failed to fetch');
    const denied = new MapsApiError('places', 'denied', 'REQUEST_DENIED');
    maps.suggestPlaces.mockRejectedValueOnce(offline).mockRejectedValueOnce(denied);
    const { input, onError } = renderSearch();
    await userEvent.type(input, 'Plaza');
    await waitFor(() => expect(onError).toHaveBeenCalledExactlyOnceWith(offline));
    await waitFor(() => expect(spinner()).toBeNull());

    await userEvent.type(input, ' Z');
    await waitFor(() => expect(onError).toHaveBeenLastCalledWith(denied));
    expect(maps.suggestPlaces).toHaveBeenCalledTimes(2);

    await userEvent.type(input, 'aragoza');
    await pastDebounce();
    expect(maps.suggestPlaces).toHaveBeenCalledTimes(2);
    expect(spinner()).toBeNull();
    expect(list()).toBeNull();
  });

  it('cualquier falla se informa (nunca se calla) y la siguiente búsqueda abre otra sesión', async () => {
    maps.newSearchSession.mockRejectedValueOnce(new TypeError('importLibrary failed'));
    const { input, onError } = renderSearch();
    await userEvent.type(input, 'Plaza');
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    const reported = onError.mock.calls[0][0];
    expect(reported).toBeInstanceOf(MapsApiError);
    expect([reported.api, reported.problem]).toEqual(['places', 'failed']);
    expect(list()).toBeNull();
    // Una falla pasajera («failed») no deja la sesión rota: al escribir otra vez se busca con una nueva.
    await userEvent.type(input, ' Zaragoza');
    expect(await screen.findByRole('option', { name: /Plaza Zaragoza/ })).toBeInTheDocument();
    expect(maps.newSearchSession).toHaveBeenCalledTimes(2);
  });

  it('si falla traer el lugar elegido se avisa (también un error inesperado); el texto no cambia', async () => {
    const problem = new MapsApiError('places', 'failed', 'sin ubicación');
    maps.resolvePlace.mockRejectedValueOnce(problem).mockRejectedValueOnce(new Error('inesperado'));
    const { input, onSelect, onError } = renderSearch();
    await userEvent.type(input, 'Plaza');
    await userEvent.click(await screen.findByRole('option', { name: /Plaza Zaragoza/ }));
    await waitFor(() => expect(onError).toHaveBeenCalledExactlyOnceWith(problem));
    expect(input).toHaveValue('Plaza');

    await userEvent.click(input); // de vuelta al buscador: la lista se abre otra vez
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await waitFor(() => expect(maps.resolvePlace).toHaveBeenLastCalledWith(CATEDRAL));
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(2));
    expect(onError).toHaveBeenLastCalledWith(expect.objectContaining({ api: 'places', problem: 'failed' }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(input).toHaveValue('Plaza');
  });

  it('elegir un lugar no abre otra búsqueda con su texto (ni otra sesión de Google)', async () => {
    const { input, onSelect } = renderSearch();
    await userEvent.type(input, 'Plaza');
    await userEvent.click(await screen.findByRole('option', { name: /Plaza Zaragoza/ }));
    await waitFor(() => expect(onSelect).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 400)); // más que la pausa entre teclas
    expect(maps.suggestPlaces).toHaveBeenCalledTimes(1);
    expect(list()).toBeNull();
  });

  it('si se sale mientras Google trae el lugar elegido, no se aplica', async () => {
    const pending = deferred<FoundPlace>();
    maps.resolvePlace.mockReturnValue(pending.promise);
    const { input, onSelect, unmount } = renderSearch();
    await userEvent.type(input, 'Plaza');
    await userEvent.click(await screen.findByRole('option', { name: /Plaza Zaragoza/ }));
    expect(maps.resolvePlace).toHaveBeenCalledWith(PLAZA);
    unmount();
    pending.resolve(PLACE);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('PlaceSearch: los lugares más cercanos', () => {
  it('con un punto de referencia pide los cercanos y muestra la distancia de cada uno', async () => {
    maps.suggestPlaces.mockResolvedValue([suggestion('a', 'Oxxo Centro', 'Hermosillo', 350), suggestion('b', 'Oxxo Norte', 'Hermosillo', 1500), suggestion('c', 'Oxxo', '')]);
    const { input } = renderSearch({ country: 'MX', near: HERE });
    await userEvent.type(input, 'Oxxo');
    await screen.findByRole('listbox');
    expect(maps.suggestPlaces).toHaveBeenCalledExactlyOnceWith('Oxxo', TOKEN, { country: 'MX', near: HERE });
    expect(option(/Oxxo Centro/)).toHaveTextContent('350 m');
    expect(option(/Oxxo Norte/).querySelector('.place-search__distance')).toHaveTextContent('1.5 km');
    expect(option(/^Oxxo$/).querySelector('.place-search__distance')).toBeNull(); // sin distancia conocida
    expect(screen.getByText('Los más cercanos primero · Resultados de Google')).toBeInTheDocument();
  });

  it('mover la referencia (el mapa) no lanza otra búsqueda; la siguiente ya la usa', async () => {
    const { input, rerender } = renderSearch({ near: HERE });
    await userEvent.type(input, 'Plaza');
    await screen.findByRole('listbox');
    const moved = { lat: 19.4326, lng: -99.1332 };
    rerender({ near: moved });
    await pastDebounce();
    expect(maps.suggestPlaces).toHaveBeenCalledTimes(1);
    await userEvent.type(input, ' Z');
    await waitFor(() => expect(maps.suggestPlaces).toHaveBeenLastCalledWith('Plaza Z', TOKEN, { country: undefined, near: moved }));
  });

  it('sin referencia usa la ubicación que el dispositivo ya conoce (se consulta una vez, al enfocar)', async () => {
    device.knownLocation.mockResolvedValue({ latitude: 29.1, longitude: -110.9, accuracy: 40 });
    const { input } = renderSearch();
    expect(device.knownLocation).not.toHaveBeenCalled(); // nada se consulta hasta usar el buscador
    await userEvent.click(input);
    await userEvent.type(input, 'Plaza');
    await screen.findByRole('listbox');
    expect(maps.suggestPlaces).toHaveBeenCalledWith('Plaza', TOKEN, { country: undefined, near: { lat: 29.1, lng: -110.9 } });
    await userEvent.click(document.body);
    await userEvent.click(input);
    expect(device.knownLocation).toHaveBeenCalledTimes(1);
  });

  it('el punto de referencia manda sobre la ubicación del dispositivo', async () => {
    device.knownLocation.mockResolvedValue({ latitude: 1, longitude: 2, accuracy: 10 });
    const { input } = renderSearch({ near: HERE });
    await userEvent.click(input);
    await userEvent.type(input, 'Plaza');
    await waitFor(() => expect(maps.suggestPlaces).toHaveBeenCalledWith('Plaza', TOKEN, { country: undefined, near: HERE }));
  });
});

describe('PlaceSearch: solo cuenta lo último que se escribió', () => {
  it('si se escribe más mientras se abre la sesión, no se pide a Google la búsqueda anterior', async () => {
    const opening = deferred<unknown>();
    maps.newSearchSession.mockReturnValueOnce(opening.promise);
    const { input } = renderSearch();
    await userEvent.type(input, 'Cat');
    await waitFor(() => expect(maps.newSearchSession).toHaveBeenCalledTimes(1));
    await userEvent.type(input, 'edral');
    opening.resolve(TOKEN);
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    expect(maps.suggestPlaces).toHaveBeenCalledExactlyOnceWith('Catedral', TOKEN, ANYWHERE);
  });

  it('borrar hasta menos de 3 letras mientras busca deja de indicar que busca', async () => {
    maps.suggestPlaces.mockReturnValue(new Promise<never>(() => undefined));
    const { input } = renderSearch();
    await userEvent.type(input, 'Plaza');
    await waitFor(() => expect(spinner()).toBeInTheDocument());
    await userEvent.type(input, '{Backspace}{Backspace}{Backspace}');
    expect(spinner()).toBeNull();
    expect(clearButton()).toBeInTheDocument();
    expect(list()).toBeNull();
  });
});
