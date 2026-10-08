import type { Locale } from '../types/i18n';

/** Países con bandera propia en la app (`components/ui/LocaleFlag.tsx`): uno por idioma. */
export type FlagCountry = 'MX' | 'US' | 'BR' | 'FR' | 'DE' | 'IT' | 'ES';

export interface Endonym {
  /** El idioma nombrado en sí mismo («Español», «English»): así lo reconoce quien no entiende el idioma que se ve. */
  language: string;
  /** El país del idioma, también en ese idioma («México», «United States»). */
  country: string;
  flag: FlagCountry;
}

/**
 * Cómo se nombra cada idioma en sí mismo y a qué país pertenece (decisión del dueño del producto, 2026-10-06: el
 * selector muestra bandera + idioma en su propio idioma + país). No se traduce: es igual en toda la app.
 */
export const ENDONYMS: Readonly<Record<Locale, Endonym>> = {
  'es-MX': { language: 'Español', country: 'México', flag: 'MX' },
  'en-US': { language: 'English', country: 'United States', flag: 'US' },
  'pt-BR': { language: 'Português', country: 'Brasil', flag: 'BR' },
  'fr-FR': { language: 'Français', country: 'France', flag: 'FR' },
  'de-DE': { language: 'Deutsch', country: 'Deutschland', flag: 'DE' },
  'it-IT': { language: 'Italiano', country: 'Italia', flag: 'IT' },
  'es-ES': { language: 'Español', country: 'España', flag: 'ES' },
};

/** «Español (México)»: el idioma y su país en una línea (el control cerrado del selector). */
export function endonymLabel(locale: Locale): string {
  const { language, country } = ENDONYMS[locale];
  return `${language} (${country})`;
}

/** Todos los nombres propios de los idiomas y sus países (lo que no se revisa como texto de un idioma). */
export function endonymTexts(): string[] {
  return Object.values(ENDONYMS).flatMap(({ language, country }) => [language, country]);
}
