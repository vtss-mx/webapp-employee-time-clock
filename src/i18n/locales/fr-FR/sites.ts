import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/sites';

/** Textos de sitios donde se checa en francés (fr-FR): las mismas llaves que es-MX. */
export default {
  list: {
    title: 'Sites de travail',
    loadError: 'Impossible de charger les sites',
    subtitle_one: '{count} site · où pointer en personne et dans quel rayon',
    subtitle_other: '{count} sites · où pointer en personne et dans quel rayon',
    new: 'Nouveau site',
    searchPlaceholder: 'Rechercher par nom',
    searchLabel: 'Rechercher des sites',
    noun: { one: 'site', other: 'sites' },
    columns: {
      site: 'Site',
      address: 'Adresse',
      radius: 'Rayon',
      employees: "Employés aujourd'hui",
      code: 'Code',
    },
    kiosksOf_one: '{count} borne de {name}',
    kiosksOf_other: '{count} bornes de {name}',
    noMatch: {
      title: 'Aucun résultat',
      description: 'Essayez une autre recherche ou un autre filtre.',
    },
    empty: {
      title: 'Aucun site de travail',
      description: 'Créez un site pour indiquer où pointe votre personnel.',
    },
  },
  form: {
    loadError: 'Impossible de charger le site',
    newTitle: 'Nouveau site',
    editTitle: 'Modifier le site',
    newSubtitle: 'Un lieu où votre personnel pointe en personne: usine, agence, bureau…',
    create: 'Créer le site',
    createError: 'Impossible de créer le site',
    saveError: "Impossible d'enregistrer le site",
    rule: 'Rayon de pointage: {distance}.',
    created: {
      title: 'Site créé',
      text: '{name} peut désormais être ajouté à vos horaires. {rule}',
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
    radius: 'Rayon de pointage (mètres)',
    radiusHint: 'Entre {min} et {max} m: la taille du lieu plus la marge du GPS.',
    suggestedRadii: 'Rayons suggérés',
    onSiteNote: 'Sur site, le pointage se fait avec le visage et la position du téléphone, dans ce rayon.',
    locationIntro: 'Recherchez le lieu ou touchez la carte. Le cercle indique le rayon de pointage.',
    pointRequired: 'Marquez le point du site sur la carte',
  },
  fields: {
    address: 'Adresse',
    references: 'Repères',
    point: 'Point sur la carte',
    radius: 'Rayon de pointage',
  },
  confirm: {
    createTitle: 'Créer le site {name}?',
    createMessage: 'Il pourra être ajouté à vos horaires; les employés concernés y pointeront.',
    willCreate: 'Sera créé',
    editTitle: 'Enregistrer les modifications du site {name}?',
  },
  status: {
    title: 'Statut du site',
    activeMeaning: 'Il peut être ajouté aux horaires et les employés concernés peuvent y pointer.',
    inactiveMeaning: 'Personne ne peut pointer sur ce site et il ne peut pas être ajouté à un horaire.',
    deactivateWarning:
      "Personne ne pourra y pointer ni l'ajouter à un horaire tant que vous ne l'aurez pas activé. Les horaires qui l'incluent et ce qui est déjà enregistré ne changent pas.",
    removeWarning:
      "Il ne peut être supprimé que si aucun horaire ne l'utilise et que personne n'y a pointé. Si un horaire l'utilise, retirez-le de l'horaire; si quelqu'un y a déjà pointé, désactivez-le.",
    activateQuestion: 'Activer le site {name}?',
    deactivateQuestion: 'Désactiver le site {name}?',
    removeQuestion: 'Supprimer le site {name}?',
    activated: 'Site activé',
    deactivated: 'Site désactivé',
    removed: 'Site supprimé',
    inUse: 'Le site est utilisé: désactivez-le',
  },
  trash: {
    restoreTitle: 'Restaurer le site {name}?',
    banner: 'Site supprimé',
  },
  presence: {
    label: 'Code du site',
    hint: "Demande à l'entrée et à la sortie le code affiché par la borne du site.",
    on: 'Code requis',
    off: 'Sans code',
  },
} satisfies Translation<typeof es>;
