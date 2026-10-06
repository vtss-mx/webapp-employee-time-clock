import { t } from '../i18n/core';
import type { TaxIdTypeItem } from '../types';
import type { CatalogApi } from './catalogs';
import { normalizeRfc, validateCompanyRfc } from './validation';

/*
 * Identificador fiscal de una empresa de cualquier país (migración 0074 del backend; decisión del dueño del producto,
 * 2026-10-06): país fiscal + tipo (catálogo `tax_id_types`) + número. El backend es la única fuente: los tipos, su
 * formato y su ejemplo llegan en los catálogos y él vuelve a validar todo al guardar (también el dígito verificador de
 * los que lo tienen). Aquí solo lo que hace falta para la captura: proponer, normalizar mientras se escribe, avisar el
 * formato antes de enviar y mostrarlo.
 */

/** Códigos que la lógica nombra (los mismos del backend, `app/schemas/tax_ids.py`); lo demás es dato del catálogo. */
export const RFC_TAX_ID_TYPE = 'MX_RFC';
export const OTHER_TAX_ID_TYPE = 'OTHER';
/** País fiscal que se propone: el de la plataforma (el backend usa el mismo cuando llega el número sin país). */
export const DEFAULT_TAX_COUNTRY = 'MX';

/** Los tres datos como viajan y se guardan (null o vacío = sin capturar). */
export interface TaxIdParts {
  tax_country: string | null;
  tax_id_type: string | null;
  tax_id: string | null;
}

/** Tipos que se ofrecen para un país: los suyos y los de cualquier país («Otro»), activos y en el orden del catálogo. */
export function taxIdTypesFor(types: readonly TaxIdTypeItem[], country: string): TaxIdTypeItem[] {
  return types.filter((type) => type.active && (type.country_code === country || type.country_code === null));
}

/** El tipo que se propone para un país: el primero de los suyos o, si no tiene, «Otro» (la misma regla del backend). */
export function mainTaxIdType(types: readonly TaxIdTypeItem[], country: string): string {
  return types.find((type) => type.active && type.country_code === country)?.code ?? OTHER_TAX_ID_TYPE;
}

/**
 * El número como se guarda, mientras se escribe: mayúsculas, sin espacios, guiones, puntos ni diagonales (ni otro
 * carácter que ningún formato del catálogo usa) y hasta el largo de su tipo.
 */
export function normalizeTaxId(value: string, type?: TaxIdTypeItem): string {
  const number = normalizeRfc(value);
  return type ? number.slice(0, type.max_length) : number;
}

/** ¿El número cumple la regla del catálogo? Una regla que el navegador no entiende no bloquea: la aplica el backend. */
function matchesPattern(number: string, pattern: string): boolean {
  try {
    return new RegExp(pattern).test(number);
  } catch {
    return true;
  }
}

/**
 * Formato del número según su tipo (solo UX: el backend vuelve a validarlo y revisa el dígito verificador). Vacío no
 * es un error: es opcional. El RFC conserva su validación completa de siempre; los demás, el largo y la regla del
 * catálogo. Sin el tipo (un código que el catálogo ya no tiene) no se avisa nada: decide el backend.
 */
export function validateTaxId(number: string, type: TaxIdTypeItem | undefined): string | undefined {
  if (!number.trim() || !type) return undefined;
  if (type.code === RFC_TAX_ID_TYPE) return validateCompanyRfc(number);
  const { short_name: name, min_length: min, max_length: max } = type;
  if (number.length < min || number.length > max) {
    return min === max ? t('forms.validation.taxId.lengthExact', { name, length: min }) : t('forms.validation.taxId.length', { name, min, max });
  }
  if (!matchesPattern(number, type.pattern)) return t('forms.validation.taxId.format', { name, example: type.example });
  return undefined;
}

/**
 * «Opcional · 9 dígitos · p. ej. 123456789»: la ayuda del número con el formato (o, si el catálogo no lo describe, el
 * nombre del tipo) y el ejemplo de su tipo.
 */
export function taxIdHint(type: TaxIdTypeItem | undefined): string {
  return type ? t('admin.form.taxId.numberHint', { format: type.description ?? type.name, example: type.example }) : t('admin.form.taxId.optional');
}

/** El número, su tipo y su país juntos, para comparar: sin número no hay identificador (el país y el tipo no cuentan). */
export function taxIdKey({ tax_country, tax_id_type, tax_id }: TaxIdParts): string {
  return tax_id?.trim() ? [tax_country, tax_id_type, tax_id.trim()].join('|') : '';
}

/**
 * «RFC · PNO120315AB1 · México»: el identificador como se muestra, con la sigla de su tipo y el nombre de su país en el
 * idioma activo (los manda el backend); null si no lo capturó.
 */
export function formatTaxId(parts: TaxIdParts, catalogs: Pick<CatalogApi, 'byCode' | 'nameOf'>): string | null {
  if (!parts.tax_id?.trim()) return null;
  const type = catalogs.byCode('tax_id_types', parts.tax_id_type)?.short_name ?? parts.tax_id_type ?? '';
  return t('admin.form.taxId.display', { type, number: parts.tax_id.trim(), country: catalogs.nameOf('countries', parts.tax_country) });
}
