/**
 * Traducción de la interfaz en los siete idiomas (es-MX por omisión, en-US, pt-BR, fr-FR, de-DE, it-IT y es-ES): una capa
 * propia y pequeña, sin librerías.
 *
 * - Un solo estado por pestaña con el idioma activo y su traductor; `t()` sirve en cualquier parte
 *   (componentes, hooks, reglas puras) y `useT()` (`./react`) además redibuja al cambiar el idioma.
 * - Llaves con tipo (`MessageKey`): una llave inexistente o una variable que falta no compila.
 * - Variables `{nombre}`; plurales con `Intl.PluralRules` (`llave_one`, `llave_other` y, si se quiere
 *   un texto propio para cero, `llave_zero`) usando `count`, que además se muestra con separador de
 *   miles. Las demás variables numéricas se muestran tal cual (un año no lleva coma).
 * - Cada idioma es un archivo aparte que se descarga solo cuando se usa: el idioma que no se usa no
 *   viaja en la carga inicial.
 * - Los textos que envía el backend (`message`, catálogos) ya llegan en el idioma de la petición
 *   (`Accept-Language`): nunca se traducen aquí.
 */
import type { Locale, Messages, Translate, Translation } from '../types/i18n';
import { config } from '../utils/config';
import { importWithRetry } from '../utils/importRetry';
import { DEFAULT_LOCALE } from './negotiation';

export type { Locale, MessageKey, Translate } from '../types/i18n';

/** Idiomas de la aplicación, en el orden en que se ofrecen (el mismo que `LOCALES` del backend). */
export const LOCALES: readonly Locale[] = ['es-MX', 'en-US', 'pt-BR', 'fr-FR', 'de-DE', 'it-IT', 'es-ES'];
/** La negociación con el navegador (`matchLocale`) vive aparte, en `negotiation.ts`: la comparte el aviso de `index.html`. */
export { DEFAULT_LOCALE, matchLocale } from './negotiation';

/** Un diccionario completo (el de es-MX define las llaves; los demás las repiten). */
export type Dictionary = Translation<Messages>;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

// Cada idioma exporta su diccionario completo: es-MX a mano (de él salen los tipos); los demás lo arman con `assemble`
// desde los archivos de su carpeta (es-ES deriva de es-MX con `derive`: cada archivo trae solo lo que cambia).
const LOADERS: Record<Locale, () => Promise<{ default: Dictionary }>> = {
  'es-MX': () => import('./locales/es-MX'),
  'en-US': () => import('./locales/en-US'),
  'pt-BR': () => import('./locales/pt-BR'),
  'fr-FR': () => import('./locales/fr-FR'),
  'de-DE': () => import('./locales/de-DE'),
  'it-IT': () => import('./locales/it-IT'),
  'es-ES': () => import('./locales/es-ES'),
};

type Params = Record<string, string | number>;

/** Búsqueda en el diccionario de un idioma. */
interface Engine {
  translate: (key: string, params?: Params) => string;
  template: (key: string, count?: number) => string;
}

export interface I18nState {
  readonly locale: Locale;
  /**
   * Traduce en el idioma VIGENTE, no en el de este estado: una función creada en un dibujo anterior
   * que guardó este `t` (la fábrica de un popup o de una confirmación abierta, un `useCallback`) da
   * el texto del idioma nuevo después de un cambio en caliente. Su identidad sí cambia con el idioma
   * (lo que se memoriza con `[t]` se recalcula).
   */
  readonly t: Translate;
  /** El texto de una llave sin reemplazar sus variables (para armar texto con partes enriquecidas). */
  readonly template: (key: string, count?: number) => string;
  readonly engine: Engine;
}

/** { a: { b: 'x' } } → "a.b" → "x": búsqueda directa de cada llave. */
function flatten(tree: object, prefix = '', into = new Map<string, string>()): Map<string, string> {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') into.set(path, value);
    else flatten(value as object, path, into);
  }
  return into;
}

const PLACEHOLDER = /\{(\w+)\}/g;

