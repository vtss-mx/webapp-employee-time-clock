import { afterEach, describe, expect, it, vi } from 'vitest';
import { activate, currentLocale, i18nSnapshot, isLocale, matchLocale, subscribe, t, type Dictionary } from './core';

/**
 * Núcleo de la traducción: idiomas, búsqueda de llaves, variables, plurales, descarga diferida de
 * cada idioma, "gana la última elección" y el documento (lang, título, descripción).
 */
const fake = (texts: Record<string, unknown>) => texts as unknown as Dictionary;
const lookup = t as unknown as (key: string, params?: Record<string, string | number>) => string;

afterEach(() => {
  vi.doUnmock('../utils/importRetry');
  vi.resetModules();
});

describe('idiomas de la aplicación', () => {
  it('reconoce solo los siete idiomas de la plataforma', () => {
    for (const locale of ['es-MX', 'en-US', 'pt-BR', 'fr-FR', 'de-DE', 'it-IT', 'es-ES']) expect(isLocale(locale)).toBe(true);
    expect(isLocale('ja-JP')).toBe(false);
    expect(isLocale('pt-PT')).toBe(false); // una variante del navegador no es un idioma de la app: la lleva matchLocale
    expect(isLocale(null)).toBe(false);
  });

  it('lleva cualquier variante del navegador al idioma más cercano (España y sus regiones → es-ES; el resto del español → es-MX)', () => {
    expect(matchLocale('es')).toBe('es-MX');
    expect(matchLocale('es-419')).toBe('es-MX');
    expect(matchLocale('es-AR')).toBe('es-MX');
    expect(matchLocale(' ES_es ')).toBe('es-ES');
    expect(matchLocale('es-EA')).toBe('es-ES');
    expect(matchLocale('es-IC')).toBe('es-ES');
    expect(matchLocale('en-GB')).toBe('en-US');
    expect(matchLocale('pt-PT')).toBe('pt-BR');
    expect(matchLocale('fr-CA')).toBe('fr-FR');
    expect(matchLocale('de-AT')).toBe('de-DE');
    expect(matchLocale('it-CH')).toBe('it-IT');
    expect(matchLocale('ja')).toBeNull();
  });
});

describe('traductor', () => {
  it('busca llaves anidadas, reemplaza variables y deja visibles las que faltan', () => {
    activate('es-MX', fake({ app: { tagline: 'Lema' }, a: { b: { hello: 'Hola {name}, tienes {n} avisos', plain: 'Sin variables' } } }));
    expect(lookup('a.b.hello', { name: 'Ana', n: 2026 })).toBe('Hola Ana, tienes 2026 avisos'); // un número que no es `count` no lleva comas
    expect(lookup('a.b.hello', { name: 'Ana' })).toBe('Hola Ana, tienes {n} avisos');
    expect(lookup('a.b.plain')).toBe('Sin variables');
    expect(lookup('no.existe')).toBe('no.existe');
  });

  it('elige la forma del plural con Intl.PluralRules, con texto propio para cero y `count` con separador de miles', () => {
    activate('es-MX', fake({ app: { tagline: 'Lema' }, days_one: '{count} día', days_other: '{count} días', items_zero: 'Ninguno', items_one: 'Uno', items_other: '{count} elementos', only_other: '{count} cosas', both: 'sin plural' }));
    expect(lookup('days', { count: 1 })).toBe('1 día');
    expect(lookup('days', { count: 0 })).toBe('0 días'); // sin `_zero`, cero es plural
    expect(lookup('days', { count: 1234 })).toBe('1,234 días');
    expect(lookup('days', { count: 1_000_000 })).toBe('1,000,000 días'); // "many" del español cae en `_other`
    expect(lookup('items', { count: 0 })).toBe('Ninguno');
    expect(lookup('items', { count: 7 })).toBe('7 elementos');
    expect(lookup('only', { count: 1 })).toBe('1 cosas');
    expect(lookup('both', { count: 3 })).toBe('sin plural'); // una llave sin formas se usa tal cual
    expect(lookup('days_one', { count: '5' })).toBe('5 día'); // `count` de texto se muestra tal cual
  });

  it('usa las reglas del plural del idioma activo', () => {
    activate('en-US', fake({ app: { tagline: 'Tagline' }, days_one: '{count} day', days_other: '{count} days' }));
    expect(lookup('days', { count: 1 })).toBe('1 day');
    expect(lookup('days', { count: 2.5 })).toBe('2.5 days');
  });
});

