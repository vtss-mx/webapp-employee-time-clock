import { AsYouType, isSupportedCountry, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max';
import { t } from '../i18n/core';
import { localizedError } from '../i18n/lazy';
import type { CountryItem } from '../types';

/**
 * Teléfonos internacionales. Los países (nombre, lada, frecuentes y orden) vienen del catálogo
 * de la BD; libphonenumber (metadatos completos) da el formato y valida igual que el backend.
 * El valor de los formularios y de la API es E.164: `+<lada><número>` (p. ej. +526621234567).
 * Este módulo solo lo cargan las pantallas con teléfonos (no el login).
 */

export interface CountryOption {
  code: CountryCode;
  name: string;
  /** Lada con "+" ("+52"). */
  dialCode: string;
  flag: string;
  featured: boolean;
  /** Texto de búsqueda sin acentos: nombre, código ISO y lada. */
  search: string;
}

export interface PhoneParts {
  country: CountryOption;
  national: string;
}

/** Países del selector de lada y lectura de números con lada. */
export interface CountryDirectory {
  /** Países activos del catálogo, en su orden (los frecuentes primero). */
  options: CountryOption[];
  /** País por omisión: el primer frecuente activo. */
  defaultCountry: CountryOption;
  /** Texto con lada (`+…` o `00…`) → país y número nacional; null si no se reconoce. */
  parse: (text: string, preferred?: CountryOption) => PhoneParts | null;
  /** Valor E.164 → país y número nacional para el control. */
  split: (value: string, preferred?: CountryOption) => PhoneParts;
}

export const foldText = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Bandera como emoji (indicadores regionales). */
export function flagOf(code: string): string {
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

/** Del catálogo, solo los activos que libphonenumber sabe formatear y validar. */
const isUsable = (item: CountryItem): item is CountryItem & { code: CountryCode } => item.active && isSupportedCountry(item.code);

function toOption({ code, name, dial_code: dialCode, featured }: CountryItem & { code: CountryCode }): CountryOption {
  return { code, name, dialCode, flag: flagOf(code), featured, search: foldText(`${name} ${code} ${dialCode}`) };
}

export function countryDirectory(countries: CountryItem[]): CountryDirectory {
  const options = countries.filter(isUsable).map(toOption);
  const defaultCountry = options.find((country) => country.featured) ?? options.at(0);
  if (!defaultCountry) throw localizedError(() => t('forms.phone.noCountries'));
  const byCode = new Map(options.map((country) => [country.code, country]));

  /** País de una lada: el preferido si la comparte (como +1); si no, el primero del catálogo. */
  const forDialCode = (dialCode: string, preferred: CountryOption) =>
    preferred.dialCode === dialCode ? preferred : (options.find((country) => country.dialCode === dialCode) ?? preferred);

  const parse = (text: string, preferred = defaultCountry): PhoneParts | null => {
    const parsed = parsePhoneNumberFromString(text.trim().replace(/^00/, '+'));
    if (!parsed) return null;
    const country = (parsed.country && byCode.get(parsed.country)) ?? forDialCode(`+${parsed.countryCallingCode}`, preferred);
    return { country, national: parsed.nationalNumber };
  };

  const split = (value: string, preferred = defaultCountry): PhoneParts => {
    if (!value) return { country: preferred, national: '' };
    if (value.startsWith(preferred.dialCode)) return { country: preferred, national: value.slice(preferred.dialCode.length) };
    return parse(value, preferred) ?? { country: preferred, national: value.replace(/\D/g, '') };
  };

  return { options, defaultCountry, parse, split };
}

/** País + número nacional → E.164 ("" si no hay número). */
export function joinPhone(country: CountryOption, national: string): string {
  const digits = national.replace(/\D/g, '');
  return digits ? `${country.dialCode}${digits}` : '';
}

/** Número nacional con el formato del país mientras se escribe ("662 123 4567"). */
export const formatNational = (country: CountryOption, national: string) => new AsYouType(country.code).input(national);

export function validatePhone(value: string): string | undefined {
  if (!value) return t('forms.phone.required');
  const parsed = parsePhoneNumberFromString(value);
  if (parsed?.isValid() && new Set(parsed.nationalNumber).size > 1) return undefined;
  return t('forms.phone.invalid', { code: parsed?.countryCallingCode ?? value.replace(/\D/g, '').slice(0, 3) });
}

/** E.164 → "+52 662 123 4567" para mostrar. */
export function formatPhone(value: string): string {
  return parsePhoneNumberFromString(value)?.formatInternational() ?? value;
}
