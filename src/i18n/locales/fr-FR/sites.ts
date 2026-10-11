import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/sites';

/** Textes des sites de vérification en français (fr-FR): les mêmes clés que es-MX. */
export default {
  list: {
    title: 'Sites de vérification',
    loadError: 'Impossible de charger les sites',
    subtitle_one: "{count} site · où l'identité est vérifiée et dans quel rayon",
    subtitle_other: "{count} sites · où l'identité est vérifiée et dans quel rayon",
    new: 'Nouveau site',
    searchPlaceholder: 'Rechercher par nom',
    searchLabel: 'Rechercher des sites',
    noun: { one: 'site', other: 'sites' },
    columns: {
      site: 'Site',
      address: 'Adresse',
      radius: 'Rayon',
      code: 'Code',
    },
    kiosksOf_one: '{count} borne de {name}',
    kiosksOf_other: '{count} bornes de {name}',
    noMatch: {
      title: 'Aucun résultat',
      description: 'Essayez une autre recherche ou un autre filtre.',
    },
    empty: {
      title: 'Aucun site de vérification',
      description: "Créez un site pour délimiter où l'identité est vérifiée.",
    },
  },
  form: {
    loadError: 'Impossible de charger le site',
    newTitle: 'Nouveau site',
    editTitle: 'Modifier le site',
    newSubtitle: "Un lieu où l'identité est vérifiée: usine, agence, bureau…",
    create: 'Créer le site',
    createError: 'Impossible de créer le site',
    saveError: "Impossible d'enregistrer le site",
    rule: 'Rayon de vérification: {distance}.',
    created: {
      title: 'Site créé',
      text: '{name} peut désormais être utilisé lors de la vérification. {rule}',
    },
    updated: {
      title: 'Site mis à jour',
      text: '{name} · {rule}',
    },
    sections: {
      site: 'Site',
      location: 'Localisation',
    },
    name: 'Nom du site',
    nameExample: 'Usine Hermosillo',
    nameHint: 'Unique dans votre entreprise: p. ex. «Usine Hermosillo»',
    radius: 'Rayon de vérification (mètres)',
    radiusHint: 'Entre {min} et {max} m: la taille du lieu plus la marge du GPS.',
    suggestedRadii: 'Rayons suggérés',
    onSiteNote: "Sur site, l'identité est vérifiée avec le visage et la position du téléphone, dans ce rayon.",
    locationIntro: 'Recherchez le lieu ou touchez la carte. Le cercle indique le rayon de vérification.',
    pointRequired: 'Marquez le point du site sur la carte',
  },
  fields: {
    address: 'Adresse',
    references: 'Repères',
    point: 'Point sur la carte',
    radius: 'Rayon de vérification',
  },
  confirm: {
    createTitle: 'Créer le site {name}?',
    createMessage: "Il pourra servir à délimiter où l'identité est vérifiée.",
    willCreate: 'Sera créé',
    editTitle: 'Enregistrer les modifications du site {name}?',
  },
  status: {
    title: 'Statut du site',
    activeMeaning: "Il accepte les vérifications d'identité dans ce lieu.",
    inactiveMeaning: "Il n'accepte pas les vérifications d'identité dans ce lieu.",
    deactivateWarning: "Il n'acceptera pas de vérifications ici tant que vous ne l'aurez pas activé. Ce qui est déjà enregistré ne change pas.",
    removeWarning: "Il ne peut être supprimé que si personne n'y a été vérifié. S'il y a déjà des vérifications, désactivez-le.",
    activateQuestion: 'Activer le site {name}?',
    deactivateQuestion: 'Désactiver le site {name}?',
    removeQuestion: 'Supprimer le site {name}?',
    activated: 'Site activé',
    deactivated: 'Site désactivé',
    removed: 'Site supprimé',
    inUse: 'Le site est utilisé: désactivez-le',
  },
  recordStatus: {
    activateError: "Impossible d'activer {name}",
    deactivateError: 'Impossible de désactiver {name}',
    removeError: 'Impossible de supprimer {name}',
  },
  validation: {
    nameRequired: 'Saisissez le nom du site, p. ex. «{example}»',
    nameMax: 'Au plus {max} caractères',
  },
  trash: {
    restoreTitle: 'Restaurer le site {name}?',
    banner: 'Site supprimé',
  },
  presence: {
    label: 'Code du site',
    hint: 'Demande lors de la vérification le code affiché par la borne du site.',
    on: 'Code requis',
    off: 'Sans code',
  },
} satisfies Translation<typeof es>;
