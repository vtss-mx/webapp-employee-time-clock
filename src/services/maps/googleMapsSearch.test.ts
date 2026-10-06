import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n/core';
import { CENTRO, FakeSessionToken, failure, FOUND, geocoded, PALIZA, POINT, prediction, stubSdk } from '../../test/googleMapsSdk';
import type { GeoPoint } from '../../utils/address';
import type * as GoogleMaps from './googleMaps';
import { mapsService } from './googleMaps';

/**
 * Buscador de lugares: Autocomplete de Places (lo más rápido) y, cuando Places está apagado, negado o
 * falla, la geocodificación de lo escrito con las mismas filas, distancias y orden (las 5 más cercanas).
 */

// Configuración de Google Maps que cada prueba ajusta (clave y APIs habilitadas en la clave).
const mapsConfig = vi.hoisted(() => ({ apiKey: 'clave de prueba', places: true, geocoding: true, geolocation: false }));
vi.mock('../../utils/config', () => ({ config: { maps: mapsConfig } }));
const DEFAULTS = { ...mapsConfig };

/** Módulo recién cargado: sin "Places negado" de una prueba anterior (se recuerda por página). */
async function freshModule() {
  vi.resetModules();
  return import('./googleMaps');
}

beforeEach(() => Object.assign(mapsConfig, DEFAULTS));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('mapsService.geocodePlaces (respaldo del buscador sin Places)', () => {
  /** Un resultado de la geocodificación de lo escrito, en otro punto. */
  const at = (placeId: string, formatted: string, point: GeoPoint, components = PALIZA) => ({ ...geocoded(['street_address'], formatted, components, point), place_id: placeId });
  const NEAR_BY = { lat: 29.0734, lng: -110.9559 }; // ~55 m al norte
  const ACROSS_TOWN = { lat: 29.1, lng: -110.95 }; // ~3 km
  const FAR_AWAY = { lat: 19.4326, lng: -99.1332 }; // la CDMX

  it('geocodifica lo escrito en el país del domicilio, con preferencia por la zona de la referencia', async () => {
    const sdk = stubSdk();
    sdk.geocode.mockResolvedValue({ results: [] });
    await expect(mapsService.geocodePlaces('Calle Dr. Paliza 71', { country: 'MX', near: POINT })).resolves.toEqual([]);
    const request = sdk.geocode.mock.calls[0][0];
    expect(request).toMatchObject({ address: 'Calle Dr. Paliza 71', language: 'es', region: 'MX', componentRestrictions: { country: 'MX' } });
    // Rectángulo de 50 km alrededor del punto (solo prefiere: no limita).
    const bounds = request.bounds as google.maps.LatLngBoundsLiteral;
    expect(bounds.north - POINT.lat).toBeCloseTo(0.449, 2);
    expect(POINT.lat - bounds.south).toBeCloseTo(0.449, 2);
    expect(bounds.east - POINT.lng).toBeCloseTo(0.514, 2); // un grado de longitud mide menos lejos del ecuador
    expect(POINT.lng - bounds.west).toBeCloseTo(0.514, 2);
  });

  it('sin país ni referencia: todo el mundo con preferencia por México, sin zona ni distancia', async () => {
    const sdk = stubSdk();
    sdk.geocode.mockResolvedValue({ results: [at('a', 'Calle Dr. Paliza 71, Centro, 83000 Hermosillo, Son., México', POINT)] });
    const [found] = await mapsService.geocodePlaces('Paliza');
    expect(found.distanceMeters).toBeNull();
    expect(sdk.geocode).toHaveBeenCalledExactlyOnceWith({ address: 'Paliza', language: 'es', region: 'MX' });
    await mapsService.geocodePlaces('Paliza', { country: '', near: null });
    expect(sdk.geocode).toHaveBeenLastCalledWith({ address: 'Paliza', language: 'es', region: 'MX' });
  });

  it('cada resultado es una fila con su texto, su distancia, su punto y su domicilio: las 5 más cercanas primero', async () => {
    const sdk = stubSdk();
    const results = [
      at('lejos', 'Calle Dr. Paliza, Centro, Ciudad de México, CDMX, México', FAR_AWAY),
      at('cerca', 'Calle Dr. Paliza 71, Centro, 83000 Hermosillo, Son., México', NEAR_BY),
      at('centro', 'Hermosillo, Son., México', ACROSS_TOWN, PALIZA.slice(3, 7)),
      at('aqui', 'Plaza Zaragoza, 83000 Hermosillo', POINT),
      at('b', 'B', FAR_AWAY),
      at('c', 'C', FAR_AWAY),
    ];
    sdk.geocode.mockResolvedValue({ results });
    const found = await mapsService.geocodePlaces('Paliza', { country: 'MX', near: POINT });
    expect(found.map((s) => s.id)).toEqual(['aqui', 'cerca', 'centro', 'lejos', 'b']);
    const [here, near, town] = found;
    expect(here).toMatchObject({ source: 'geocoding', primary: 'Plaza Zaragoza', secondary: '83000 Hermosillo', distanceMeters: 0, point: POINT, label: 'Plaza Zaragoza, 83000 Hermosillo' });
    expect(near).toMatchObject({ primary: 'Calle Dr. Paliza 71', secondary: 'Centro, 83000 Hermosillo, Son., México' });
    expect(near.distanceMeters).toBeGreaterThan(50);
    expect(near.distanceMeters).toBeLessThan(60);
    expect(Number.isInteger(town.distanceMeters)).toBe(true);
    expect(town.source === 'geocoding' && town.parts.map((p) => p.types[0])).toEqual(['country', 'administrative_area_level_1', 'administrative_area_level_2', 'locality']);
  });

  it('sin resultados (ZERO_RESULTS) no es una falla; lo demás se clasifica y tiene tiempo límite', async () => {
    const sdk = stubSdk();
    sdk.geocode.mockRejectedValueOnce({ code: 'ZERO_RESULTS' });
    await expect(mapsService.geocodePlaces('Nada')).resolves.toEqual([]);
    sdk.geocode.mockRejectedValueOnce(new Error('REQUEST_DENIED'));
    expect(await failure(mapsService.geocodePlaces('Nada'))).toMatchObject({ api: 'geocoding', problem: 'denied' });
    vi.useFakeTimers();
    sdk.geocode.mockReturnValueOnce(new Promise<never>(() => undefined));
    const pending = failure(mapsService.geocodePlaces('Nada'));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toMatchObject({ api: 'geocoding', problem: 'failed', message: 'geocoding: failed (timeout)' });
  });

  it('elegir un resultado no consulta nada más si trae su zona completa (colonia incluida)', async () => {
    const sdk = stubSdk();
    sdk.geocode.mockResolvedValueOnce({ results: [at('a', 'Calle Dr. Paliza 71, Centro, 83000 Hermosillo', POINT)] });
    const [picked] = await mapsService.geocodePlaces('Paliza 71');
    await expect(mapsService.resolvePlace(picked)).resolves.toEqual({ point: POINT, address: FOUND, label: 'Calle Dr. Paliza 71, Centro, 83000 Hermosillo' });
    expect(sdk.geocode).toHaveBeenCalledTimes(1);
    expect(sdk.importLibrary).not.toHaveBeenCalledWith('places');
  });

  it('a un resultado sin colonia se le completa con la geocodificación de su punto (de mejor esfuerzo)', async () => {
    const sdk = stubSdk();
    sdk.geocode.mockResolvedValueOnce({ results: [at('a', 'Calle Dr. Paliza 71, 83000 Hermosillo', POINT, PALIZA.slice(0, 7))] });
    const [picked] = await mapsService.geocodePlaces('Paliza 71');
    sdk.geocode.mockResolvedValueOnce({ results: [CENTRO] });
    await expect(mapsService.resolvePlace(picked)).resolves.toMatchObject({ address: FOUND });
    expect(sdk.geocode).toHaveBeenLastCalledWith({ location: POINT, language: 'es' });

    sdk.geocode.mockRejectedValueOnce(new Error('UNKNOWN_ERROR')); // si falla, se queda con lo que trae
    const { neighborhood: _none, ...withoutColonia } = FOUND;
    await expect(mapsService.resolvePlace(picked)).resolves.toMatchObject({ address: withoutColonia });
  });
});

