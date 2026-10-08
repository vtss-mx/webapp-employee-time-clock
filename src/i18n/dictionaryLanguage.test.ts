import { describe, expect, it } from 'vitest';
import { describeIssues, foreignWordsInList, languageIssues } from '../test/language';
import type { Locale } from './core';
import { endonymTexts } from './endonyms';

/**
 * Guardián de la regla 16 («nunca se mezclan idiomas»): cada texto de cada diccionario está solo en su idioma. Más
 * estricto que la ortografía por archivo de `npm run spell`: usa el revisor de `src/test/language.ts` (solo el
 * diccionario del idioma, la lista común y la lista propia; sin los diccionarios de programación de cspell) y señala
 * si la palabra que falló es de otro de los idiomas de la app. Solo pasan los nombres propios y siglas de la lista
 * común (`cspell-words.txt`), la marca «Employee Time Clock» y el nombre de cada idioma en sí mismo (`ENDONYMS`).
 * Y las listas propias no esconden préstamos: ninguna palabra del inglés en la lista de otro idioma, ni al revés.
 *
 * Los diccionarios se descubren por carpeta: un idioma nuevo entra solo con agregar la suya.
 */
const modules = import.meta.glob<{ default: object }>('./locales/*/index.ts');
const found = Object.keys(modules)
  .map((path) => path.split('/')[2] as Locale)
  .sort();

function values(tree: object): string[] {
  return Object.values(tree).flatMap((value: unknown) => (typeof value === 'string' ? [value] : values(value as object)));
}

describe('diccionarios: ningún texto mezcla idiomas', () => {
  it.each(found)('%s: solo palabras de su idioma', async (locale) => {
    const { default: dictionary } = await modules[`./locales/${locale}/index.ts`]();
    const issues = await languageIssues(values(dictionary), locale, endonymTexts());
    expect(describeIssues(issues)).toEqual([]);
  });

  it.each(found)('%s: su lista de palabras propias no esconde palabras de otro idioma', async (locale) => {
    expect(await foreignWordsInList(locale)).toEqual([]);
  });
});
