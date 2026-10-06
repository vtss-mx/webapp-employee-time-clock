import { describe, expect, it } from 'vitest';
import * as enUS from './locales/en-US';
import esMX from './locales/es-MX';

/**
 * Guardián de la regla 16 (todo existe en los dos idiomas): es-MX y en-US tienen exactamente las
 * mismas llaves, las mismas variables en cada texto y las mismas formas de plural. Los tipos ya lo
 * exigen al compilar; esta prueba lo verifica sobre los diccionarios reales (y con mensajes claros).
 */
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
const en = flatten(enUS);
const placeholders = (text: string) => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
const PLURAL = /_(zero|one|two|few|many|other)$/;
/** Cada tramo de la llave en camelCase; los plurales con su forma al final; códigos de idioma tal cual. */
const KEY_SEGMENT = /^([a-z][A-Za-z0-9]*|[A-Z][A-Z0-9_]*|[a-z]{2}-[A-Z]{2}|\d+)$/;

describe('diccionarios es-MX y en-US', () => {
  it('tienen exactamente las mismas llaves', () => {
    const missingInEnglish = [...es.keys()].filter((key) => !en.has(key));
    const missingInSpanish = [...en.keys()].filter((key) => !es.has(key));
    expect(missingInEnglish).toEqual([]);
    expect(missingInSpanish).toEqual([]);
    expect(es.size).toBeGreaterThan(0);
  });

  it('cada texto lleva las mismas variables en los dos idiomas', () => {
    const different = [...es].filter(([key, text]) => placeholders(text).join() !== placeholders(en.get(key) ?? '').join()).map(([key]) => key);
    expect(different).toEqual([]);
  });

  it('los plurales tienen su forma `other` y las mismas formas en ambos idiomas', () => {
    const bases = new Set([...es.keys()].filter((key) => PLURAL.test(key)).map((key) => key.replace(PLURAL, '')));
    const incomplete = [...bases].filter((base) => !es.has(`${base}_other`) || !en.has(`${base}_other`));
    expect(incomplete).toEqual([]);
    // Una llave de plural no puede ser también una llave simple (sería ambiguo cuál se usa).
    expect([...bases].filter((base) => es.has(base))).toEqual([]);
  });

  it('ningún texto está vacío ni tiene espacios sobrantes', () => {
    const bad = [...es, ...en].filter(([, text]) => !text.trim() || text !== text.trim()).map(([key]) => key);
    expect(bad).toEqual([]);
  });

  it('las llaves siguen la convención (camelCase y `_` solo para la forma del plural)', () => {
    const bad = [...es.keys()].filter((key) => !key.replace(PLURAL, '').split('.').every((segment) => KEY_SEGMENT.test(segment)));
    expect(bad).toEqual([]);
  });
});
