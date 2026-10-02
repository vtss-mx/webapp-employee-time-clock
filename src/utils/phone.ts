import { AsYouType, getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max';

/**
 * Teléfonos internacionales con libphonenumber (metadatos completos: valida igual que el backend).
 * El valor de los formularios y de la API es E.164: `+<lada><número>` (p. ej. +526621234567).
 * Este módulo solo lo cargan las pantallas con teléfonos (no el login).
 */
export type { CountryCode };

export const DEFAULT_COUNTRY: CountryCode = 'MX';
/** Primero, los países más frecuentes para las empresas de la plataforma. */
const FEATURED: CountryCode[] = ['MX', 'US', 'CA', 'GT', 'SV', 'HN', 'CR', 'PA', 'CO', 'ES'];

export interface CountryOption {
  code: CountryCode;
  name: string;
  dialCode: string;
  flag: string;
  featured: boolean;
  /** Texto de búsqueda sin acentos: nombre, código ISO y lada. */
  search: string;
}

const regionNames = new Intl.DisplayNames(['es'], { type: 'region' });
export const foldText = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Bandera como emoji (indicadores regionales). */
export function flagOf(code: string): string {
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

export const countryName = (code: CountryCode) => regionNames.of(code) ?? code;
export const dialCodeOf = (code: CountryCode) => `+${getCountryCallingCode(code)}`;

function option(code: CountryCode, featured: boolean): CountryOption {
  const name = countryName(code);
  const dialCode = dialCodeOf(code);
  return { code, name, dialCode, flag: flagOf(code), featured, search: foldText(`${name} ${code} ${dialCode}`) };
}

/** Frecuentes primero; después todos los países en orden alfabético (español). */
export const COUNTRY_OPTIONS: CountryOption[] = [
  ...FEATURED.map((code) => option(code, true)),
  ...getCountries()
    .filter((code) => !FEATURED.includes(code))
    .map((code) => option(code, false))
    .sort((a, b) => a.name.localeCompare(b.name, 'es')),
];

/** País de una lada (si la comparten varios, como +1, el más frecuente). */
function countryForCallingCode(callingCode: string, preferred: CountryCode): CountryCode {
  if (getCountryCallingCode(preferred) === callingCode) return preferred;
  return COUNTRY_OPTIONS.find((c) => c.dialCode === `+${callingCode}`)?.code ?? preferred;
}

/** Texto con lada (`+…` o `00…`) → país y número nacional; null si no se reconoce. */
export function parseInternational(text: string, preferred: CountryCode = DEFAULT_COUNTRY): { country: CountryCode; national: string } | null {
  const parsed = parsePhoneNumberFromString(text.trim().replace(/^00/, '+'));
  if (!parsed) return null;
  return { country: parsed.country ?? countryForCallingCode(parsed.countryCallingCode, preferred), national: parsed.nationalNumber };
}

/** Valor E.164 → país y número nacional para el control. */
export function splitPhone(value: string, preferred: CountryCode = DEFAULT_COUNTRY): { country: CountryCode; national: string } {
  if (!value) return { country: preferred, national: '' };
  const prefix = dialCodeOf(preferred);
  if (value.startsWith(prefix)) return { country: preferred, national: value.slice(prefix.length) };
  return parseInternational(value, preferred) ?? { country: preferred, national: value.replace(/\D/g, '') };
}

/** País + número nacional → E.164 ("" si no hay número). */
export function joinPhone(country: CountryCode, national: string): string {
  const digits = national.replace(/\D/g, '');
  return digits ? `${dialCodeOf(country)}${digits}` : '';
}

/** Número nacional con el formato del país mientras se escribe ("662 123 4567"). */
export const formatNational = (country: CountryCode, national: string) => new AsYouType(country).input(national);

export function validatePhone(value: string): string | undefined {
  if (!value) return 'El teléfono es obligatorio';
  const parsed = parsePhoneNumberFromString(value);
  if (parsed?.isValid() && new Set(parsed.nationalNumber).size > 1) return undefined;
  return `El teléfono no es válido para la lada +${parsed?.countryCallingCode ?? value.replace(/\D/g, '').slice(0, 3)}`;
}

/** E.164 → "+52 662 123 4567" para mostrar. */
export function formatPhone(value: string): string {
  return parsePhoneNumberFromString(value)?.formatInternational() ?? value;
}
