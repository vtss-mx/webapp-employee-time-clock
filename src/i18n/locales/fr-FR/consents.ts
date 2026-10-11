import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/consents';

/** Textos del consentimiento biométrico en francés de Francia (fr-FR, registro «vous»): las mismas llaves que es-MX. */
export default {
  title: 'Données biométriques',
  intro: "Votre consentement pour utiliser votre visage et votre voix lors de la vérification de votre identité.",
  loadError: 'Impossible de charger votre consentement',
  granted: 'Donné',
  pending: 'Non donné',
  askedBy: 'Votre entreprise le demande',
  grantedOn: 'Donné le {date}',
  revokedOn: 'Révoqué le {date}',
  version: 'Version {version}',
  read: 'Lire et donner',
  review: 'Voir le texte',
  revoke: 'Révoquer',
  back: 'Retour à Mon profil',
  backToEnrollment: 'Retour à votre enregistrement',
  pageTitle: 'Consentement biométrique',
  pageSubtitle: 'Lisez le texte complet et décidez si vous le donnez',
  grant: 'Donner mon consentement',
  empty: {
    title: 'Aucun consentement',
    description: "Ce que votre entreprise vous demande d'autoriser apparaîtra ici.",
  },
  onlyEmployees: {
    title: 'Réservé aux employés',
    description: 'Votre compte ne conserve aucune donnée biométrique.',
  },
  grantAsk: {
    eyebrow: 'Votre consentement',
    title: 'Donner votre consentement?',
    message: "Vous confirmez avoir lu le texte complet et vous autorisez ce qu'il indique.",
    note: 'Vous pouvez le révoquer à tout moment depuis Mon profil.',
    confirm: 'Donner',
  },
  grantFailed: 'Impossible de donner votre consentement',
  grantedTitle: 'Consentement donné',
  revokeAsk: {
    eyebrow: 'Votre consentement',
    title: 'Révoquer votre consentement biométrique?',
    message: "Votre visage, vos photos et votre voix sont supprimés immédiatement et votre enregistrement du visage n'existe plus.",
    note: 'Cette action est irréversible. Votre entreprise devra vérifier votre identité autrement.',
    confirm: 'Révoquer',
  },
  revokeFailed: 'Impossible de révoquer votre consentement',
  revokedTitle: 'Consentement révoqué',
  revokedText: 'Vos données biométriques ont été supprimées.',
  missingTitle: 'Votre consentement est absent',
  inPersonTitle: 'Consentement absent pour {name}',
  inPersonText: "Le consentement doit être donné depuis Mon profil avant l'enregistrement du visage.",
} satisfies Translation<typeof es>;
