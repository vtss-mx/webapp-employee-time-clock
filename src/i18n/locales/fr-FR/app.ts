import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/app';

/** Textos de la aplicación en general en francés (fr-FR): las mismas llaves que es-MX. */
export default {
  catalogsLoadFailed: 'Impossible de charger les catalogues',
  tagline: 'Gestion des présences et du temps de travail.',
} satisfies Translation<typeof es>;
