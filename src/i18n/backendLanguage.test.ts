import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { describeIssues, languageIssues } from '../test/language';
import { LOCALES, type Locale } from './core';

/**
 * Guardián de la regla 16 («nunca se mezclan idiomas») sobre los textos del BACKEND en los siete idiomas: su catálogo
 * de mensajes (`app/i18n/messages/<idioma>`; `es_es` deriva de `es_mx` y solo trae sus `OVERRIDES`) y los textos de
 * los catálogos de la BD (`alembic/seed/catalogs.json` en español de México y `catalogs.<idioma>.json` en los demás).
 * Con el mismo revisor estricto de la app (`src/test/language.ts`): una palabra que el idioma no conoce falla y, si
 * la conoce otro idioma de la app, se señala como tal («spoofing», «embedding» o «morphing» en español). La
 * ortografía por archivo la revisa además el cspell del backend (`backend-employee-time-clock/cspell.json`).
 */
const BACKEND = resolve(process.cwd(), '../backend-employee-time-clock');
/** El paquete de mensajes y el archivo de catálogos de cada idioma (el español de México vive en `catalogs.json`). */
const messagesFolder = (locale: Locale) => `app/i18n/messages/${locale.toLowerCase().replace('-', '_')}`;
const catalogsFile = (locale: Locale) => (locale === 'es-MX' ? 'alembic/seed/catalogs.json' : `alembic/seed/catalogs.${locale}.json`);
/** Columnas de texto de los catálogos (`TRANSLATED_FIELDS` del backend). */
const TEXT_FIELDS = new Set(['name', 'description', 'message', 'phrase', 'instruction', 'employee_note', 'short_name']);

/** Los textos de un archivo de mensajes de Python: cada cadena que no es una llave (sin docstrings ni comentarios). */
function messageTexts(source: string): string[] {
  const code = source
    .replace(/"""[\s\S]*?"""/g, '')
    .replace(/^\s*#.*$/gm, '')
    .replace(/"(?:[^"\\\n]|\\.)*"\s*:/g, ''); // las llaves
  return [...code.matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'/g)]
    .map((match) => match[1] ?? match[2])
    .filter((text) => /\p{L}/u.test(text) && !/^[A-Z0-9_]+$/.test(text)); // un código no es texto
}

/** Los textos de un archivo de catálogos (cualquier profundidad): solo sus columnas de texto. */
function catalogTexts(value: unknown, key = ''): string[] {
  if (typeof value === 'string') return TEXT_FIELDS.has(key) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap((item) => catalogTexts(item));
  if (typeof value === 'object' && value !== null) return Object.entries(value).flatMap(([name, item]) => catalogTexts(item, name));
  return [];
}

/**
 * Lo que el cspell del backend tampoco revisa (sus `ignoreRegExpList`): `identificadores` entre comillas invertidas,
 * nombres internos con punto o guion bajo, variables de configuración (`GCS_BUCKET`) y «N-ésimo» (el N-ésimo cargo).
 */
const withoutCode = (text: string) => text.replace(/`[^`\n]*`/g, ' ').replace(/\b[a-z]+(?:[._][a-z]+)+\b/g, ' ').replace(/\d*N-ésimo/g, ' ').replace(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g, ' ');

function backendTexts(locale: Locale): string[] {
  const folder = resolve(BACKEND, messagesFolder(locale));
  const messages = readdirSync(folder)
    .filter((file) => file.endsWith('.py') && file !== '__init__.py')
    .flatMap((file) => messageTexts(readFileSync(resolve(folder, file), 'utf-8')));
  return [...messages, ...catalogTexts(JSON.parse(readFileSync(resolve(BACKEND, catalogsFile(locale)), 'utf-8')))].map(withoutCode);
}

describe.skipIf(!existsSync(BACKEND))('textos del backend: ningún texto mezcla idiomas', () => {
  it('lee los textos y no las llaves, los docstrings ni los comentarios', () => {
    expect(messageTexts('"""Docs."""\n# nota\nMESSAGES = {\n    "KEY": "Texto {name}",\n    "PLURAL": {"one": "Uno", "other": "Varios"},\n}')).toEqual(['Texto {name}', 'Uno', 'Varios']);
    expect(catalogTexts({ roles: [{ code: 'ADMIN', name: 'Administrador', icon: 'Clock' }] })).toEqual(['Administrador']);
    expect(withoutCode('Falta `GCS_BUCKET` en catalog.reasons (el 2N-ésimo)').split(/\s+/).filter(Boolean)).toEqual(['Falta', 'en', '(el', ')']);
  });

  it.each(LOCALES)('%s: solo palabras de su idioma', async (locale) => {
    const texts = backendTexts(locale);
    expect(texts.length).toBeGreaterThan(500);
    expect(describeIssues(await languageIssues(texts, locale))).toEqual([]);
  });
});
