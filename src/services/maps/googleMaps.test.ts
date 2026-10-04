import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, mockFetch } from '../../test/http';
import type { GeoPoint } from '../../utils/address';
import { MapsApiError, mapsService, type PlaceSuggestion } from './googleMaps';

// Configuración de Google Maps que cada prueba ajusta (clave y APIs habilitadas en la clave).
const mapsConfig = vi.hoisted(() => ({ apiKey: 'clave de prueba', places: true, geocoding: true, geolocation: true }));
vi.mock('../../utils/config', () => ({ config: { maps: mapsConfig } }));

const DEFAULTS = { ...mapsConfig };
const POINT: GeoPoint = { lat: 29.0729, lng: -110.9559 };
const FOUND = { street: 'Calle Dr. Paliza', exterior_number: '71', postal_code: '83000', country_code: 'MX', state: 'Sonora', municipality: 'Hermosillo', city: 'Hermosillo' };
const globals = window as unknown as Record<string, (() => void) | undefined>;

/** Módulo recién cargado: sin SDK pedido antes ni rechazos de la clave registrados. */
async function freshModule() {
  vi.resetModules();
  return import('./googleMaps');
}

/** Scripts del SDK que el cargador agregó a la página. */
const sdkScripts = () => [...document.head.querySelectorAll<HTMLScriptElement>('script[src^="https://maps.googleapis.com/"]')];

/** Error con el que terminó una promesa (o undefined si se cumplió). */
const failure = (promise: Promise<unknown>) => promise.then(() => undefined, (error: unknown) => error);

// --- SDK simulado (el real se valida en navegador) ---

const component = (long_name: string, types: string[], short_name = long_name) => ({ long_name, short_name, types });
const PALIZA = [
  component('Calle Dr. Paliza', ['route']),
  component('71', ['street_number']),
  component('83000', ['postal_code']),
  component('México', ['country', 'political'], 'mx'),
  component('Sonora', ['administrative_area_level_1', 'political'], 'Son.'),
  component('Hermosillo', ['administrative_area_level_2', 'political']),
  component('Hermosillo', ['locality', 'political']),
];
const geocoded = (types: string[], formatted_address: string, address_components: unknown[], point = POINT) => ({
  types,
  formatted_address,
  address_components,
  geometry: { location: { toJSON: () => point } },
});
const CENTRO = geocoded(['neighborhood', 'political'], 'Centro, Hermosillo, Son., México', [component('Centro', ['neighborhood'])], { lat: 29.07, lng: -110.95 });
const STREET = geocoded(['street_address'], 'Calle Dr. Paliza 71, Centro, 83000 Hermosillo, Son., México', PALIZA);

class FakeSessionToken {}

function stubSdk() {
  const geocode = vi.fn<(request: google.maps.GeocoderRequest) => Promise<{ results: unknown[] }>>();
  const fetchAutocompleteSuggestions = vi.fn<(request: google.maps.places.AutocompleteRequest) => Promise<{ suggestions: unknown[] }>>();
  class Geocoder {
    geocode = geocode;
  }
  const libraries: Record<string, unknown> = {
    geocoding: { Geocoder },
    places: { AutocompleteSessionToken: FakeSessionToken, AutocompleteSuggestion: { fetchAutocompleteSuggestions } },
  };
  const importLibrary = vi.fn((name: string) => Promise.resolve(libraries[name]));
  vi.stubGlobal('google', { maps: { importLibrary } });
  return { geocode, fetchAutocompleteSuggestions, importLibrary };
}

const textOf = (text: string | undefined) => (text === undefined ? null : { text });
const prediction = (placeId: string, text: string, main?: string, secondary?: string) => ({ placeId, text: { text }, mainText: textOf(main), secondaryText: textOf(secondary) });

interface FakePlaceFields {
  location?: { toJSON: () => GeoPoint };
  addressComponents?: Array<{ longText: string | null; shortText: string | null; types: string[] }>;
  formattedAddress?: string | null;
}

