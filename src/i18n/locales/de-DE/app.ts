import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/app';

/** Textos de la aplicación en general en alemán (de-DE): las mismas llaves que es-MX. */
export default {
  thirdPartyNotices: 'Hinweise zu Drittanbietern',
  publisher: 'VT Software Solutions',
  catalogsLoadFailed: 'Die Kataloge konnten nicht geladen werden',
  analytics: {
    title: 'Nutzungsmessung',
    body: 'Wir messen, welche Bildschirme mit welcher Rolle genutzt werden, niemals personenbezogene Daten. Sie können ablehnen.',
    accept: 'Annehmen',
    decline: 'Ablehnen',
  },
  tagline: "Plattform für digitale und biometrische Identitätsprüfung",
} satisfies Translation<typeof es>;