describe('mapsService.searchPlaces: Places primero y la geocodificación como respaldo', () => {
  const GEOCODED = { ...geocoded(['street_address'], 'Calle Dr. Paliza 71, Centro, 83000 Hermosillo', PALIZA), place_id: 'g1' };
  const placeHit = (placeId: string) => ({ placePrediction: { ...prediction(placeId, `Lugar ${placeId}`), distanceMeters: null } });

  it('con Places: una sesión para toda la búsqueda y sus sugerencias', async () => {
    const maps = await freshModule();
    const sdk = stubSdk();
    sdk.fetchAutocompleteSuggestions.mockResolvedValue({ suggestions: [placeHit('p1')] });
    const session: GoogleMaps.SearchSession = { token: null };
    const onProblem = vi.fn();
    expect(maps.mapsService.searchSource()).toBe('places');
    const found = await maps.mapsService.searchPlaces('Plaza', session, { country: 'MX', near: POINT, onProblem });
    expect(found.map((s) => [s.source, s.id])).toEqual([['places', 'p1']]);
    await maps.mapsService.searchPlaces('Plaza Z', session, { country: 'MX' });
    const [first, second] = sdk.fetchAutocompleteSuggestions.mock.calls.map(([request]) => request);
    expect(first.sessionToken).toBeInstanceOf(FakeSessionToken);
    expect(second.sessionToken).toBe(first.sessionToken); // la misma sesión
    expect(first).toMatchObject({ input: 'Plaza', origin: POINT, includedRegionCodes: ['mx'] });
    expect(sdk.geocode).not.toHaveBeenCalled();
    expect(onProblem).not.toHaveBeenCalled();
  });

  it('Places sin habilitar (denied): busca con Geocoding, lo informa una vez y ya no llama a Places en esta página', async () => {
    const maps = await freshModule();
    const sdk = stubSdk();
    sdk.fetchAutocompleteSuggestions.mockRejectedValue(new Error('PERMISSION_DENIED: Places API (New) has not been used in project'));
    sdk.geocode.mockResolvedValue({ results: [GEOCODED] });
    const session: GoogleMaps.SearchSession = { token: null };
    const onProblem = vi.fn();
    const found = await maps.mapsService.searchPlaces('Paliza', session, { country: 'MX', near: POINT, onProblem });
    expect(found).toMatchObject([{ source: 'geocoding', id: 'g1', primary: 'Calle Dr. Paliza 71', distanceMeters: 0 }]);
    expect(onProblem).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ api: 'places', problem: 'denied' }));
    expect(sdk.geocode).toHaveBeenCalledWith(expect.objectContaining({ address: 'Paliza', componentRestrictions: { country: 'MX' } }));
    expect(session.token).toBeNull(); // una sesión que falló no se reutiliza

    expect(maps.mapsService.searchSource()).toBe('geocoding');
    await maps.mapsService.searchPlaces('Paliza 71', session, { country: 'MX', onProblem });
    expect(sdk.fetchAutocompleteSuggestions).toHaveBeenCalledTimes(1); // ya no se pregunta a Places
    expect(sdk.geocode).toHaveBeenCalledTimes(2);
    expect(onProblem).toHaveBeenCalledTimes(1);
  });

  it('una falla pasajera de Places (sin red, tiempo agotado) también cae a Geocoding, pero Places se vuelve a intentar', async () => {
    const maps = await freshModule();
    const sdk = stubSdk();
    sdk.fetchAutocompleteSuggestions.mockRejectedValueOnce(new Error('Failed to fetch')).mockResolvedValueOnce({ suggestions: [placeHit('p1')] });
    sdk.geocode.mockResolvedValue({ results: [GEOCODED] });
    const session: GoogleMaps.SearchSession = { token: null };
    const onProblem = vi.fn();
    await expect(maps.mapsService.searchPlaces('Paliza', session, { onProblem })).resolves.toMatchObject([{ source: 'geocoding' }]);
    expect(onProblem).toHaveBeenCalledWith(expect.objectContaining({ api: 'places', problem: 'failed' }));
    expect(maps.mapsService.searchSource()).toBe('places');
    await expect(maps.mapsService.searchPlaces('Paliza', session, { onProblem })).resolves.toMatchObject([{ source: 'places', id: 'p1' }]);
    expect(sdk.importLibrary.mock.calls.filter(([name]) => name === 'places').length).toBeGreaterThanOrEqual(2); // otra sesión
  });

  it('con Places apagado en la configuración busca directo con Geocoding (sin informar nada)', async () => {
    mapsConfig.places = false;
    const maps = await freshModule();
    const sdk = stubSdk();
    sdk.geocode.mockResolvedValue({ results: [GEOCODED] });
    const onProblem = vi.fn();
    expect(maps.mapsService.searchSource()).toBe('geocoding');
    await expect(maps.mapsService.searchPlaces('Paliza', { token: null }, { onProblem })).resolves.toHaveLength(1);
    expect(sdk.fetchAutocompleteSuggestions).not.toHaveBeenCalled();
    expect(onProblem).not.toHaveBeenCalled();
  });

  it('sin Geocoding, la falla de Places es la de la búsqueda (no se informa dos veces)', async () => {
    mapsConfig.geocoding = false;
    const maps = await freshModule();
    const sdk = stubSdk();
    sdk.fetchAutocompleteSuggestions.mockRejectedValue(new Error('REQUEST_DENIED'));
    const onProblem = vi.fn();
    const error = await failure(maps.mapsService.searchPlaces('Plaza', { token: null }, { onProblem }));
    expect(error).toMatchObject({ api: 'places', problem: 'denied' });
    expect(onProblem).not.toHaveBeenCalled();
    // Ya negado y sin respaldo: no hay con qué buscar y la búsqueda lo dice sin llamar a Google.
    expect(maps.mapsService.searchSource()).toBeNull();
    expect(await failure(maps.mapsService.searchPlaces('Plaza', { token: null }))).toMatchObject({ api: 'places', problem: 'denied' });
    expect(sdk.fetchAutocompleteSuggestions).toHaveBeenCalledTimes(1);
    expect(sdk.geocode).not.toHaveBeenCalled();
  });

  it('si ya se escribió otra cosa, no se pide a Google lo que se ignoraría', async () => {
    const maps = await freshModule();
    const sdk = stubSdk();
    sdk.fetchAutocompleteSuggestions.mockRejectedValue(new Error('Failed to fetch'));
    const stale = new AbortController();
    stale.abort();
    // Mientras se abría la sesión de Places.
    await expect(maps.mapsService.searchPlaces('Plaza', { token: null }, { signal: stale.signal })).resolves.toEqual([]);
    expect(sdk.fetchAutocompleteSuggestions).not.toHaveBeenCalled();
    // Antes del respaldo.
    const later = new AbortController();
    sdk.fetchAutocompleteSuggestions.mockImplementationOnce(() => {
      later.abort();
      return Promise.reject(new Error('Failed to fetch'));
    });
    await expect(maps.mapsService.searchPlaces('Plaza', { token: null }, { signal: later.signal })).resolves.toEqual([]);
    expect(sdk.geocode).not.toHaveBeenCalled();
  });
});

describe('idioma de las peticiones a Google', () => {
  it('cada petición lleva el idioma activo: tras cambiarlo en caliente, los resultados nuevos llegan en inglés', async () => {
    const sdk = stubSdk();
    sdk.geocode.mockResolvedValue({ results: [] });
    sdk.fetchAutocompleteSuggestions.mockResolvedValue({ suggestions: [] });
    await mapsService.geocodePlaces('Paliza');
    expect(sdk.geocode).toHaveBeenLastCalledWith({ address: 'Paliza', language: 'es', region: 'MX' });
    await setLocale('en-US');
    await mapsService.geocodePlaces('Paliza');
    expect(sdk.geocode).toHaveBeenLastCalledWith({ address: 'Paliza', language: 'en', region: 'MX' });
    await mapsService.reverseGeocode(POINT);
    expect(sdk.geocode).toHaveBeenLastCalledWith({ location: POINT, language: 'en' });
    await mapsService.suggestPlaces('Plaza', new FakeSessionToken());
    expect(sdk.fetchAutocompleteSuggestions).toHaveBeenLastCalledWith(expect.objectContaining({ input: 'Plaza', language: 'en' }));
  });
});
