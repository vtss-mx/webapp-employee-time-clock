import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/verification';

/** Textos de resultados e historial de verificaciones de identidad en francés (fr-FR): las mismas llaves que es-MX. */
export default {
  outcome: {
    success: 'Réussie',
    failed: 'Échouée',
  },
  result: {
    kiosk: {
      title: 'Employé identifié',
      greeting: 'Identité confirmée: {name}.',
      next: 'Personne suivante',
      home: "Retour à l'accueil",
    },
    self: {
      title: 'Identité confirmée',
      greeting: 'Bonjour {name}.',
      finish: 'Terminer',
      changeMethod: 'Changer de méthode',
    },
    number: 'Numéro',
    confidence: 'Confiance',
    dateTime: 'Date et heure',
    retry: 'Réessayer',
  },
  history: {
    errorTitle: 'Impossible de charger le journal',
    emptyTitle: 'Aucune vérification',
    emptyDescription: "Chaque tentative de vérification d'identité apparaîtra ici.",
    nounOne: 'tentative',
    nounOther: 'tentatives',
    confidence: 'Confiance {value}',
  },
  map: {
    label: 'Carte des vérifications',
    pin: 'Lieu de la vérification',
    loading: 'Chargement de la carte…',
    failed: "La carte n'est pas disponible.",
  },
  company: {
    title: 'Vérifications',
    subtitle: "Où et quand l'identité de votre personnel a été vérifiée.",
    loadError: 'Impossible de charger les vérifications',
    mapHint: 'Choisissez une vérification avec position pour la voir sur la carte.',
    notIdentified: 'Non identifié',
    noun: { one: 'vérification', other: 'vérifications' },
    filters: { all: 'Toutes', success: 'Réussies', failed: 'Échouées', from: 'Du', to: 'Au' },
    columns: { when: 'Date et heure', result: 'Résultat', method: 'Méthode', place: 'Lieu' },
    place: { show: 'Voir sur la carte', none: 'Sans position', accuracy: 'Précision {distance}' },
    empty: { title: 'Aucune vérification', description: 'Vous verrez ici où chaque vérification a eu lieu.' },
    noMatch: { title: 'Aucun résultat', description: 'Essayez un autre filtre ou une autre plage de dates.' },
  },
} satisfies Translation<typeof es>;
