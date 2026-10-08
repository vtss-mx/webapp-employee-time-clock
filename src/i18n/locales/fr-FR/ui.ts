import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/ui';

/** Textos de componentes base de components/ui (campos, listas, paginador, fechas, horas...) en francés (fr-FR): las mismas llaves que es-MX. */
export default {
  loading: 'Chargement',
  retry: 'Recharger',
  formField: {
    confirmPassword: 'Confirmer le mot de passe',
    checking: 'Vérification',
    showPassword: 'Afficher le mot de passe',
    hidePassword: 'Masquer le mot de passe',
  },
  copyField: {
    copied: 'Copié',
  },
  listToolbar: {
    filter: 'Filtrer par statut',
    all: 'Tous les statuts',
    active: 'Actifs',
    inactive: 'Inactifs',
    deleted: 'Supprimés',
    allRecords: 'Tous',
  },
  paginator: {
    navigation: 'Pagination',
    range: 'Affichage de {range} sur {total} {noun}',
    perPage: 'Par page',
    first: 'Première page',
    previous: 'Page précédente',
    next: 'Page suivante',
    last: 'Dernière page',
    page: 'Page {page}',
    status: 'Page {page} sur {pages}',
    noun: {
      one: 'résultat',
      other: 'résultats',
    },
  },
  phoneField: {
    country: 'Indicatif: {country} ({dialCode}). Changer de pays',
    search: 'Rechercher un pays ou un indicatif',
    searchPlaceholder: 'Pays ou indicatif',
    countries: 'Pays',
    noResults: 'Aucun résultat pour «{query}»',
  },
  rangeMeter: {
    min: 'Minimum',
    max: 'Plafond',
  },
  select: {
    placeholder: 'Sélectionnez une option',
    search: 'Rechercher…',
    empty: 'Aucun résultat',
  },
  filePicker: {
    choose: 'Choisir un fichier',
    drop: 'ou faites-le glisser ici',
    change: 'Changer',
    remove: 'Retirer le fichier',
  },
  numberField: {
    decrement: 'Diminuer',
    increment: 'Augmenter',
  },
  columnChart: {
    summary: '{title}. {count} {items}. Total {totals}. Maximum par {item}: {max}.',
    latest: '{title}. {count} {items}. À la fin: {totals}. Maximum: {max}.',
    day: {
      header: 'Jour',
      one: 'jour',
      other: 'jours',
    },
  },
  timeField: {
    open: "Choisir l'heure",
    title: "Choisir l'heure",
    hours: 'Heure',
    minutes: 'Min',
    presets: 'Heures suggérées',
    placeholder: 'hh:mm',
    invalid: 'Saisissez une heure entre {min} et {max}',
    outOfRange: 'Choisissez une heure entre {min} et {max}',
  },
  dateField: {
    placeholder: 'jj/mm/aaaa',
    invalid: 'Saisissez une date valide (jj/mm/aaaa)',
    open: 'Ouvrir le calendrier',
    dialog: 'Choisir une date',
    chooseMonth: 'Choisir le mois, actuel: {month}',
    chooseYear: "Choisir l'année, actuelle: {year}",
    monthsOf: 'Mois de {year}',
    years: 'Années',
    nav: {
      days: { previous: 'Mois précédent', next: 'Mois suivant' },
      months: { previous: 'Année précédente', next: 'Année suivante' },
      years: { previous: 'Années précédentes', next: 'Années suivantes' },
    },
  },
  trash: {
    mark: 'Supprimé',
    deletedBy: 'Supprimé le {date} par {email}',
    deletedOn: 'Supprimé le {date}',
    column: 'Suppression',
    actions: 'Actions',
    restore: 'Restaurer',
    restoreLabel: 'Restaurer {name}',
    restoreError: 'Impossible de restaurer',
    eyebrow: 'Supprimés',
    note: 'Passera dans «Supprimés»: vous pourrez le restaurer pendant 1 an.',
    personNote: 'Ses données faciales et ses photos sont effacées définitivement.',
    faceAgain: 'Le visage devra être enregistré de nouveau.',
    photosGone: 'Ses photos ne sont pas récupérées.',
    empty: 'Rien de supprimé',
    emptyDescription: 'Ce que vous supprimez est conservé ici pendant un an.',
    count_one: '{count} supprimé',
    count_other: '{count} supprimés',
  },
  /** Reproductor de video propio (ui/VideoPlayer). */
  video: {
    position: 'Position de la vidéo',
  },
} satisfies Translation<typeof es>;
