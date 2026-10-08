import { DEFAULT_LOCALE, firstLocale } from '../i18n/negotiation';

/**
 * Aviso «Actualiza tu navegador» (decisión D-C1 del dueño del producto, 2026-10-06; `docs/rd/compatibilidad-biometria.md`
 * §7). El paquete de la aplicación se compila para Chrome/Edge 111, Firefox 114 y Safari/iOS 16.4 (objetivo de Vite):
 * un navegador anterior (iOS 15 en un iPhone 6s/7/SE de 1.ª generación, un Chrome o un Firefox viejos) no entiende su
 * sintaxis, no ejecuta ni una línea y dejaba la página EN BLANCO, sin explicación.
 *
 * Este módulo es el guion que `index.html` ejecuta ANTES del módulo principal (lo compila e inserta `vite.config.ts`,
 * `browserSupportNotice`): detecta por CAPACIDAD —nunca por el nombre del navegador— lo que la aplicación exige y, si
 * falta algo, muestra el aviso que ya está escrito en `index.html` en los siete idiomas, SOLO en el idioma del navegador
 * (regla 16: la misma negociación que la app y el backend, `firstLocale`). Si el navegador es compatible, no toca nada:
 * el aviso nunca se dibuja ni parpadea.
 *
 * Se escribe con sintaxis conservadora (ES2015; nada de `at`, `structuredClone` ni expresiones regulares LITERALES con
 * *lookbehind*, que `vite.config.ts` rechaza al compilar): tiene que correr precisamente en los navegadores que no
 * pueden correr la aplicación.
 */

/** Lo que el guion sondea del navegador (`window` en la página; un objeto propio en las pruebas). */
export interface BrowserHost {
  document: Document;
  navigator: { languages?: readonly string[]; language: string };
  CSS?: { supports?: (condition: string) => boolean };
  Array: { prototype: { at?: unknown } };
  structuredClone?: unknown;
  RegExp: new (pattern: string) => unknown;
}

/** Capacidades que la aplicación usa y un navegador antiguo no tiene (cada una, la mínima versión que la trae). */
export type Capability =
  /** `<script type="module">` (Safari 10.1, Chrome 61, Firefox 60): sin él la app ni se descarga. */
  | 'modules'
  /** Consultas de contenedor, `container-type` (Safari 16, Chrome 105, Firefox 110): las listas y el visor facial. */
  | 'containerQueries'
  /** `Array.prototype.at` (Safari 15.4, Chrome 92, Firefox 90). */
  | 'arrayAt'
  /** `structuredClone` (Safari 15.4, Chrome 98, Firefox 94). */
  | 'structuredClone'
  /** Expresiones regulares con *lookbehind* (Safari 16.4, Chrome 62, Firefox 78): el paquete no se interpreta sin ellas. */
  | 'regexpLookbehind';

/** Lo que le falta a este navegador para correr la aplicación (vacío = compatible). */
export function missingCapabilities(host: BrowserHost): Capability[] {
  const missing: Capability[] = [];
  if (!('noModule' in host.document.createElement('script'))) missing.push('modules');
  const css = host.CSS;
  if (!css || typeof css.supports !== 'function' || !css.supports('container-type: inline-size')) missing.push('containerQueries');
  if (typeof host.Array.prototype.at !== 'function') missing.push('arrayAt');
  if (typeof host.structuredClone !== 'function') missing.push('structuredClone');
  try {
    new host.RegExp('(?<=a)b'); // como TEXTO: un navegador sin lookbehind interpreta el guion y falla solo aquí
  } catch {
    missing.push('regexpLookbehind');
  }
  return missing;
}

/** El contenedor del aviso en `index.html`; dentro, un bloque `lang="…"` por idioma. */
export const NOTICE_ID = 'browser-notice';
/** Lo que se oculta al mostrar el aviso: la raíz de la app (vacía) y el aviso de arranque de `main.tsx`. */
const HIDDEN_WITH_NOTICE = ['root', 'boot-error'];

/**
 * Muestra el aviso en el idioma del navegador (`firstLocale`; sin coincidencia, es-MX) y oculta el resto de la página.
 * Devuelve false si la página no trae el aviso (un `index.html` anterior).
 */
export function showBrowserNotice(doc: Document, languages: readonly string[]): boolean {
  const notice = doc.getElementById(NOTICE_ID);
  if (!notice) return false;
  const locale = firstLocale(languages) || DEFAULT_LOCALE;
  const blocks = notice.querySelectorAll<HTMLElement>('[lang]');
  for (let index = 0; index < blocks.length; index += 1) blocks[index].hidden = blocks[index].lang !== locale;
  for (let index = 0; index < HIDDEN_WITH_NOTICE.length; index += 1) {
    const element = doc.getElementById(HIDDEN_WITH_NOTICE[index]);
    if (element) element.hidden = true;
  }
  doc.documentElement.lang = locale;
  doc.body.style.margin = '0'; // la hoja de estilos de la app no está: el margen del navegador no se ve
  notice.hidden = false;
  return true;
}

/** Punto de entrada del guion de `index.html`: con todo lo que la app exige no hace nada; si falta algo, muestra el aviso. */
export function checkBrowserSupport(host: BrowserHost = window): Capability[] {
  const missing = missingCapabilities(host);
  if (missing.length > 0) showBrowserNotice(host.document, (host.navigator.languages || []).concat(host.navigator.language));
  return missing;
}
