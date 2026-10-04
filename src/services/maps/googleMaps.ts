import { addressFromParts, addressFromResults, missingAreaFields, type AddressPart, type AddressValues, type GeoPoint } from '../../utils/address';
import { config } from '../../utils/config';

/**
 * ÚNICO punto de contacto con el SDK de Google Maps (carga del script, geocodificación y búsqueda
 * de lugares). Los componentes usan estas funciones; nunca `google.maps` para pedir datos.
 * Depende del SDK real: se valida en navegador (las pruebas de unidad lo simulan).
 */

export type MapsApi = 'maps' | 'places' | 'geocoding' | 'geolocation';
/** off: desactivada en la configuración · denied: la clave no la tiene habilitada · failed: falló la petición. */
export type MapsProblem = 'off' | 'denied' | 'failed';

export class MapsApiError extends Error {
  constructor(
    readonly api: MapsApi,
    readonly problem: MapsProblem,
    detail = '',
  ) {
    super(`${api}: ${problem}${detail ? ` (${detail})` : ''}`);
    this.name = 'MapsApiError';
  }
}

/** Centro del mapa cuando aún no hay punto (Ciudad de México) y su acercamiento. */
export const DEFAULT_CENTER: GeoPoint = { lat: 19.4326, lng: -99.1332 };
export const DEFAULT_ZOOM = 5;
export const POINT_ZOOM = 17;

const LANGUAGE = 'es';
const REGION = 'MX';
const CALLBACK = '__timeClockMapsReady';
/** Si Google no responde en este tiempo, el mapa se da por no disponible (no se queda cargando). */
const LOAD_TIMEOUT_MS = 20_000;
/** Una petición a Google (sugerencias, lugar, geocodificación) sin respuesta en este tiempo es una falla pasajera. */
const REQUEST_TIMEOUT_MS = 10_000;
/** Completar el domicilio de un lugar elegido es accesorio: si Google tarda más, se queda con lo que trae. */
const COMPLETE_TIMEOUT_MS = 3_000;
/** Sugerencias que muestra el buscador: las más cercanas al punto de referencia. */
export const MAX_SUGGESTIONS = 5;
/** Zona preferida alrededor del punto de referencia (m): el máximo que acepta Google (50 km). */
const BIAS_RADIUS_M = 50_000;

let loading: Promise<void> | null = null;
const authListeners = new Set<() => void>();
let authFailed = false;

/** Google llama a `gm_authFailure` si rechaza la clave (inválida, sin la API o de otro dominio). */
export function onMapsAuthFailure(listener: () => void): () => void {
  if (authFailed) listener();
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}

