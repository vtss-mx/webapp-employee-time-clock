/**
 * Domicilio (reglas puras): campos, lectura de lo que devuelve Google (geocodificación o lugares),
 * validación para la interfaz y su texto de una línea. El backend vuelve a validar todo.
 */

export interface AddressValues {
  street: string;
  exterior_number: string;
  interior_number: string;
  postal_code: string;
  country_code: string;
  state: string;
  municipality: string;
  city: string;
}

/** Punto WGS84 (mismo formato que google.maps.LatLngLiteral). */
export interface GeoPoint {
  lat: number;
  lng: number;
}

export const EMPTY_ADDRESS: AddressValues = {
  street: '',
  exterior_number: '',
  interior_number: '',
  postal_code: '',
  country_code: 'MX',
  state: '',
  municipality: '',
  city: '',
};

export const ADDRESS_FIELDS = Object.keys(EMPTY_ADDRESS) as Array<keyof AddressValues>;

/** Campos del domicilio de un objeto que los tenga (formulario o API); vacíos o nulos → el valor por omisión. */
export type AddressLike = Partial<Record<keyof AddressValues, string | null>>;

export function pickAddress(source: AddressLike | null | undefined, { trim = false } = {}): AddressValues {
  const result = { ...EMPTY_ADDRESS };
  for (const field of ADDRESS_FIELDS) {
    const value = source?.[field] ?? EMPTY_ADDRESS[field];
    result[field] = trim ? value.trim() : value;
  }
  return result;
}

/** Límites de cada campo (los mismos que la base de datos). */
export const ADDRESS_MAX: Record<keyof AddressValues, number> = {
  street: 150,
  exterior_number: 20,
  interior_number: 20,
  postal_code: 10,
  country_code: 2,
  state: 100,
  municipality: 100,
  city: 100,
};

/** Un componente del domicilio de Google (Geocoding: long_name/short_name; Places: longText/shortText). */
export interface AddressPart {
  longText: string;
  shortText: string;
  types: string[];
}

/** Qué tipo de componente de Google llena cada campo (en orden de preferencia). */
const SOURCES: Array<[keyof AddressValues, string[], 'longText' | 'shortText']> = [
  ['street', ['route'], 'longText'],
  ['exterior_number', ['street_number'], 'longText'],
  ['interior_number', ['subpremise'], 'longText'],
  ['postal_code', ['postal_code'], 'longText'],
  ['country_code', ['country'], 'shortText'],
  ['state', ['administrative_area_level_1'], 'longText'],
  // En México el municipio (o la alcaldía en la CDMX) es el nivel 2.
  ['municipality', ['administrative_area_level_2', 'locality'], 'longText'],
  ['city', ['locality', 'postal_town', 'administrative_area_level_3', 'sublocality', 'administrative_area_level_2'], 'longText'],
];

/** Campos del domicilio que se pueden llenar con los componentes de Google (solo los que trae). */
export function addressFromParts(parts: AddressPart[]): Partial<AddressValues> {
  const found: Partial<AddressValues> = {};
  for (const [field, types, text] of SOURCES) {
    const part = types.map((type) => parts.find((p) => p.types.includes(type))).find(Boolean);
    const value = part?.[text]?.trim();
    if (value) found[field] = field === 'country_code' ? value.toUpperCase() : value;
  }
  return found;
}

/**
 * Domicilio del punto elegido en el mapa: lo encontrado reemplaza al anterior y lo que Google no
 * trae queda vacío para capturarlo (no se mezclan datos de dos lugares). El número interior casi
 * nunca viene: se conserva el escrito; el país, si no viene, también.
 */
export function addressForPoint(current: AddressValues, found: Partial<AddressValues>): AddressValues {
  const next = { ...current };
  for (const field of ADDRESS_FIELDS) {
    if (field === 'interior_number' || field === 'country_code') next[field] = found[field] ?? current[field];
    else next[field] = found[field] ?? '';
  }
  return next;
}

const POSTAL_CODES: Record<string, { pattern: RegExp; message: string }> = {
  MX: { pattern: /^\d{5}$/, message: 'El código postal de México tiene 5 dígitos' },
};
const POSTAL_CODE_ANY = /^[A-Z0-9][A-Z0-9 -]{1,8}[A-Z0-9]$/;

const REQUIRED: Partial<Record<keyof AddressValues, string>> = {
  street: 'Escribe la calle',
  exterior_number: 'Escribe el número exterior (o S/N)',
  country_code: 'Elige el país',
  state: 'Escribe el estado',
  municipality: 'Escribe el municipio o alcaldía',
  city: 'Escribe la ciudad',
};

export function normalizePostalCode(value: string): string {
  return value.toUpperCase().replace(/\s+/g, ' ').trimStart();
}

export function validatePostalCode(value: string, country: string): string | undefined {
  const code = value.trim().toUpperCase();
  if (!code) return 'Escribe el código postal';
  const rule = POSTAL_CODES[country];
  if (rule) return rule.pattern.test(code) ? undefined : rule.message;
  return POSTAL_CODE_ANY.test(code) ? undefined : 'El código postal no es válido';
}

/** Errores del domicilio (solo para la interfaz). */
export function validateAddress(values: AddressValues): Partial<Record<keyof AddressValues, string>> {
  const errors: Partial<Record<keyof AddressValues, string>> = {};
  for (const field of ADDRESS_FIELDS) {
    const value = values[field].trim();
    if (REQUIRED[field] && !value) errors[field] = REQUIRED[field];
    else if (value.length > ADDRESS_MAX[field]) errors[field] = `Máximo ${ADDRESS_MAX[field]} caracteres`;
  }
  errors.postal_code ??= validatePostalCode(values.postal_code, values.country_code);
  for (const field of ADDRESS_FIELDS) if (!errors[field]) delete errors[field];
  return errors;
}

/** "Calle Dr. Paliza 71 Int. 2, 83000 Hermosillo, Sonora" (para listados y búsquedas). */
export function addressLine(address: AddressLike | null | undefined, { withCountry = false } = {}): string {
  if (!address) return '';
  const number = [address.exterior_number, address.interior_number && `Int. ${address.interior_number}`].filter(Boolean).join(' ');
  const street = [address.street, number].filter(Boolean).join(' ');
  const place = [address.postal_code, address.city].filter(Boolean).join(' ');
  const region = address.state && address.state !== address.city ? address.state : '';
  return [street, place, region, withCountry ? address.country_code : ''].filter(Boolean).join(', ');
}

/** "29.07290, -110.95590". */
export function formatPoint(point: GeoPoint): string {
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}