function build(locale: Locale, table: ReadonlyMap<string, string>): I18nState {
  const rules = new Intl.PluralRules(locale);
  const counts = new Intl.NumberFormat(locale);
  const pluralForm = (key: string, count: number) =>
    (count === 0 ? table.get(`${key}_zero`) : undefined) ?? table.get(`${key}_${rules.select(count)}`) ?? table.get(`${key}_other`);
  // Una llave que no existe (nunca con los tipos) se muestra tal cual: se nota sin romper la pantalla.
  const template = (key: string, count?: number) => (count === undefined ? undefined : pluralForm(key, count)) ?? table.get(key) ?? key;
  const translate = (key: string, params?: Params) => {
    const text = template(key, typeof params?.count === 'number' ? params.count : undefined);
    if (!params) return text;
    return text.replace(PLACEHOLDER, (match, name: string) => {
      const value = params[name];
      if (value === undefined) return match;
      return name === 'count' && typeof value === 'number' ? counts.format(value) : String(value);
    });
  };
  return {
    locale,
    t: (key: string, params?: Params) => state.engine.translate(key, params),
    template: (key: string, count?: number) => state.engine.template(key, count),
    engine: { translate, template },
  };
}

// Antes de descargar el primer diccionario (el arranque lo espera) las llaves se ven tal cual.
let state: I18nState = build(DEFAULT_LOCALE, new Map());
let active: Dictionary | null = null;
let requested: Locale | null = null;
const loaded = new Map<Locale, Dictionary>();
const listeners = new Set<() => void>();

/** Avisa cada cambio de idioma (lo usa `useSyncExternalStore`). */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Idioma y traductor vigentes (objeto nuevo en cada cambio). */
export function i18nSnapshot(): I18nState {
  return state;
}

export function currentLocale(): Locale {
  return state.locale;
}

/** Traduce en el idioma activo. En componentes se usa `useT()` para redibujar al cambiar el idioma. */
export const t: Translate = (key, ...params) => state.engine.translate(key, params[0]);

/**
 * Manifiesto de la aplicación instalable en cada idioma (`public/`): su nombre y su descripción no se mezclan con
 * los de otro idioma al instalarla.
 */
const MANIFESTS: Record<Locale, string> = {
  'es-MX': '/site.webmanifest',
  'en-US': '/site.en-US.webmanifest',
  'pt-BR': '/site.pt-BR.webmanifest',
  'fr-FR': '/site.fr-FR.webmanifest',
  'de-DE': '/site.de-DE.webmanifest',
  'it-IT': '/site.it-IT.webmanifest',
  'es-ES': '/site.es-ES.webmanifest',
};

/** La pestaña, su título, su descripción y el manifiesto en el idioma activo (lectores de pantalla, traductores, buscadores, instalación). */
function applyToDocument(): void {
  document.documentElement.lang = state.locale;
  document.title = `${config.appName} · ${state.t('app.tagline')}`;
  document.querySelector('meta[name="description"]')?.setAttribute('content', state.t('app.tagline'));
  document.querySelector('link[rel="manifest"]')?.setAttribute('href', MANIFESTS[state.locale]);
}

/** Activa un idioma con su diccionario ya disponible (arranque, pruebas y `setLocale`). */
export function activate(locale: Locale, dictionary: Dictionary): void {
  loaded.set(locale, dictionary);
  if (state.locale === locale && active === dictionary) return;
  active = dictionary;
  state = build(locale, flatten(dictionary));
  applyToDocument();
  listeners.forEach((listener) => listener());
}

/** Diccionario de un idioma: se descarga una vez (si falla se repite una vez; la siguiente llamada lo vuelve a intentar). */
export async function loadMessages(locale: Locale): Promise<Dictionary> {
  const cached = loaded.get(locale);
  if (cached) return cached;
  const module = await importWithRetry(LOADERS[locale]);
  loaded.set(locale, module.default);
  return module.default;
}

/**
 * Cambia el idioma activo: descarga su diccionario si hace falta y redibuja la interfaz al instante.
 * Si se eligen dos idiomas seguidos gana el último (una descarga lenta no pisa una elección nueva).
 */
export async function setLocale(locale: Locale): Promise<void> {
  requested = locale;
  const dictionary = await loadMessages(locale);
  if (requested === locale) activate(locale, dictionary);
}