/** Carga el SDK una sola vez (con `loading=async`); las librerías se piden con `importLibrary`. */
export function loadGoogleMaps(): Promise<void> {
  if (!config.maps.apiKey) return Promise.reject(new MapsApiError('maps', 'off'));
  // Ya cargado (otra pantalla lo pidió antes): `google` solo existe después de cargar el script.
  if (typeof (window as { google?: { maps?: { importLibrary?: unknown } } }).google?.maps?.importLibrary === 'function') return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const globals = window as unknown as Record<string, unknown>;
    const timer = window.setTimeout(() => {
      loading = null;
      reject(new MapsApiError('maps', 'failed', 'timeout'));
    }, LOAD_TIMEOUT_MS);
    globals[CALLBACK] = () => {
      window.clearTimeout(timer);
      resolve();
    };
    globals.gm_authFailure = () => {
      authFailed = true;
      authListeners.forEach((listener) => listener());
    };
    const params = new URLSearchParams({ key: config.maps.apiKey, v: 'weekly', loading: 'async', language: LANGUAGE, region: REGION, callback: CALLBACK });
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timer);
      loading = null; // sin red: se puede reintentar
      reject(new MapsApiError('maps', 'failed', 'script'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

async function library<T>(name: 'maps' | 'places' | 'geocoding'): Promise<T> {
  await loadGoogleMaps();
  return (await google.maps.importLibrary(name)) as T;
}

/** Error de Google → el problema de la API (clave sin la API habilitada o fallo de la petición). */
function asMapsError(api: MapsApi, error: unknown): MapsApiError {
  if (error instanceof MapsApiError) return error;
  const text = `${(error as { code?: string })?.code ?? ''} ${error instanceof Error ? error.message : String(error)}`;
  const denied = /REQUEST_DENIED|PERMISSION_DENIED|not (been )?(used|activated|enabled)|ApiNotActivated|API key|disabled|403/i.test(text);
  return new MapsApiError(api, denied ? 'denied' : 'failed', text.trim().slice(0, 160));
}

/** La respuesta de Google o, si no llega a tiempo, una falla pasajera ("timeout"): nada se queda esperando. */
function inTime<T>(api: MapsApi, task: Promise<T>, ms = REQUEST_TIMEOUT_MS): Promise<T> {
  let timer = 0;
  const late = new Promise<never>((_resolve, reject) => {
    timer = window.setTimeout(() => reject(new MapsApiError(api, 'failed', 'timeout')), ms);
  });
  return Promise.race([task, late]).finally(() => window.clearTimeout(timer));
}

function requireApi(api: 'places' | 'geocoding') {
  if (!config.maps.apiKey || !config.maps[api]) throw new MapsApiError(api, 'off');
}

const fromGeocoder = (parts: google.maps.GeocoderAddressComponent[]): AddressPart[] =>
  parts.map((p) => ({ longText: p.long_name, shortText: p.short_name, types: p.types }));

const fromPlaces = (parts: google.maps.places.AddressComponent[] | undefined): AddressPart[] =>
  (parts ?? []).map((p) => ({ longText: p.longText ?? '', shortText: p.shortText ?? '', types: p.types }));

/** El resultado más útil: una dirección exacta antes que una colonia o una ciudad. */
function bestResult(results: google.maps.GeocoderResult[]): google.maps.GeocoderResult | undefined {
  const precise = ['street_address', 'premise', 'subpremise', 'route'];
  return results.find((r) => r.types.some((t) => precise.includes(t))) ?? results[0];
}

/**
 * Componentes de TODOS los resultados de Google para un punto (la dirección exacta, la calle, la
 * colonia, el código postal, la ciudad...), el más preciso primero: así el domicilio se arma con todo
 * lo que Google sabe de ese lugar (`addressFromResults`).
 */
async function partsAt(point: GeoPoint): Promise<AddressPart[][]> {
  const { Geocoder } = await library<google.maps.GeocodingLibrary>('geocoding');
  const { results } = await new Geocoder().geocode({ location: point, language: LANGUAGE });
  const best = bestResult(results);
  const ordered = best ? [best, ...results.filter((r) => r !== best)] : [];
  return ordered.map((r) => fromGeocoder(r.address_components));
}

/**
 * Domicilio de un lugar elegido: lo que trae el lugar y, si le falta algo de la zona (un negocio sin
 * código postal, p. ej.), lo completa la geocodificación de su punto. Es accesorio: sin Geocoding, con
 * una falla o si tarda, el lugar se queda con lo que trae, sin avisos (tocar el mapa sí avisa y reporta
 * una API sin habilitar).
 */
async function completeAddress(point: GeoPoint, own: AddressPart[]): Promise<Partial<AddressValues>> {
  const address = addressFromParts(own);
  if (!config.maps.geocoding || !missingAreaFields(address)) return address;
  const nearby = await inTime('geocoding', partsAt(point), COMPLETE_TIMEOUT_MS).catch((): AddressPart[][] => []);
  return addressFromResults([own, ...nearby]);
}

/** Las más cercanas primero; las de distancia desconocida, al final en el orden de Google (su relevancia). */
function nearestFirst(list: PlaceSuggestion[]): PlaceSuggestion[] {
  const far = (s: PlaceSuggestion) => s.distanceMeters ?? Number.POSITIVE_INFINITY;
  // Dos desconocidas dan NaN, que `sort` trata como empate (conserva el orden de Google).
  return list.sort((a, b) => far(a) - far(b));
}

export interface PlaceSuggestion {
  id: string;
  /** Nombre del lugar o calle y número. */
  primary: string;
  /** Colonia, ciudad, estado... */
  secondary: string;
  /** Distancia en línea recta desde el punto de referencia (m); null sin referencia. */
  distanceMeters: number | null;
  prediction: google.maps.places.PlacePrediction;
}

export interface SearchOptions {
  /** País del domicilio (ISO 3166): las sugerencias se limitan a él. */
  country?: string;
  /** Punto de referencia (el marcado, lo que se ve del mapa o el dispositivo): se prefieren los lugares cercanos. */
  near?: GeoPoint | null;
}

export interface FoundPlace {
  point: GeoPoint;
  address: Partial<AddressValues>;
  label: string;
}

export const mapsService = {
  /** Domicilio del punto elegido en el mapa (vacío si Google no conoce una dirección ahí). */
  async reverseGeocode(point: GeoPoint): Promise<Partial<AddressValues>> {
    requireApi('geocoding');
    try {
      return addressFromResults(await inTime('geocoding', partsAt(point)));
    } catch (error) {
      if ((error as { code?: string })?.code === 'ZERO_RESULTS') return {};
      throw asMapsError('geocoding', error);
    }
  },

  /** Punto (y domicilio normalizado) de una dirección escrita. null si no se encontró. */
  async geocodeAddress(text: string, country: string): Promise<FoundPlace | null> {
    requireApi('geocoding');
    try {
      const { Geocoder } = await library<google.maps.GeocodingLibrary>('geocoding');
      const { results } = await inTime('geocoding', new Geocoder().geocode({ address: text, region: country, language: LANGUAGE }));
      const best = bestResult(results);
      if (!best) return null;
      return { point: best.geometry.location.toJSON(), address: addressFromParts(fromGeocoder(best.address_components)), label: best.formatted_address };
    } catch (error) {
      if ((error as { code?: string })?.code === 'ZERO_RESULTS') return null;
      throw asMapsError('geocoding', error);
    }
  },

  /** Sesión de búsqueda (agrupa las sugerencias y el lugar elegido para la facturación de Google). */
  async newSearchSession(): Promise<google.maps.places.AutocompleteSessionToken> {
    requireApi('places');
    try {
      const { AutocompleteSessionToken } = await library<google.maps.PlacesLibrary>('places');
      return new AutocompleteSessionToken();
    } catch (error) {
      throw asMapsError('places', error); // como todo el servicio: solo lanza MapsApiError
    }
  },

  /**
   * Sugerencias de lugares y direcciones mientras se escribe, con Autocomplete de Places (New): la
   * respuesta más rápida de Google, hecha para cada tecla (la sesión agrupa las sugerencias y el lugar
   * elegido en un solo cobro). Con un punto de referencia, Google prefiere los lugares a 50 km de él y
   * mide la distancia a cada uno: se devuelven las 5 más cercanas primero.
   */
  async suggestPlaces(input: string, sessionToken: google.maps.places.AutocompleteSessionToken, { country, near }: SearchOptions = {}): Promise<PlaceSuggestion[]> {
    requireApi('places');
    try {
      const { AutocompleteSuggestion } = await library<google.maps.PlacesLibrary>('places');
      const request: google.maps.places.AutocompleteRequest = {
        input,
        sessionToken,
        language: LANGUAGE,
        region: (country || REGION).toLowerCase(),
        includedRegionCodes: country ? [country.toLowerCase()] : undefined,
        ...(near && { origin: near, locationBias: { center: near, radius: BIAS_RADIUS_M } }),
      };
      const { suggestions } = await inTime('places', AutocompleteSuggestion.fetchAutocompleteSuggestions(request));
      const found = suggestions.flatMap(({ placePrediction: p }) =>
        p ? [{ id: p.placeId, primary: p.mainText?.text ?? p.text.text, secondary: p.secondaryText?.text ?? '', distanceMeters: p.distanceMeters ?? null, prediction: p }] : [],
      );
      return nearestFirst(found).slice(0, MAX_SUGGESTIONS);
    } catch (error) {
      throw asMapsError('places', error);
    }
  },

  /**
   * Punto y domicilio del lugar sugerido que se eligió (cierra la sesión de búsqueda). Lo que el lugar
   * no traiga de su zona se completa con la geocodificación de su punto (de mejor esfuerzo).
   */
  async resolvePlace(suggestion: PlaceSuggestion): Promise<FoundPlace> {
    requireApi('places');
    try {
      const place = suggestion.prediction.toPlace();
      await inTime('places', place.fetchFields({ fields: ['location', 'addressComponents', 'formattedAddress'] }));
      if (!place.location) throw new MapsApiError('places', 'failed', 'sin ubicación');
      const point = place.location.toJSON();
      return { point, address: await completeAddress(point, fromPlaces(place.addressComponents)), label: place.formattedAddress ?? suggestion.primary };
    } catch (error) {
      throw asMapsError('places', error);
    }
  },

  /** Ubicación aproximada con Geolocation API de Google (por red); solo si está activada. */
  async approximateLocation(): Promise<{ point: GeoPoint; accuracy: number }> {
    if (!config.maps.apiKey || !config.maps.geolocation) throw new MapsApiError('geolocation', 'off');
    const response = await fetch(`https://www.googleapis.com/geolocation/v1/geolocate?key=${encodeURIComponent(config.maps.apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ considerIp: true }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), // sin respuesta a tiempo: falla pasajera
    }).catch((error: unknown) => {
      throw asMapsError('geolocation', error);
    });
    if (!response.ok) throw new MapsApiError('geolocation', response.status === 403 ? 'denied' : 'failed', String(response.status));
    const data = (await response.json()) as { location: GeoPoint; accuracy: number };
    return { point: data.location, accuracy: data.accuracy };
  },
};
