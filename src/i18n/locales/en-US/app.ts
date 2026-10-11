import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/app';

/** Textos de la aplicación en general en inglés (en-US): las mismas llaves que es-MX. */
export default {
  thirdPartyNotices: 'Third-party notices',
  publisher: 'VT Software Solutions',
  catalogsLoadFailed: "Couldn't load the catalogs",
  analytics: {
    title: 'Usage measurement',
    body: 'We measure which screens are used and with which role, never personal data. You can decline.',
    accept: 'Accept',
    decline: 'Decline',
  },
  tagline: "Digital and biometric identity verification platform",
} satisfies Translation<typeof es>;