describe('estado y documento', () => {
  it('avisa a los suscriptores en cada cambio y actualiza lang, título y descripción de la pestaña', () => {
    const meta = document.createElement('meta');
    meta.name = 'description';
    document.head.append(meta);
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    const before = i18nSnapshot();

    activate('en-US', fake({ app: { tagline: 'Attendance' } }));
    expect(listener).toHaveBeenCalledOnce();
    expect(i18nSnapshot()).not.toBe(before);
    expect(currentLocale()).toBe('en-US');
    expect(document.documentElement.lang).toBe('en-US');
    expect(document.title).toBe('Employee Time Clock · Attendance');
    expect(meta.content).toBe('Attendance');

    const same = i18nSnapshot();
    activate('en-US', fake({ app: { tagline: 'Attendance' } })); // otro objeto: se reconstruye
    expect(listener).toHaveBeenCalledTimes(2);
    expect(i18nSnapshot()).not.toBe(same);

    unsubscribe();
    activate('es-MX', fake({ app: { tagline: 'Lema' } }));
    expect(listener).toHaveBeenCalledTimes(2);
    meta.remove();
  });

  it('el manifiesto de la aplicación instalable sigue al idioma (su nombre y descripción no se mezclan)', () => {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = '/site.webmanifest';
    document.head.append(link);
    activate('en-US', fake({ app: { tagline: 'Attendance' } }));
    expect(link.getAttribute('href')).toBe('/site.en-US.webmanifest');
    activate('de-DE', fake({ app: { tagline: 'Anwesenheit' } }));
    expect(link.getAttribute('href')).toBe('/site.de-DE.webmanifest');
    activate('es-MX', fake({ app: { tagline: 'Lema' } }));
    expect(link.getAttribute('href')).toBe('/site.webmanifest');
    link.remove();
  });

  it('un traductor guardado en un dibujo anterior traduce en el idioma vigente (fábricas de popups abiertos)', () => {
    activate('es-MX', fake({ app: { tagline: 'Lema' }, hi: 'Hola', n_one: '{count} vez', n_other: '{count} veces' }));
    const { t: captured, template } = i18nSnapshot();
    activate('en-US', fake({ app: { tagline: 'Tagline' }, hi: 'Hello', n_one: '{count} time', n_other: '{count} times' }));
    expect((captured as unknown as typeof lookup)('hi')).toBe('Hello');
    expect(template('n', 2)).toBe('{count} times');
    expect(i18nSnapshot().t).not.toBe(captured); // su identidad sí cambia con el idioma
  });

  it('activar el mismo diccionario que ya está activo no avisa ni redibuja', () => {
    const dictionary = fake({ app: { tagline: 'Lema' } });
    activate('es-MX', dictionary);
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    activate('es-MX', dictionary);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});

describe('descarga diferida de cada idioma', () => {
  // Módulo nuevo en cada prueba: las anteriores activaron diccionarios de prueba.
  const freshCore = async () => {
    vi.resetModules();
    return import('./core');
  };

  it('descarga el diccionario una sola vez y cambia el idioma de toda la app', async () => {
    const fresh = await freshCore();
    await fresh.setLocale('en-US');
    expect(fresh.currentLocale()).toBe('en-US');
    expect(fresh.t('common.actions.save')).toBe('Save');
    expect(await fresh.loadMessages('en-US')).toBe(await fresh.loadMessages('en-US'));
    await fresh.setLocale('es-MX');
    expect(fresh.t('common.actions.save')).toBe('Guardar');
  });

  it('si se eligen dos idiomas seguidos gana el último aunque el primero tarde más en llegar', async () => {
    const fresh = await freshCore();
    await fresh.loadMessages('es-MX');
    const slow = fresh.setLocale('en-US'); // se descarga (asíncrono)
    const fast = fresh.setLocale('es-MX'); // ya está en memoria
    await Promise.all([slow, fast]);
    expect(fresh.currentLocale()).toBe('es-MX');
  });

  it('si la descarga falla, el idioma no cambia y la siguiente elección lo vuelve a intentar', async () => {
    let fail = true;
    vi.doMock('../utils/importRetry', () => ({
      importWithRetry: (load: () => Promise<unknown>) => (fail ? Promise.reject(new TypeError('Failed to fetch dynamically imported module')) : load()),
    }));
    const fresh = await import('./core');
    await expect(fresh.setLocale('en-US')).rejects.toThrow('dynamically imported module');
    expect(fresh.currentLocale()).toBe('es-MX');
    fail = false;
    await fresh.setLocale('en-US');
    expect(fresh.currentLocale()).toBe('en-US');
    expect(fresh.t('common.actions.save')).toBe('Save');
  });

  it('antes de descargar un diccionario las llaves se ven tal cual (el arranque siempre lo espera)', async () => {
    const fresh = await import('./core');
    expect(fresh.t('common.actions.save')).toBe('common.actions.save');
  });
});
