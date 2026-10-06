import { t } from '../i18n/core';
import { formatCount } from './numbers';

/**
 * Límite de validadores de una empresa (lo fija el ADMIN; decisión del dueño del producto): validadores ACTIVOS que
 * puede tener; 0 apaga el módulo (su pantalla no aparece). Nunca menos de los activos que ya tiene: el backend lo
 * rechaza (409 `VALIDATOR_LIMIT_BELOW_ACTIVE`) y aquí solo se avisa antes de enviar (UX).
 */

/** Tope de validadores activos que el ADMIN puede darle a una empresa (el mismo del backend, `VALIDATORS_MAX`). */
export const VALIDATORS_MAX = 1000;

/** Obligatorio y entero de `min` (los validadores activos de la empresa al editarla) a `VALIDATORS_MAX`. */
export function validateMaxValidators(value: string, min = 0): string | undefined {
  const text = value.trim();
  if (!text) return t('admin.form.maxValidatorsRequired');
  const number = Number(text);
  const valid = Number.isInteger(number) && number >= min && number <= VALIDATORS_MAX;
  return valid ? undefined : t('admin.form.maxValidatorsRange', { min: formatCount(min), max: formatCount(VALIDATORS_MAX) });
}
