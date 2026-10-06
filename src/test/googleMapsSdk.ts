import { vi } from 'vitest';
import type { PlaceSuggestion } from '../services/maps/googleMaps';
import type { GeoPoint } from '../utils/address';

/**
 * SDK de Google Maps simulado para las pruebas del servicio de mapas (el real se valida en el
 * navegador): geocodificación, Autocomplete de Places y lugares con sus datos. Lo comparten
 * `googleMaps.test.ts` y `googleMapsSearch.test.ts`.
 */

export const POINT: GeoPoint = { lat: 29.0729, lng: -110.9559 };
/** El domicilio que se arma con los componentes de `PALIZA` (Plaza Zaragoza, Hermosillo). */
export const FOUND = { street: 'Calle Dr. Paliza', exterior_number: '71', postal_code: '83000', country_code: 'MX', state: 'Sonora', municipality: 'Hermosillo', city: 'Hermosillo', neighborhood: 'Centro' };

/** Error con el que terminó una promesa (o undefined si se cumplió). */
export const failure = (promise: Promise<unknown>) => promise.then(() => undefined, (error: unknown) => error);

// --- SDK simulado (el real se valida en navegador) ---

export const component = (long_name: string, types: string[], short_name = long_name) => ({ long_name, short_name, types });
export const PALIZA = [
  component('Calle Dr. Paliza', ['route']),
  component('71', ['street_number']),
  component('83000', ['postal_code']),
  component('México', ['country', 'political'], 'mx'),
  component('Sonora', ['administrative_area_level_1', 'political'], 'Son.'),
  component('Hermosillo', ['administrative_area_level_2', 'political']),
  component('Hermosillo', ['locality', 'political']),
  // En México la colonia llega como sublocality_level_1 (al final: los recortes de arriba no la incluyen).
  component('Centro', ['sublocality_level_1', 'sublocality', 'political']),
];
export const geocoded = (types: string[], formatted_address: string, address_components: unknown[], point = POINT) => ({
  types,
  formatted_address,
  address_components,
  geometry: { location: { toJSON: () => point } },
});
export const CENTRO = geocoded(['neighborhood', 'political'], 'Centro, Hermosillo, Son., México', [component('Centro', ['neighborhood'])], { lat: 29.07, lng: -110.95 });
export const STREET = geocoded(['street_address'], 'Calle Dr. Paliza 71, Centro, 83000 Hermosillo, Son., México', PALIZA);

export class FakeSessionToken {}

export function stubSdk() {
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
export const prediction = (placeId: string, text: string, main?: string, secondary?: string) => ({ placeId, text: { text }, mainText: textOf(main), secondaryText: textOf(secondary) });

interface FakePlaceFields {
  location?: { toJSON: () => GeoPoint };
  addressComponents?: Array<{ longText: string | null; shortText: string | null; types: string[] }>;
  formattedAddress?: string | null;
}

/** Sugerencia cuyo lugar trae sus datos al pedirlos (`fetchFields`), como el SDK. */
export function suggestionFor(fields: FakePlaceFields | Error) {
  const place: FakePlaceFields & { fetchFields: ReturnType<typeof vi.fn> } = {
    fetchFields: vi.fn(() => {
      if (fields instanceof Error) return Promise.reject(fields);
      Object.assign(place, fields);
      return Promise.resolve({ place });
    }),
  };
  const toPlace = vi.fn(() => place);
  const suggestion: PlaceSuggestion = {
    source: 'places',
    id: 'p1',
    primary: 'Plaza Zaragoza',
    secondary: 'Centro, Hermosillo',
    distanceMeters: null,
    prediction: { toPlace } as unknown as google.maps.places.PlacePrediction,
  };
  return { suggestion, place, toPlace };
}
