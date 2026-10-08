import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/app';

/** Textos de la aplicación en general en portugués de Brasil (pt-BR): las mismas llaves que es-MX. */
export default {
  catalogsLoadFailed: 'Não foi possível carregar os catálogos',
  tagline: 'Controle de presença e jornada de trabalho.',
} satisfies Translation<typeof es>;
