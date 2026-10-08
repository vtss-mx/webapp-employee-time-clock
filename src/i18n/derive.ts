import type { Translation } from '../types/i18n';

/** Las llaves que cambian en un diccionario derivado: cualquier subconjunto, con la misma forma que el original. */
export type Overrides<T> = { readonly [K in keyof T]?: T[K] extends string ? string : Overrides<T[K]> };

/**
 * Un diccionario derivado de otro del mismo idioma base: las mismas llaves, sobrescribiendo solo lo que cambia
 * (es-ES sobre es-MX: «fichar» por «checar», «móvil» por «celular»). Así el español común no se duplica (regla 6 de la
 * raíz) y el glosario de diferencias (`docs/i18n/glosario.md` §3) queda escrito en el código. Una llave que el
 * original no tiene no compila (`Overrides<T>`); la que no se sobrescribe conserva el texto original.
 */
export function derive<T extends object>(base: T, overrides: Overrides<T>): Translation<T> {
  const result: Record<string, unknown> = {};
  const patches = overrides as Record<string, unknown>;
  for (const [key, value] of Object.entries(base)) {
    const patch = patches[key];
    result[key] = typeof value === 'string' ? (patch ?? value) : derive(value as object, patch ?? {});
  }
  return result as Translation<T>;
}
