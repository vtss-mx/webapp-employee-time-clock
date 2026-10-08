/**
 * Textos del servidor en el idioma VIGENTE, también los que ya están en pantalla (regla 16: «todo en caliente,
 * también lo que envía el servidor»).
 *
 * Cada respuesta de la API trae `message` y `errors[].message` en el idioma de la petición y, en `i18n`, esos
 * mismos textos en cada idioma que habla la API (`{ "es-MX": { message, errors[], texts[] }, "en-US": {…} }`; `texts`:
 * los textos del servidor dentro de `data` de una escritura, como el resultado de checar). Un texto
 * del servidor que ya se mostró o se copió a otra parte —el popup abierto de un error al guardar, el error de un
 * campo en el estado de un formulario, el aviso de éxito de una restauración— no se puede volver a pedir (la
 * petición no se repite: crearía o cambiaría algo otra vez). Por eso se recuerdan sus versiones y se dibujan en
 * el idioma activo al cambiarlo, al instante y sin red:
 *
 * - `ServerTexts` (`textsOf`): las versiones de los textos de UNA respuesta; `ApiError` guarda las suyas y su
 *   `message` y los de `errors` se leen en el idioma vigente.
 * - `rememberServerTexts` + `localizeServerText`: memoria acotada de los textos recientes para las copias; los
 *   puntos por donde pasan todos ellos la usan al dibujar (`MessageDialog` en los popups, `FieldMessage` bajo los
 *   campos). Un texto que no es del servidor (los de la app ya se traducen con `t`) se devuelve tal cual.
 *
 * Los datos (`data`) no van aquí: las pantallas los vuelven a pedir al cambiar el idioma (`useResource`,
 * `usePagedList`, `usePolledValue`, catálogos y usuario).
 */
import { currentLocale, isLocale, type Locale } from './core';

/** Un texto del servidor en cada idioma (el que falte no se conoce). */
export type ServerTextVariants = Readonly<Partial<Record<Locale, string>>>;

/** Los textos de una respuesta en un idioma: el mensaje, los de cada error (en el orden de `errors`) y los de sus datos. */
export interface LocaleTexts {
  readonly message: string;
  readonly errors: readonly string[];
  /** Textos del servidor dentro de `data` de una escritura (POST, PUT...): el mismo orden en cada idioma. */
  readonly texts: readonly string[];
}

/** `i18n` del sobre: por idioma, sus textos. */
export type EnvelopeI18n = Readonly<Partial<Record<Locale, LocaleTexts>>>;

/** Las versiones de cada texto de una respuesta, buscadas por cualquiera de ellas. */
export type ServerTexts = ReadonlyMap<string, ServerTextVariants>;

/** Tope de la memoria: los textos de las respuestas recientes (un popup abierto o un formulario con errores). */
const MAX_REMEMBERED = 500;
const remembered = new Map<string, ServerTextVariants>();

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isTextList = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');

/** El `i18n` de un sobre con la forma esperada; uno que no la tiene (otro servidor, un proxy) se ignora: null. */
export function parseEnvelopeI18n(raw: unknown): EnvelopeI18n | null {
  if (!isRecord(raw)) return null;
  const parsed: Partial<Record<Locale, LocaleTexts>> = {};
  for (const [locale, texts] of Object.entries(raw)) {
    if (isLocale(locale) && isRecord(texts) && typeof texts.message === 'string' && isTextList(texts.errors)) {
      parsed[locale] = { message: texts.message, errors: texts.errors, texts: isTextList(texts.texts) ? texts.texts : [] };
    }
  }
  return Object.keys(parsed).length ? parsed : null;
}

/** Versiones de cada texto (el mensaje, cada error y cada texto de los datos, en la misma posición) buscables por cualquiera de ellas. */
export function textsOf(i18n: EnvelopeI18n | null): ServerTexts {
  const texts = new Map<string, ServerTextVariants>();
  if (!i18n) return texts;
  const entries = Object.entries(i18n) as Array<[Locale, LocaleTexts]>;
  const add = (pick: (entry: LocaleTexts) => string | undefined) => {
    const variants: Partial<Record<Locale, string>> = {};
    for (const [locale, entry] of entries) {
      const text = pick(entry);
      if (text) variants[locale] = text;
    }
    Object.values(variants).forEach((text) => texts.set(text, variants));
  };
  add((entry) => entry.message);
  for (const list of ['errors', 'texts'] as const) {
    const length = Math.max(...entries.map(([, entry]) => entry[list].length));
    for (let index = 0; index < length; index++) add((entry) => entry[list][index]);
  }
  return texts;
}

/** Recuerda los textos de una respuesta (los más recientes al final; los más viejos salen al pasar el tope). */
export function rememberServerTexts(texts: ServerTexts): void {
  for (const [text, variants] of texts) {
    remembered.delete(text);
    remembered.set(text, variants);
  }
  for (const oldest of remembered.keys()) {
    if (remembered.size <= MAX_REMEMBERED) break;
    remembered.delete(oldest);
  }
}

/** El texto en el idioma activo: su versión si es un texto del servidor conocido; si no, tal cual. */
export function localizeServerText(text: string, texts: ServerTexts = remembered): string {
  return texts.get(text)?.[currentLocale()] ?? remembered.get(text)?.[currentLocale()] ?? text;
}

/** Olvida lo recordado (pruebas). */
export function forgetServerTexts(): void {
  remembered.clear();
}
