import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/app';

/** Textos de la aplicación en general en italiano (it-IT): las mismas llaves que es-MX. */
export default {
  thirdPartyNotices: 'Avvisi di terze parti',
  publisher: 'VT Software Solutions',
  catalogsLoadFailed: 'Impossibile caricare i cataloghi',
  analytics: {
    title: "Misurazione d'uso",
    body: 'Misuriamo quali schermate si usano e con quale ruolo, mai dati della persona. Puoi rifiutare.',
    accept: 'Accetta',
    decline: 'Rifiuta',
  },
  tagline: "Piattaforma di verifica dell'identità digitale e biometrica",
} satisfies Translation<typeof es>;
