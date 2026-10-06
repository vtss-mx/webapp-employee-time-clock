import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/app';

/** Textos de la aplicación en general en inglés (en-US): las mismas llaves que es-MX. */
export default {
  catalogsLoadFailed: "Couldn't load the catalogs",
  tagline: 'Attendance and work-hours tracking.',
} satisfies Translation<typeof es>;
