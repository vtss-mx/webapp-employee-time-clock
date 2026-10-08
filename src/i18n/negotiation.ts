import type { Locale } from '../types/i18n';

/**
 * Negociación del idioma (glosario §5): la misma tabla que el backend (`Accept-Language`). Módulo PURO, sin
 * importaciones en tiempo de ejecución, porque también lo usa el aviso «Actualiza tu navegador» que `index.html`
 * ejecuta antes de la aplicación (`compat/browserSupport.ts`, decisión D-C1): ese guion se compila aparte, sin React
 * ni diccionarios, y debe elegir el idioma con EXACTAMENTE la misma regla que la app.
 */
export const DEFAULT_LOCALE: Locale = 'es-MX';

/** Idioma base de una etiqueta → el idioma de la app que lo atiende. */
const BY_LANGUAGE: Readonly<Record<string, Locale>> = { es: 'es-MX', en: 'en-US', pt: 'pt-BR', fr: 'fr-FR', de: 'de-DE', it: 'it-IT' };
/** Regiones que cambian el idioma: el español de España (y de Ceuta y Melilla y Canarias) → es-ES; el resto del español → es-MX. */
const BY_REGION: Readonly<Record<string, Locale>> = { 'es-es': 'es-ES', 'es-ea': 'es-ES', 'es-ic': 'es-ES' };

/** Etiqueta de idioma del navegador ("es", "es-419", "en-GB", "pt-PT", "es-ES") → el idioma de la app; otro idioma → null. */
export function matchLocale(tag: string): Locale | null {
  const [language, region] = tag.trim().toLowerCase().split(/[-_]/);
  return BY_REGION[`${language}-${region ?? ''}`] ?? BY_LANGUAGE[language] ?? null;
}

/** El primer idioma de una lista de preferencias (`navigator.languages`) que la app tiene, o null si ninguno. */
export function firstLocale(languages: readonly string[]): Locale | null {
  for (const tag of languages) {
    const match = matchLocale(tag);
    if (match) return match;
  }
  return null;
}
