import type { Locale } from '../types/i18n';

/**
 * Nombre de cada idioma en ese mismo idioma (no se traduce): así lo reconoce quien no entiende el
 * idioma que se está mostrando. Debajo va su nombre en el idioma activo (`language.names`).
 */
export const ENDONYMS: Readonly<Record<Locale, string>> = {
  'es-MX': 'Español (México)',
  'en-US': 'English (United States)',
};
