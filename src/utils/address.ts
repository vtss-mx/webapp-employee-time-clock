/**
 * Domicilio (reglas puras): campos, lectura de lo que devuelve Google (geocodificación o lugares),
 * validación para la interfaz y su texto de una línea. El backend vuelve a validar todo.
 *
 * Los campos van en el orden en que se capturan (decisión del dueño del producto; el mismo del
 * backend, `app/schemas/address.py`): país, estado o provincia, municipio o alcaldía, ciudad o
 * localidad, colonia o barrio, código postal, calle o vialidad, número exterior, número interior y
 * referencias. Los mensajes de validación salen en el idioma activo (se piden al dibujar).
 */

import { t } from '../i18n/core';
import type { Address } from '../types';

export interface AddressValues {
  country_code: string;
  state: string;
  municipality: string;
  city: string;
  /** Colonia o barrio. */
  neighborhood: string;
  postal_code: string;
  street: string;
  exterior_number: string;
  interior_number: string;
  /** Referencias para llegar (entrecalles, puntos cercanos): opcionales y en varios renglones; Google nunca las llena. */
  reference_notes: string;
}

/** Punto WGS84 (mismo formato que google.maps.LatLngLiteral). */
export interface GeoPoint {
  lat: number;
  lng: number;
}

export const EMPTY_ADDRESS: AddressValues = {
  country_code: 'MX',
  state: '',
  municipality: '',
  city: '',
  neighborhood: '',
  postal_code: '',
  street: '',
  exterior_number: '',
  interior_number: '',
  reference_notes: '',
};

export const ADDRESS_FIELDS = Object.keys(EMPTY_ADDRESS) as Array<keyof AddressValues>;

/** Campos del domicilio de un objeto que los tenga (formulario o API); vacíos o nulos → el valor por omisión. */
export type AddressLike = Partial<Record<keyof AddressValues, string | null>>;

/**
 * Referencias como las guarda el backend: cada indicación en su renglón, sin espacios de sobra ni
 * renglones vacíos (así la confirmación muestra lo mismo que quedará guardado).
 */
export function cleanNotes(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.split(/\s+/).filter(Boolean).join(' '))
    .filter(Boolean)
    .join('\n');
}

/** Con `trim`, como se envía: sin espacios de sobra (y las referencias, renglón por renglón). */
export function pickAddress(source: AddressLike | null | undefined, { trim = false } = {}): AddressValues {
  const result = { ...EMPTY_ADDRESS };
  for (const field of ADDRESS_FIELDS) {
    const value = source?.[field] ?? EMPTY_ADDRESS[field];
    result[field] = !trim ? value : field === 'reference_notes' ? cleanNotes(value) : value.trim();
  }
  return result;
}

/** El domicilio como se envía al backend: sin espacios de sobra, los opcionales vacíos como null y su punto. */
export function addressPayload(values: AddressLike, point: GeoPoint | null): Address {
  const address = pickAddress(values, { trim: true });
  return {
    ...address,
    interior_number: address.interior_number || null,
    reference_notes: address.reference_notes || null,
    latitude: point?.lat ?? null,
    longitude: point?.lng ?? null,
  };
}

/** Límites de cada campo (los mismos que la base de datos). */
export const ADDRESS_MAX: Record<keyof AddressValues, number> = {
  country_code: 2,
  state: 100,
  municipality: 100,
  city: 100,
  neighborhood: 120,
  postal_code: 10,
  street: 150,
  exterior_number: 20,
  interior_number: 20,
  reference_notes: 300,
};

/** Un componente del domicilio de Google (Geocoding: long_name/short_name; Places: longText/shortText). */
export interface AddressPart {
  longText: string;
  shortText: string;
  types: string[];
}

/**
 * Qué tipo de componente de Google llena cada campo (en orden de preferencia). En México:
 * - `administrative_area_level_2` es el municipio (la alcaldía en la CDMX) y `locality` la ciudad;
 *   si falta uno se usa el otro (una ciudad pequeña suele traer solo uno de los dos).
 * - `sublocality_level_1` es la COLONIA (Google la marca también `sublocality`; en otros lugares,
 *   `neighborhood`): nunca es la ciudad ni el municipio.
 * - `premise` es el nombre de un edificio: no es la calle ni el número.
 * `postal_town` (Reino Unido) y `administrative_area_level_3` (otros países) cubren la ciudad fuera de México.
 * Las referencias no salen de Google: las escribe la persona.
 */
