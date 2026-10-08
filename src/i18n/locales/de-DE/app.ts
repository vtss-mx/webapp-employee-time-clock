import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/app';

/** Textos de la aplicación en general en alemán (de-DE): las mismas llaves que es-MX. */
export default {
  catalogsLoadFailed: 'Die Kataloge konnten nicht geladen werden',
  tagline: 'Erfassung von Anwesenheit und Arbeitszeit.',
} satisfies Translation<typeof es>;
