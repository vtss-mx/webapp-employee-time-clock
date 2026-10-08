import { describe, expect, it } from 'vitest';
import { LOCALES } from './core';
import esMX from './locales/es-MX';

/**
 * Guardián de la regla 16 (todo existe en los siete idiomas): cada diccionario de `src/i18n/locales/` tiene
 * exactamente las mismas llaves que es-MX (la fuente), las mismas variables en cada texto y las formas de plural que
 * su idioma necesita (`Intl.PluralRules`). Los tipos ya lo exigen al compilar (`satisfies Translation<typeof es>`);
 * esta prueba lo verifica sobre los diccionarios reales, con mensajes claros, y que no falte ni sobre un idioma.
 *
 * Los diccionarios se descubren por carpeta: un idioma nuevo entra solo con agregar la suya.
 */
const modules = import.meta.glob<{ default: object }>('./locales/*/index.ts');
const found = Object.keys(modules)
  .map((path) => path.split('/')[2])
  .sort();

/** El diccionario de un idioma (cada `index.ts` lo exporta por omisión: es-MX a mano, los demás con `assemble`). */
async function dictionaryOf(locale: string): Promise<object> {
  return (await modules[`./locales/${locale}/index.ts`]()).default;
}

function flatten(tree: object, prefix = ''): Map<string, string> {
  const result = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') result.set(path, value);
    else flatten(value as object, path).forEach((text, nested) => result.set(nested, text));
  }
  return result;
}

const es = flatten(esMX);
const placeholders = (text: string) => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
const PLURAL = /_(zero|one|two|few|many|other)$/;
/** Cada tramo de la llave en camelCase; los plurales con su forma al final; códigos de idioma tal cual. */
const KEY_SEGMENT = /^([a-z][A-Za-z0-9]*|[A-Z][A-Z0-9_]*|[a-z]{2}-[A-Z]{2}|\d+)$/;
const bases = new Set([...es.keys()].filter((key) => PLURAL.test(key)).map((key) => key.replace(PLURAL, '')));
/** Las formas de plural de una llave en un diccionario (`dias_one`, `dias_other` → one, other). */
const formsOf = (table: Map<string, string>, base: string) => ['zero', 'one', 'two', 'few', 'many', 'other'].filter((form) => table.has(`${base}_${form}`));

describe('diccionarios de la app', () => {
  it('hay un diccionario por idioma de LOCALES, y ninguno de más', () => {
    expect(found).toEqual([...LOCALES].sort());
  });

  it('es-MX (la fuente): llaves en camelCase y `_` solo para la forma del plural; ninguna llave de plural es también simple', () => {
    const bad = [...es.keys()].filter((key) => !key.replace(PLURAL, '').split('.').every((segment) => KEY_SEGMENT.test(segment)));
    expect(bad).toEqual([]);
    expect([...bases].filter((base) => es.has(base))).toEqual([]);
    expect([...bases].filter((base) => !es.has(`${base}_one`) || !es.has(`${base}_other`))).toEqual([]);
    expect(es.size).toBeGreaterThan(0);
  });
});

describe.each(found.filter((locale) => locale !== 'es-MX'))('diccionario %s', (locale) => {
  it('tiene exactamente las mismas llaves que es-MX', async () => {
    const table = flatten(await dictionaryOf(locale));
    expect([...es.keys()].filter((key) => !table.has(key)), 'faltan').toEqual([]);
    expect([...table.keys()].filter((key) => !es.has(key)), 'sobran').toEqual([]);
  });

  it('cada texto lleva las mismas variables que es-MX', async () => {
    const table = flatten(await dictionaryOf(locale));
    const different = [...es].filter(([key, text]) => placeholders(text).join() !== placeholders(table.get(key) ?? '').join()).map(([key]) => key);
    expect(different).toEqual([]);
  });

  it('los plurales tienen las formas de su idioma (Intl.PluralRules) y las de es-MX', async () => {
    const table = flatten(await dictionaryOf(locale));
    // `zero` es propia de la app (un texto para el cero aunque el idioma no la distinga); `many` (millones) cae en `other`.
    const categories = new Set([...new Intl.PluralRules(locale).resolvedOptions().pluralCategories, 'zero']);
    const required = ['one', 'two', 'few'].filter((form) => categories.has(form));
    const wrong = [...bases].filter((base) => {
      const forms = formsOf(table, base);
      return forms.join() !== formsOf(es, base).join() || !forms.includes('other') || !required.every((form) => forms.includes(form)) || forms.some((form) => !categories.has(form));
    });
    expect(wrong).toEqual([]);
  });

  it('ningún texto está vacío ni tiene espacios sobrantes', async () => {
    const table = flatten(await dictionaryOf(locale));
    const bad = [...table].filter(([, text]) => !text.trim() || text !== text.trim()).map(([key]) => key);
    expect(bad).toEqual([]);
  });
});
