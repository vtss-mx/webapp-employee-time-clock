import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCALES } from '../i18n/core';
import { checkBrowserSupport, missingCapabilities, NOTICE_ID, showBrowserNotice, type BrowserHost } from './browserSupport';

/**
 * Aviso «Actualiza tu navegador» (D-C1): el guion que `index.html` ejecuta antes de la app sondea capacidades (nunca el
 * nombre del navegador) y, solo si falta alguna, muestra el aviso de la página en el idioma del navegador, en uno solo.
 * El HTML de las pruebas es el `index.html` real: así se verifica que trae los siete idiomas y nada más.
 */
const INDEX_HTML = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

// jsdom no implementa `noModule` en <script> (todo navegador con módulos lo tiene): se declara como en un navegador real.
Object.defineProperty(HTMLScriptElement.prototype, 'noModule', { value: false, writable: true, configurable: true });

/** Un navegador con todo lo que la app exige (jsdom ya trae módulos, `at`, `structuredClone` y lookbehind). */
function capable(overrides: Partial<BrowserHost> = {}): BrowserHost {
  return {
    document,
    navigator: { languages: ['es-MX'], language: 'es-MX' },
    CSS: { supports: () => true },
    Array,
    structuredClone,
    RegExp,
    ...overrides,
  };
}

/** La página real, en un documento aparte (el de la prueba se queda limpio). */
function page(): Document {
  return new DOMParser().parseFromString(INDEX_HTML, 'text/html');
}

const visibleBlocks = (doc: Document) => [...doc.querySelectorAll<HTMLElement>(`#${NOTICE_ID} [lang]`)].filter((block) => !block.hidden);

describe('capacidades que la app exige', () => {
  it('con todas, no falta nada', () => {
    expect(missingCapabilities(capable())).toEqual([]);
  });

  it('nombra cada capacidad que falta', () => {
    const classicScriptOnly = { createElement: () => ({}) } as unknown as Document;
    expect(missingCapabilities(capable({ document: classicScriptOnly }))).toEqual(['modules']);
    expect(missingCapabilities(capable({ CSS: undefined }))).toEqual(['containerQueries']);
    expect(missingCapabilities(capable({ CSS: {} }))).toEqual(['containerQueries']);
    expect(missingCapabilities(capable({ CSS: { supports: () => false } }))).toEqual(['containerQueries']);
    expect(missingCapabilities(capable({ Array: { prototype: {} } }))).toEqual(['arrayAt']);
    expect(missingCapabilities(capable({ structuredClone: undefined }))).toEqual(['structuredClone']);
    const withoutLookbehind = function RegExpWithoutLookbehind() {
      throw new SyntaxError('Invalid regular expression');
    } as unknown as BrowserHost['RegExp'];
    expect(missingCapabilities(capable({ RegExp: withoutLookbehind }))).toEqual(['regexpLookbehind']);
  });

  it('un iOS 15: sin consultas de contenedor ni lookbehind, con lo demás', () => {
    const safari15 = function RegExpWithoutLookbehind() {
      throw new SyntaxError('Invalid regular expression');
    } as unknown as BrowserHost['RegExp'];
    expect(missingCapabilities(capable({ CSS: { supports: () => false }, RegExp: safari15 }))).toEqual(['containerQueries', 'regexpLookbehind']);
  });
});