const SOURCES: Array<[keyof AddressValues, string[], 'longText' | 'shortText']> = [
  ['country_code', ['country'], 'shortText'],
  ['state', ['administrative_area_level_1'], 'longText'],
  ['municipality', ['administrative_area_level_2', 'locality', 'administrative_area_level_3'], 'longText'],
  ['city', ['locality', 'postal_town', 'administrative_area_level_3', 'administrative_area_level_2'], 'longText'],
  ['neighborhood', ['sublocality_level_1', 'sublocality', 'neighborhood'], 'longText'],
  ['postal_code', ['postal_code'], 'longText'],
  ['street', ['route'], 'longText'],
  ['exterior_number', ['street_number'], 'longText'],
  ['interior_number', ['subpremise'], 'longText'],
];

/**
 * Nombres que Google pone a un camino sin nombre ("Vía Sin Nombre", "Calle sin nombre", "Unnamed Road"):
 * no son una calle, así que el campo queda vacío para que la persona la escriba.
 */
const UNNAMED_ROAD = /^((v[ií]a|calle|camino|carretera|av(enida)?\.?)\s+)?sin nombre$|^unnamed road$/i;

/** Campos del domicilio que se pueden llenar con los componentes de Google (solo los que trae). */
export function addressFromParts(parts: AddressPart[]): Partial<AddressValues> {
  const found: Partial<AddressValues> = {};
  for (const [field, types, text] of SOURCES) {
    const part = types.map((type) => parts.find((p) => p.types.includes(type))).find(Boolean);
    const value = part?.[text]?.trim();
    if (!value || (field === 'street' && UNNAMED_ROAD.test(value))) continue;
    found[field] = field === 'country_code' ? value.toUpperCase() : value;
  }
  return found;
}

/** Lo que es de la zona del punto (no de una casa en particular): se puede tomar de otro resultado. */
const AREA_FIELDS: (keyof AddressValues)[] = ['country_code', 'state', 'municipality', 'city', 'neighborhood', 'postal_code', 'street'];

/** ¿Le falta algún dato de la zona? (p. ej. un negocio de Google que no trae su código postal o su colonia). */
export function missingAreaFields(found: Partial<AddressValues>): boolean {
  return AREA_FIELDS.some((field) => !found[field]);
}

/**
 * El domicilio más completo posible de un punto: Google devuelve varios resultados que lo contienen
 * (la dirección exacta, la calle, la colonia, el código postal, la ciudad...). Manda el más preciso
 * (el primero) y lo que le falte de la zona se completa con los demás; el número exterior solo sale
 * del más preciso (de otro resultado sería el de otra casa).
 */
export function addressFromResults(results: AddressPart[][]): Partial<AddressValues> {
  const [best, ...rest] = results;
  if (!best) return {};
  const found = addressFromParts(best);
  for (const parts of rest) {
    const more = addressFromParts(parts);
    for (const field of AREA_FIELDS) if (!found[field] && more[field]) found[field] = more[field];
  }
  return found;
}

/** Lo que se conserva si Google no lo trae: el interior casi nunca viene, el país casi siempre, y las referencias nunca. */
const KEPT_FIELDS: (keyof AddressValues)[] = ['interior_number', 'country_code', 'reference_notes'];

/**
 * Domicilio del punto elegido en el mapa: lo encontrado reemplaza al anterior y lo que Google no
 * trae queda vacío para capturarlo (no se mezclan datos de dos lugares). Se conservan el número
 * interior y el país escritos si Google no los trae, y siempre las referencias (las escribe la persona).
 */
export function addressForPoint(current: AddressValues, found: Partial<AddressValues>): AddressValues {
  const next = { ...current };
  for (const field of ADDRESS_FIELDS) {
    const fromGoogle = field === 'reference_notes' ? undefined : found[field];
    next[field] = fromGoogle ?? (KEPT_FIELDS.includes(field) ? current[field] : '');
  }
  return next;
}

