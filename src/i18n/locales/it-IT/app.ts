import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/app';

/** Textos de la aplicación en general en italiano (it-IT): las mismas llaves que es-MX. */
export default {
  catalogsLoadFailed: 'Impossibile caricare i cataloghi',
  tagline: 'Gestione delle presenze e della giornata lavorativa.',
} satisfies Translation<typeof es>;
