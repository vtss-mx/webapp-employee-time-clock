/**
 * Catálogos y pantallas del backend falso en cada idioma: el español de los catálogos de prueba (los mismos
 * registros que `alembic/seed/catalogs.json`) y, en los demás idiomas, las traducciones REALES del backend
 * (`alembic/seed/catalogs.<idioma>.json`, las de `catalog.translations`). Un texto de un catálogo sin traducción
 * se quedaría en español y la prueba del idioma lo señalaría.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LOCALES, type Locale } from '../../i18n/core';
import type { Catalogs, User } from '../../types';
import { catalogsFixture } from '../catalogs';

type Translations = Record<string, Record<string, Record<string, string>>>;

const SEED = resolve(process.cwd(), '../backend-employee-time-clock/alembic/seed');
/** Las traducciones reales de cada idioma que no es el de omisión (el español vive en los registros). */
const TRANSLATIONS = new Map<Locale, Translations>(
  LOCALES.filter((locale) => locale !== 'es-MX').map((locale) => [locale, JSON.parse(readFileSync(resolve(SEED, `catalogs.${locale}.json`), 'utf-8')) as Translations]),
);

/** Columnas de texto que se traducen (`TRANSLATED_FIELDS` del backend). */
const TEXT_FIELDS = ['name', 'description', 'message', 'phrase', 'instruction', 'employee_note', 'short_name'] as const;

/** Un registro con sus textos en el idioma pedido (los que el registro tiene). */
function translated<T extends object>(catalog: string, item: T & { code: string }, locale: Locale): T {
  const translation = TRANSLATIONS.get(locale)?.[catalog]?.[item.code];
  if (!translation) return item;
  const texts = Object.fromEntries(TEXT_FIELDS.filter((field) => field in item && translation[field] !== undefined).map((field) => [field, translation[field]]));
  return { ...item, ...texts };
}

/** GET /api/catalogs en el idioma de la petición. */
export function localizedCatalogs(locale: Locale): Catalogs {
  return Object.fromEntries(Object.entries(catalogsFixture).map(([key, items]) => [key, (items as Array<{ code: string }>).map((item) => translated(key, item, locale))])) as unknown as Catalogs;
}

/** El usuario con los nombres de sus pantallas y módulos del menú en el idioma de la petición. */
export function localizedUser(user: User, locale: Locale): User {
  return {
    ...user,
    screens: user.screens.map((screen) => translated('screens', screen, locale)),
    modules: user.modules?.map((module) => translated('menu_modules', module, locale)),
  };
}
