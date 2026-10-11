import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/app';

/** Textos de la aplicación en general en francés (fr-FR): las mismas llaves que es-MX. */
export default {
  thirdPartyNotices: 'Mentions relatives aux tiers',
  publisher: 'VT Software Solutions',
  catalogsLoadFailed: 'Impossible de charger les catalogues',
  analytics: {
    title: "Mesure d'utilisation",
    body: 'Nous mesurons quels écrans sont utilisés et avec quel rôle, jamais de données personnelles. Vous pouvez refuser.',
    accept: 'Accepter',
    decline: 'Refuser',
  },
  tagline: "Plateforme de vérification d'identité numérique et biométrique",
} satisfies Translation<typeof es>;
