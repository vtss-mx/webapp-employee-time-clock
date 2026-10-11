import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/app';

/** Textos de la aplicación en general en portugués de Brasil (pt-BR): las mismas llaves que es-MX. */
export default {
  thirdPartyNotices: 'Avisos de terceiros',
  publisher: 'VT Software Solutions',
  catalogsLoadFailed: 'Não foi possível carregar os catálogos',
  analytics: {
    title: 'Medição de uso',
    body: 'Medimos quais telas são usadas e com qual papel, nunca dados da pessoa. Você pode recusar.',
    accept: 'Aceitar',
    decline: 'Recusar',
  },
  tagline: "Plataforma de verificação de identidade digital e biométrica",
} satisfies Translation<typeof es>;