/** Sugerencia cuyo lugar trae sus datos al pedirlos (`fetchFields`), como el SDK. */
function suggestionFor(fields: FakePlaceFields | Error) {
  const place: FakePlaceFields & { fetchFields: ReturnType<typeof vi.fn> } = {
    fetchFields: vi.fn(() => {
      if (fields instanceof Error) return Promise.reject(fields);
      Object.assign(place, fields);
      return Promise.resolve({ place });
    }),
  };
  const toPlace = vi.fn(() => place);
  const suggestion: PlaceSuggestion = {
    id: 'p1',
    primary: 'Plaza Zaragoza',
    secondary: 'Centro, Hermosillo',
    distanceMeters: null,
    prediction: { toPlace } as unknown as google.maps.places.PlacePrediction,
  };
  return { suggestion, place, toPlace };
}

beforeEach(() => Object.assign(mapsConfig, DEFAULTS));
afterEach(() => {
  sdkScripts().forEach((script) => script.remove());
  delete globals.__timeClockMapsReady;
  delete globals.gm_authFailure;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('loadGoogleMaps', () => {
  it('sin clave no pide el SDK: el mapa queda apagado', async () => {
    mapsConfig.apiKey = '';
    const maps = await freshModule();
    const error = await failure(maps.loadGoogleMaps());
    expect(error).toBeInstanceOf(maps.MapsApiError);
    expect(error).toMatchObject({ name: 'MapsApiError', api: 'maps', problem: 'off', message: 'maps: off' });
    expect(sdkScripts()).toHaveLength(0);
  });

  it('si otra pantalla ya cargó el SDK no agrega otro script', async () => {
    stubSdk();
    const { loadGoogleMaps } = await freshModule();
    await expect(loadGoogleMaps()).resolves.toBeUndefined();
    expect(sdkScripts()).toHaveLength(0);
  });

  it('agrega el script una sola vez (clave, español, México y su aviso) y termina cuando Google avisa', async () => {
    vi.useFakeTimers();
    mapsConfig.apiKey = 'clave/con espacios';
    const { loadGoogleMaps } = await freshModule();
    const first = loadGoogleMaps();
    expect(loadGoogleMaps()).toBe(first); // otra pantalla mientras carga: la misma espera
    expect(sdkScripts()).toHaveLength(1);
    const script = sdkScripts()[0];
    const url = new URL(script.src);
    expect(`${url.origin}${url.pathname}`).toBe('https://maps.googleapis.com/maps/api/js');
    expect(Object.fromEntries(url.searchParams)).toEqual({ key: 'clave/con espacios', v: 'weekly', loading: 'async', language: 'es', region: 'MX', callback: '__timeClockMapsReady' });
    expect(script.async).toBe(true);

    globals.__timeClockMapsReady?.();
    await expect(first).resolves.toBeUndefined();
    // Ya cargado: el tiempo límite se canceló y no se vuelve a pedir el script.
    vi.advanceTimersByTime(60_000);
    await expect(loadGoogleMaps()).resolves.toBeUndefined();
    expect(sdkScripts()).toHaveLength(1);
  });

  it('sin red (el script no carga) falla como "failed" y se puede reintentar', async () => {
    const maps = await freshModule();
    const attempt = maps.loadGoogleMaps();
    sdkScripts()[0].dispatchEvent(new Event('error'));
    const error = await failure(attempt);
    expect(error).toBeInstanceOf(maps.MapsApiError);
    expect(error).toMatchObject({ api: 'maps', problem: 'failed', message: 'maps: failed (script)' });

    const retry = maps.loadGoogleMaps();
    expect(retry).not.toBe(attempt);
    expect(sdkScripts()).toHaveLength(2);
    globals.__timeClockMapsReady?.();
    await expect(retry).resolves.toBeUndefined();
  });

  it('si Google no responde en 20 s el mapa se da por no disponible (no se queda cargando)', async () => {
    vi.useFakeTimers();
    const { loadGoogleMaps } = await freshModule();
    const attempt = loadGoogleMaps();
    const outcome = failure(attempt);
    vi.advanceTimersByTime(19_999);
    expect(loadGoogleMaps()).toBe(attempt); // aún esperando a Google
    vi.advanceTimersByTime(1);
    expect(await outcome).toMatchObject({ api: 'maps', problem: 'failed', message: 'maps: failed (timeout)' });

    const retry = loadGoogleMaps();
    expect(retry).not.toBe(attempt);
    expect(sdkScripts()).toHaveLength(2);
    globals.__timeClockMapsReady?.();
    await expect(retry).resolves.toBeUndefined();
  });
});

describe('onMapsAuthFailure', () => {
  it('avisa cuando Google rechaza la clave, también a quien se suscribe después; cancelar deja de avisar', async () => {
    const { loadGoogleMaps, onMapsAuthFailure } = await freshModule();
    const listening = vi.fn();
    const gone = vi.fn();
    onMapsAuthFailure(listening);
    const stop = onMapsAuthFailure(gone);
    stop();
    expect(listening).not.toHaveBeenCalled(); // sin rechazo todavía

    const loaded = loadGoogleMaps();
    globals.gm_authFailure?.();
    expect(listening).toHaveBeenCalledTimes(1);
    expect(gone).not.toHaveBeenCalled();

    const late = vi.fn();
    onMapsAuthFailure(late);
    expect(late).toHaveBeenCalledTimes(1); // el mapa que se abre después también se entera
    globals.__timeClockMapsReady?.();
    await loaded;
  });
});

describe('mapsService: APIs apagadas en la configuración', () => {
  it.each([
    ['sin clave', { apiKey: '' }],
    ['sin la API', { geocoding: false, places: false, geolocation: false }],
  ])('%s cada función responde "off" sin llamar a Google', async (_case, change) => {
    Object.assign(mapsConfig, change);
    const sdk = stubSdk();
    const { fn } = mockFetch(jsonResponse({}));
    const { suggestion, toPlace } = suggestionFor({});
    const calls: Array<[string, Promise<unknown>]> = [
      ['geocoding', mapsService.reverseGeocode(POINT)],
      ['geocoding', mapsService.geocodeAddress('Calle Dr. Paliza 71', 'MX')],
      ['places', mapsService.newSearchSession()],
      ['places', mapsService.suggestPlaces('Plaza', new FakeSessionToken())],
      ['places', mapsService.resolvePlace(suggestion)],
      ['geolocation', mapsService.approximateLocation()],
    ];
    for (const [api, call] of calls) {
      const error = await failure(call);
      expect(error).toBeInstanceOf(MapsApiError);
      expect(error).toMatchObject({ api, problem: 'off' });
    }
    expect(sdk.importLibrary).not.toHaveBeenCalled();
    expect(toPlace).not.toHaveBeenCalled();
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('mapsService.reverseGeocode', () => {
  it('elige la dirección exacta antes que la colonia y la convierte en domicilio', async () => {
    const sdk = stubSdk();
    sdk.geocode.mockResolvedValue({ results: [CENTRO, STREET] });
    await expect(mapsService.reverseGeocode(POINT)).resolves.toEqual(FOUND);
    expect(sdk.importLibrary).toHaveBeenCalledWith('geocoding');
    expect(sdk.geocode).toHaveBeenCalledWith({ location: POINT, language: 'es' });
  });

  it('junta TODOS los resultados: lo que le falte a la dirección exacta sale de los demás (nunca el número)', async () => {
    const sdk = stubSdk();
    const withoutZone = geocoded(['street_address'], 'Calle Dr. Paliza 71', PALIZA.slice(0, 2)); // calle y número
    const postal = geocoded(['postal_code'], '83000 Hermosillo, Son., México', [component('83000', ['postal_code']), ...PALIZA.slice(3)]);
    const otherHouse = geocoded(['premise'], 'Calle Dr. Paliza 99', [component('99', ['street_number']), component('Calle Dr. Paliza', ['route'])]);
    // Google ordena por precisión, pero el más preciso manda aunque llegue después de la colonia.
    sdk.geocode.mockResolvedValue({ results: [CENTRO, withoutZone, otherHouse, postal] });
    await expect(mapsService.reverseGeocode(POINT)).resolves.toEqual(FOUND);
  });

  it('si Google no responde a tiempo es una falla pasajera (no se queda buscando)', async () => {
    vi.useFakeTimers();
    stubSdk().geocode.mockReturnValue(new Promise<never>(() => undefined));
    const pending = failure(mapsService.reverseGeocode(POINT));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toMatchObject({ api: 'geocoding', problem: 'failed', message: 'geocoding: failed (timeout)' });
  });

  it('sin dirección exacta usa el primer resultado; sin resultados (o ZERO_RESULTS) no llena nada', async () => {
    const sdk = stubSdk();
    sdk.geocode.mockResolvedValueOnce({ results: [CENTRO] });
    await expect(mapsService.reverseGeocode(POINT)).resolves.toEqual({});
    sdk.geocode.mockResolvedValueOnce({ results: [geocoded(['locality'], 'Hermosillo, Son., México', PALIZA.slice(3))] });
    await expect(mapsService.reverseGeocode(POINT)).resolves.toEqual({ country_code: 'MX', state: 'Sonora', municipality: 'Hermosillo', city: 'Hermosillo' });
    sdk.geocode.mockResolvedValueOnce({ results: [] });
    await expect(mapsService.reverseGeocode(POINT)).resolves.toEqual({});
    sdk.geocode.mockRejectedValueOnce({ code: 'ZERO_RESULTS' });
    await expect(mapsService.reverseGeocode(POINT)).resolves.toEqual({});
  });

  it.each([
    'REQUEST_DENIED: This API project is not authorized to use this API.',
    'PERMISSION_DENIED',
    'Geocoding API has not been used in project 123 before',
    'This API is not activated on your API project.',
    'ApiNotActivatedMapError',
    'The provided API key is invalid.',
    'API disabled',
    'HTTP 403',
  ])('"%s": la clave no tiene la API habilitada (denied)', async (message) => {
    stubSdk().geocode.mockRejectedValue(new Error(message));
    const error = await failure(mapsService.reverseGeocode(POINT));
    expect(error).toBeInstanceOf(MapsApiError);
    expect(error).toMatchObject({ api: 'geocoding', problem: 'denied', message: `geocoding: denied (${message})` });
  });

  it('un rechazo con código de Google (sin Error) también se clasifica', async () => {
    stubSdk().geocode.mockRejectedValue({ code: 'REQUEST_DENIED' });
    expect(await failure(mapsService.reverseGeocode(POINT))).toMatchObject({ api: 'geocoding', problem: 'denied' });
  });

  it('cualquier otra falla es "failed" con el detalle acotado', async () => {
    const sdk = stubSdk();
    sdk.geocode.mockRejectedValueOnce(new Error('OVER_QUERY_LIMIT'));
    expect(await failure(mapsService.reverseGeocode(POINT))).toMatchObject({ api: 'geocoding', problem: 'failed', message: 'geocoding: failed (OVER_QUERY_LIMIT)' });
    sdk.geocode.mockRejectedValueOnce(null);
    expect(await failure(mapsService.reverseGeocode(POINT))).toMatchObject({ problem: 'failed', message: 'geocoding: failed (null)' });
    sdk.geocode.mockRejectedValueOnce(new Error('x'.repeat(300)));
    expect(await failure(mapsService.reverseGeocode(POINT))).toMatchObject({ message: `geocoding: failed (${'x'.repeat(160)})` });
  });

  it('si el SDK no carga, el problema del mapa llega tal cual', async () => {
    const maps = await freshModule();
    const pending = failure(maps.mapsService.reverseGeocode(POINT));
    await vi.waitFor(() => expect(sdkScripts()).toHaveLength(1));
    sdkScripts()[0].dispatchEvent(new Event('error'));
    expect(await pending).toMatchObject({ api: 'maps', problem: 'failed', message: 'maps: failed (script)' });
  });
});

describe('mapsService.geocodeAddress', () => {
  it('devuelve el punto, el domicilio normalizado y el texto de Google de la mejor coincidencia', async () => {
    const sdk = stubSdk();
    sdk.geocode.mockResolvedValue({ results: [CENTRO, STREET] });
    await expect(mapsService.geocodeAddress('Calle Dr. Paliza 71, Hermosillo', 'MX')).resolves.toEqual({
      point: POINT,
      address: FOUND,
      label: 'Calle Dr. Paliza 71, Centro, 83000 Hermosillo, Son., México',
    });
    expect(sdk.geocode).toHaveBeenCalledWith({ address: 'Calle Dr. Paliza 71, Hermosillo', region: 'MX', language: 'es' });
  });

  it('sin resultados (vacío o ZERO_RESULTS) responde null; otras fallas se clasifican', async () => {
    const sdk = stubSdk();
    sdk.geocode.mockResolvedValueOnce({ results: [] });
    await expect(mapsService.geocodeAddress('Nada', 'MX')).resolves.toBeNull();
    sdk.geocode.mockRejectedValueOnce({ code: 'ZERO_RESULTS' });
    await expect(mapsService.geocodeAddress('Nada', 'MX')).resolves.toBeNull();
    sdk.geocode.mockRejectedValueOnce(new Error('REQUEST_DENIED'));
    expect(await failure(mapsService.geocodeAddress('Nada', 'MX'))).toMatchObject({ api: 'geocoding', problem: 'denied' });
    sdk.geocode.mockRejectedValueOnce(new Error('UNKNOWN_ERROR'));
    expect(await failure(mapsService.geocodeAddress('Nada', 'MX'))).toMatchObject({ api: 'geocoding', problem: 'failed' });
  });
});

describe('mapsService: búsqueda de lugares', () => {
  it('abre una sesión de búsqueda con el SDK de Places', async () => {
    const sdk = stubSdk();
    await expect(mapsService.newSearchSession()).resolves.toBeInstanceOf(FakeSessionToken);
    expect(sdk.importLibrary).toHaveBeenCalledWith('places');
  });

  it('si el SDK no da la sesión de búsqueda, la falla llega como MapsApiError (nunca otro error)', async () => {
    const sdk = stubSdk();
    sdk.importLibrary.mockRejectedValueOnce(new TypeError('Places API (New) has not been used in project'));
    await expect(mapsService.newSearchSession()).rejects.toMatchObject({ api: 'places', problem: 'denied' });
  });

  it('sugiere lugares del país del domicilio (nombre y zona; sin nombre corto usa el texto completo)', async () => {
    const sdk = stubSdk();
    const plaza = prediction('p1', 'Plaza Zaragoza, Centro, Hermosillo', 'Plaza Zaragoza', 'Centro, Hermosillo');
    const street = prediction('p2', 'Calle 5 de Mayo 12');
    sdk.fetchAutocompleteSuggestions.mockResolvedValue({ suggestions: [{ placePrediction: plaza }, { placePrediction: street }, { placePrediction: null }] });
    const token = new FakeSessionToken();
    await expect(mapsService.suggestPlaces('Plaza', token, { country: 'US' })).resolves.toEqual([
      { id: 'p1', primary: 'Plaza Zaragoza', secondary: 'Centro, Hermosillo', distanceMeters: null, prediction: plaza },
      { id: 'p2', primary: 'Calle 5 de Mayo 12', secondary: '', distanceMeters: null, prediction: street },
    ]);
    // Sin punto de referencia: ni distancia ni zona preferida (Google ordena por relevancia).
    expect(sdk.fetchAutocompleteSuggestions).toHaveBeenCalledWith({ input: 'Plaza', sessionToken: token, language: 'es', region: 'us', includedRegionCodes: ['us'] });
    expect(sdk.fetchAutocompleteSuggestions.mock.calls[0][0]).not.toHaveProperty('origin');
  });

  it('con un punto de referencia: prefiere su zona (50 km) y devuelve las 5 más cercanas primero', async () => {
    const sdk = stubSdk();
    const at = (placeId: string, distanceMeters: number | null) => ({ placePrediction: { ...prediction(placeId, `Lugar ${placeId}`), distanceMeters } });
    // Google responde por relevancia; las de distancia desconocida van al final, en el orden de Google.
    sdk.fetchAutocompleteSuggestions.mockResolvedValue({
      suggestions: [at('lejos', 48_000), at('sin-a', null), at('cerca', 350), at('medio', 1200), at('sin-b', null), at('aqui', 0), at('otro', 9000)],
    });
    const token = new FakeSessionToken();
    const found = await mapsService.suggestPlaces('Oxxo', token, { country: 'MX', near: POINT });
    expect(found.map((s) => [s.id, s.distanceMeters])).toEqual([
      ['aqui', 0],
      ['cerca', 350],
      ['medio', 1200],
      ['otro', 9000],
      ['lejos', 48_000],
    ]);
    expect(sdk.fetchAutocompleteSuggestions).toHaveBeenCalledWith({
      input: 'Oxxo',
      sessionToken: token,
      language: 'es',
      region: 'mx',
      includedRegionCodes: ['mx'],
      origin: POINT,
      locationBias: { center: POINT, radius: 50_000 },
    });

    sdk.fetchAutocompleteSuggestions.mockResolvedValue({ suggestions: [at('sin-a', null), at('cerca', 350), at('sin-b', null)] });
    const fewer = await mapsService.suggestPlaces('Oxxo', token, { near: POINT });
    expect(fewer.map((s) => s.id)).toEqual(['cerca', 'sin-a', 'sin-b']);
  });

  it('sin país busca en todo el mundo con preferencia por México', async () => {
    const sdk = stubSdk();
    sdk.fetchAutocompleteSuggestions.mockResolvedValue({ suggestions: [] });
    const token = new FakeSessionToken();
    await expect(mapsService.suggestPlaces('Plaza', token)).resolves.toEqual([]);
    await expect(mapsService.suggestPlaces('Plaza', token, { country: '', near: null })).resolves.toEqual([]);
    for (const [request] of sdk.fetchAutocompleteSuggestions.mock.calls) expect(request).toMatchObject({ region: 'mx', includedRegionCodes: undefined });
  });

  it('una falla de Places se clasifica (API no habilitada)', async () => {
    stubSdk().fetchAutocompleteSuggestions.mockRejectedValue(new Error('Places API (New) has not been used in project 123 before or it is disabled'));
    const error = await failure(mapsService.suggestPlaces('Plaza', new FakeSessionToken(), { country: 'MX' }));
    expect(error).toBeInstanceOf(MapsApiError);
    expect(error).toMatchObject({ api: 'places', problem: 'denied' });
  });

  it('si Google no sugiere a tiempo es una falla pasajera (la lista no se queda buscando)', async () => {
    vi.useFakeTimers();
    stubSdk().fetchAutocompleteSuggestions.mockReturnValue(new Promise<never>(() => undefined));
    const pending = failure(mapsService.suggestPlaces('Plaza', new FakeSessionToken()));
    await vi.advanceTimersByTimeAsync(9_999);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toMatchObject({ api: 'places', problem: 'failed', message: 'places: failed (timeout)' });
  });

  it('el lugar elegido trae su punto, su domicilio y su dirección (completo: no se geocodifica)', async () => {
    const sdk = stubSdk();
    const { suggestion, place } = suggestionFor({
      location: { toJSON: () => POINT },
      addressComponents: PALIZA.map((p) => ({ longText: p.long_name, shortText: p.short_name, types: p.types })),
      formattedAddress: 'Plaza Zaragoza, Centro, 83000 Hermosillo, Son., México',
    });
    await expect(mapsService.resolvePlace(suggestion)).resolves.toEqual({ point: POINT, address: FOUND, label: 'Plaza Zaragoza, Centro, 83000 Hermosillo, Son., México' });
    expect(place.fetchFields).toHaveBeenCalledWith({ fields: ['location', 'addressComponents', 'formattedAddress'] });
    expect(sdk.geocode).not.toHaveBeenCalled();
  });

  it('sin dirección usa el nombre sugerido; sin componentes (o vacíos) ni geocodificación, el domicilio no se llena', async () => {
    stubSdk().geocode.mockResolvedValue({ results: [] });
    const bare = suggestionFor({ location: { toJSON: () => POINT }, formattedAddress: null });
    await expect(mapsService.resolvePlace(bare.suggestion)).resolves.toEqual({ point: POINT, address: {}, label: 'Plaza Zaragoza' });
    const empty = suggestionFor({ location: { toJSON: () => POINT }, addressComponents: [{ longText: null, shortText: null, types: ['route'] }] });
    await expect(mapsService.resolvePlace(empty.suggestion)).resolves.toMatchObject({ address: {} });
  });

  describe('lugar al que le faltan datos de su zona (p. ej. un negocio sin código postal)', () => {
    /** Un negocio con calle y número, pero sin código postal, estado ni municipio. */
    const business = () =>
      suggestionFor({
        location: { toJSON: () => POINT },
        addressComponents: [
          { longText: '71', shortText: '71', types: ['street_number'] },
          { longText: 'Calle Dr. Paliza', shortText: 'Calle Dr. Paliza', types: ['route'] },
        ],
        formattedAddress: 'Plaza Zaragoza',
      });
    const NEIGHBOR = geocoded(['street_address'], 'Calle Dr. Paliza 99', [component('99', ['street_number']), component('Otra calle', ['route']), ...PALIZA.slice(2)]);

    it('se completa con la geocodificación de su punto (el número y la calle del lugar se respetan)', async () => {
      const sdk = stubSdk();
      sdk.geocode.mockResolvedValue({ results: [NEIGHBOR] });
      await expect(mapsService.resolvePlace(business().suggestion)).resolves.toEqual({ point: POINT, address: FOUND, label: 'Plaza Zaragoza' });
      expect(sdk.geocode).toHaveBeenCalledExactlyOnceWith({ location: POINT, language: 'es' });
    });

    it('es de mejor esfuerzo: sin Geocoding, con una falla o si tarda, queda lo que trae el lugar (sin error)', async () => {
      const OWN = { street: 'Calle Dr. Paliza', exterior_number: '71' };
      const sdk = stubSdk();
      mapsConfig.geocoding = false;
      await expect(mapsService.resolvePlace(business().suggestion)).resolves.toMatchObject({ address: OWN });
      expect(sdk.geocode).not.toHaveBeenCalled();

      mapsConfig.geocoding = true;
      sdk.geocode.mockRejectedValueOnce(new Error('REQUEST_DENIED'));
      await expect(mapsService.resolvePlace(business().suggestion)).resolves.toEqual({ point: POINT, address: OWN, label: 'Plaza Zaragoza' });

      vi.useFakeTimers();
      sdk.geocode.mockReturnValueOnce(new Promise<never>(() => undefined));
      const slow = mapsService.resolvePlace(business().suggestion);
      await vi.advanceTimersByTimeAsync(3_000); // no espera los 10 s de una petición: es accesorio
      await expect(slow).resolves.toMatchObject({ address: OWN });
    });
  });

  it('un lugar sin ubicación o una falla al pedir sus datos se informan', async () => {
    const error = await failure(mapsService.resolvePlace(suggestionFor({ formattedAddress: 'Sin punto' }).suggestion));
    expect(error).toBeInstanceOf(MapsApiError);
    expect(error).toMatchObject({ api: 'places', problem: 'failed', message: 'places: failed (sin ubicación)' });
    expect(await failure(mapsService.resolvePlace(suggestionFor(new Error('PERMISSION_DENIED')).suggestion))).toMatchObject({ api: 'places', problem: 'denied' });
  });

  it('si Google no trae los datos del lugar a tiempo es una falla pasajera', async () => {
    vi.useFakeTimers();
    const { suggestion, place } = suggestionFor({});
    place.fetchFields.mockReturnValue(new Promise<never>(() => undefined));
    const pending = failure(mapsService.resolvePlace(suggestion));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toMatchObject({ api: 'places', problem: 'failed', message: 'places: failed (timeout)' });
  });
});

describe('mapsService.approximateLocation', () => {
  it('estima la ubicación por red con la Geolocation API de Google', async () => {
    const { calls } = mockFetch(jsonResponse({ location: { lat: 19.43, lng: -99.13 }, accuracy: 1500 }));
    await expect(mapsService.approximateLocation()).resolves.toEqual({ point: { lat: 19.43, lng: -99.13 }, accuracy: 1500 });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://www.googleapis.com/geolocation/v1/geolocate?key=clave%20de%20prueba');
    expect(calls[0].init).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"considerIp":true}' });
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal); // con tiempo límite: nunca se queda esperando
  });

  it('sin red falla como "failed"', async () => {
    mockFetch();
    const error = await failure(mapsService.approximateLocation());
    expect(error).toBeInstanceOf(MapsApiError);
    expect(error).toMatchObject({ api: 'geolocation', problem: 'failed', message: 'geolocation: failed (Failed to fetch)' });
  });

  it('403: la clave no tiene la API; otro estado: falla de Google', async () => {
    mockFetch(jsonResponse({}, 403), jsonResponse({}, 500));
    expect(await failure(mapsService.approximateLocation())).toMatchObject({ api: 'geolocation', problem: 'denied', message: 'geolocation: denied (403)' });
    expect(await failure(mapsService.approximateLocation())).toMatchObject({ api: 'geolocation', problem: 'failed', message: 'geolocation: failed (500)' });
  });
});
