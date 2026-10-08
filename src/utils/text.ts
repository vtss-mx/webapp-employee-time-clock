import { currentLocale, type Locale } from '../i18n/core';

/** Idiomas que escriben los sustantivos con mayúscula también a mitad de frase: el nombre de un catálogo no se baja. */
const KEEP_CASE: ReadonlySet<Locale> = new Set<Locale>(['de-DE']);

/**
 * Texto comparable: en minúsculas y sin acentos («Cámara Virtual» → «camara virtual»). Lo usan las búsquedas (países,
 * listas) y las reglas que reconocen una cámara por su nombre, que el sistema escribe con o sin acentos («Câmera»).
 */
export const foldText = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/**
 * El nombre de un registro de un catálogo dentro de una frase («Registrar {action}», «Quítate {name}», «por {period}»):
 * en minúsculas en el idioma activo («Registrar entrada»), salvo en alemán, donde los sustantivos conservan su
 * mayúscula («Kommen erfassen», «pro Monat»). Un nombre ya en minúsculas o un código no cambia.
 */
export function inSentence(name: string): string {
  const locale = currentLocale();
  return KEEP_CASE.has(locale) ? name : name.toLocaleLowerCase(locale);
}