describe('el aviso de index.html', () => {
  it('trae un bloque por idioma de la app, cada uno con la marca intacta, un título y un texto, y empieza oculto', () => {
    const doc = page();
    const notice = doc.getElementById(NOTICE_ID);
    expect(notice?.hidden).toBe(true);
    const blocks = [...doc.querySelectorAll<HTMLElement>(`#${NOTICE_ID} [lang]`)];
    expect(blocks.map((block) => block.lang)).toEqual([...LOCALES]);
    for (const block of blocks) {
      expect(block.hidden).toBe(true);
      expect(block.querySelector('.browser-notice__brand')?.textContent).toBe('Identity Verification Platform');
      expect(block.querySelector('h1')?.textContent?.trim().length).toBeGreaterThan(0);
      expect(block.querySelectorAll('p')).toHaveLength(3);
    }
    // El guion se inserta al final del body al compilar (vite.config.ts): en la fuente solo está el módulo de la app.
    expect(doc.querySelectorAll('script')).toHaveLength(1);
    expect(doc.querySelector('script')?.getAttribute('type')).toBe('module');
  });

  it('se muestra SOLO en el idioma del navegador, con la misma negociación que la app, y oculta la raíz y el aviso de arranque', () => {
    const doc = page();
    expect(showBrowserNotice(doc, ['ja-JP', 'de-AT', 'en-US'])).toBe(true);
    expect(doc.getElementById(NOTICE_ID)?.hidden).toBe(false);
    expect(visibleBlocks(doc).map((block) => block.lang)).toEqual(['de-DE']);
    expect(visibleBlocks(doc)[0].querySelector('h1')?.textContent).toBe('Aktualisieren Sie Ihren Browser');
    expect(doc.documentElement.lang).toBe('de-DE');
    expect(doc.getElementById('root')?.hidden).toBe(true);
    expect(doc.getElementById('boot-error')?.hidden).toBe(true);
    expect(doc.body.style.margin).toBe('0px');
  });

  it('España y sus regiones → es-ES; otro español → es-MX; sin idioma conocido → es-MX', () => {
    const spain = page();
    showBrowserNotice(spain, ['es-ES']);
    expect(visibleBlocks(spain).map((block) => block.lang)).toEqual(['es-ES']);
    expect(visibleBlocks(spain)[0].textContent).toContain('inténtalo de nuevo');
    const argentina = page();
    showBrowserNotice(argentina, ['es-AR']);
    expect(visibleBlocks(argentina).map((block) => block.lang)).toEqual(['es-MX']);
    const japan = page();
    showBrowserNotice(japan, ['ja', 'ko']);
    expect(visibleBlocks(japan).map((block) => block.lang)).toEqual(['es-MX']);
    const nothing = page();
    showBrowserNotice(nothing, []);
    expect(visibleBlocks(nothing).map((block) => block.lang)).toEqual(['es-MX']);
  });

  it('una página con el aviso pero sin raíz ni aviso de arranque solo muestra el aviso', () => {
    const doc = new DOMParser().parseFromString(
      `<!doctype html><html><body><div id="${NOTICE_ID}" hidden><div lang="es-MX" hidden>Actualiza</div><div lang="en-US" hidden>Update</div></div></body></html>`,
      'text/html',
    );
    expect(showBrowserNotice(doc, ['en'])).toBe(true);
    expect(visibleBlocks(doc).map((block) => block.lang)).toEqual(['en-US']);
  });

  it('sin el aviso en la página (un index.html anterior) no hace nada', () => {
    const doc = new DOMParser().parseFromString('<!doctype html><html><body><div id="root"></div></body></html>', 'text/html');
    expect(showBrowserNotice(doc, ['en-US'])).toBe(false);
    expect(doc.getElementById('root')?.hidden).toBe(false);
  });
});

describe('el guion completo (checkBrowserSupport)', () => {
  it('en un navegador compatible no toca la página: el aviso jamás se dibuja', () => {
    const doc = page();
    expect(checkBrowserSupport(capable({ document: doc }))).toEqual([]);
    expect(doc.getElementById(NOTICE_ID)?.hidden).toBe(true);
    expect(visibleBlocks(doc)).toEqual([]);
    expect(doc.getElementById('root')?.hidden).toBe(false);
    expect(doc.documentElement.lang).toBe('es-MX');
  });

  it('en uno antiguo muestra el aviso en el idioma del navegador (navigator.languages y, sin él, navigator.language)', () => {
    const withLanguages = page();
    expect(checkBrowserSupport(capable({ document: withLanguages, structuredClone: undefined, navigator: { languages: ['pt-BR'], language: 'pt-BR' } }))).toEqual(['structuredClone']);
    expect(visibleBlocks(withLanguages).map((block) => block.lang)).toEqual(['pt-BR']);

    const legacyNavigator = page();
    checkBrowserSupport(capable({ document: legacyNavigator, structuredClone: undefined, navigator: { language: 'it' } }));
    expect(visibleBlocks(legacyNavigator).map((block) => block.lang)).toEqual(['it-IT']);
  });

  it('sin argumentos sondea la ventana real (jsdom: compatible salvo las consultas de contenedor, que no implementa)', () => {
    expect(checkBrowserSupport()).toEqual(['containerQueries']);
    expect(document.getElementById(NOTICE_ID)).toBeNull(); // la página de la prueba no trae el aviso: nada que mostrar
  });
});