const POSTAL_CODES: Record<string, { pattern: RegExp; message: 'location.address.postalCodeMx' }> = {
  MX: { pattern: /^\d{5}$/, message: 'location.address.postalCodeMx' },
};
const POSTAL_CODE_ANY = /^[A-Z0-9][A-Z0-9 -]{1,8}[A-Z0-9]$/;

/** Campos obligatorios y la llave de su mensaje cuando faltan. */
type RequiredCopy = 'country' | 'state' | 'municipality' | 'city' | 'neighborhood' | 'street' | 'exteriorNumber';
const REQUIRED: Partial<Record<keyof AddressValues, `location.address.required.${RequiredCopy}`>> = {
  country_code: 'location.address.required.country',
  state: 'location.address.required.state',
  municipality: 'location.address.required.municipality',
  city: 'location.address.required.city',
  neighborhood: 'location.address.required.neighborhood',
  street: 'location.address.required.street',
  exterior_number: 'location.address.required.exteriorNumber',
};

/** Mínimo de letras de los textos obligatorios (el mismo del backend: 2; el número exterior, 1: «7»). */
const MIN_LENGTH = 2;

export function normalizePostalCode(value: string): string {
  return value.toUpperCase().replace(/\s+/g, ' ').trimStart();
}

export function validatePostalCode(value: string, country: string): string | undefined {
  const code = value.trim().toUpperCase();
  if (!code) return t('location.address.required.postalCode');
  const rule = POSTAL_CODES[country];
  if (rule) return rule.pattern.test(code) ? undefined : t(rule.message);
  return POSTAL_CODE_ANY.test(code) ? undefined : t('location.address.postalCodeInvalid');
}

/** El error de un campo (obligatorio, muy corto o muy largo); las referencias cuentan como se guardan. */
function fieldError(field: keyof AddressValues, raw: string): string | undefined {
  const value = field === 'reference_notes' ? cleanNotes(raw) : raw.trim();
  const required = REQUIRED[field];
  if (required && !value) return t(required);
  if (required && value.length < MIN_LENGTH && field !== 'exterior_number') return t('location.address.minLength', { min: MIN_LENGTH });
  return value.length > ADDRESS_MAX[field] ? t('location.address.maxLength', { max: ADDRESS_MAX[field] }) : undefined;
}

/** Errores del domicilio (solo para la interfaz; las mismas reglas que el backend). */
export function validateAddress(values: AddressValues): Partial<Record<keyof AddressValues, string>> {
  const errors: Partial<Record<keyof AddressValues, string>> = {};
  for (const field of ADDRESS_FIELDS) errors[field] = fieldError(field, values[field]);
  errors.postal_code ??= validatePostalCode(values.postal_code, values.country_code);
  for (const field of ADDRESS_FIELDS) if (!errors[field]) delete errors[field];
  return errors;
}

/**
 * "Calle Dr. Paliza 71 Int. 2, Centro, 83000 Hermosillo, Sonora" (para listados y búsquedas; sin las
 * referencias). Los datos van tal cual; solo la palabra del número interior sigue al idioma activo.
 */
export function addressLine(address: AddressLike | null | undefined, { withCountry = false } = {}): string {
  if (!address) return '';
  const interior = address.interior_number && t('location.address.interior', { number: address.interior_number });
  const number = [address.exterior_number, interior].filter(Boolean).join(' ');
  const street = [address.street, number].filter(Boolean).join(' ');
  const place = [address.postal_code, address.city].filter(Boolean).join(' ');
  const region = address.state && address.state !== address.city ? address.state : '';
  return [street, address.neighborhood, place, region, withCountry ? address.country_code : ''].filter(Boolean).join(', ');
}

/** Radio medio de la Tierra (m, IUGG): el mismo que usa el backend (`app/core/geo.py`). */
const EARTH_RADIUS_M = 6_371_008.8;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** Distancia en línea recta entre dos puntos (m, haversine): para ordenar resultados por cercanía. */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "29.07290, -110.95590". */
export function formatPoint(point: GeoPoint): string {
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}
