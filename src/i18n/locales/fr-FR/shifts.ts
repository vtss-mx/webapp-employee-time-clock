import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/shifts';
import assign from './shifts/assign';
import form from './shifts/form';
import requests from './shifts/requests';

/** Textos de turnos, solicitudes de cambio y asignaciones en francés (fr-FR): las mismas llaves que es-MX. */
export default {
  days: {
    all: 'Tous les jours',
    none: 'Aucun jour',
    range: '{from} à {to}',
  },
  schedule: {
    overnight: '{range} (lendemain)',
  },
  moment: {
    dayBefore: '{time} la veille',
    dayAfter: '{time} le lendemain',
  },
  validation: {
    minutesRequired: 'Indiquez les minutes',
    minutesWhole: 'Saisissez des minutes entières',
    minutesRange: 'Entre {min} et {max} min',
    nameRequired: 'Saisissez un nom (p. ex. «{example}»)',
    nameMax: '{max} caractères maximum',
  },
  breaks: {
    none: 'Aucune pause',
    each: '{count} × {minutes} min',
  },
  period: {
    from: 'À partir du {from}',
    range: 'Du {from} au {to}',
  },
  place: {
    none: 'Aucun',
    noSites: 'Aucun: tous ses jours sont à distance',
    onSiteOnly: 'Sur site uniquement: {sites}',
    allRemote: 'À distance tous les jours',
    mixed: 'À distance: {days} · Sur site: {sites}',
    noSite: 'aucun site',
    siteRequired: 'Choisissez au moins un site pour les jours sur site',
    siteFallback: 'Site {id}',
  },
  facts: {
    schedule: 'Heures',
    sites: 'Sites de pointage',
    remoteDays: 'Jours à distance',
  },
  card: {
    label: 'Horaire {name}: quand et où pointer',
    remote: 'À distance: {days}',
    remoteDetail: "Ces jours-là, le pointage se fait depuis n'importe où, avec le visage et la position.",
    within: 'Dans un rayon de {distance} autour de son emplacement',
  },
  list: {
    title: 'Horaires',
    loadError: 'Impossible de charger les horaires',
    subtitle_one: '{count} horaire · quand et où pointer',
    subtitle_other: '{count} horaires · quand et où pointer',
    new: 'Nouvel horaire',
    requests: 'Demandes de changement',
    assignMany: 'Attribuer à plusieurs',
    searchPlaceholder: 'Rechercher par nom',
    searchLabel: 'Rechercher des horaires',
    noun: { one: 'horaire', other: 'horaires' },
    columns: {
      shift: 'Horaire',
      days: 'Jours',
      place: 'Lieu de pointage',
      breaks: 'Pauses',
      tolerance: 'Tolérance',
      employees: "Employés aujourd'hui",
    },
    lateTolerance: '{minutes} min de retard toléré',
    noLateTolerance: 'Aucun retard toléré',
    noMatch: {
      title: 'Aucun résultat',
      description: 'Essayez une autre recherche ou un autre filtre.',
    },
    empty: {
      title: 'Aucun horaire',
      description: "Créez un horaire pour l'attribuer à votre personnel.",
    },
  },
  recordStatus: {
    activateError: "Impossible d'activer {name}",
    deactivateError: 'Impossible de désactiver {name}',
    removeError: 'Impossible de supprimer {name}',
  },
  status: {
    title: "Statut de l'horaire",
    activeMeaning: 'Il peut être attribué à vos employés et choisi dans les demandes de changement.',
    inactiveMeaning: "Il ne peut pas être attribué et les personnes qui l'ont n'ont plus de journées programmées.",
    deactivateWarning:
      "Il ne pourra être ni attribué ni demandé, et les personnes qui l'ont n'auront plus de journées programmées tant que vous ne l'aurez pas activé. Ce qui est déjà enregistré est conservé.",
    removeWarning:
      "Ses demandes de changement en attente seront annulées. Si quelqu'un l'a ou l'a eu, il ne peut pas être supprimé: désactivez-le.",
    activateQuestion: "Activer l'horaire {name}?",
    deactivateQuestion: "Désactiver l'horaire {name}?",
    removeQuestion: "Supprimer l'horaire {name}?",
    activated: 'Horaire activé',
    deactivated: 'Horaire désactivé',
    removed: 'Horaire supprimé',
    inUse: "L'horaire est utilisé: désactivez-le",
  },
  choice: {
    label: 'Horaire',
    placeholder: 'Choisissez un horaire',
    chosenHint: "Pour changer les heures ou le lieu de pointage, modifiez l'horaire.",
    activeOnly: 'Seuls les horaires actifs sont proposés.',
    since: 'À partir de quand',
    empty: {
      title: 'Aucun horaire actif',
      description: "Créez ou activez un horaire pour l'attribuer.",
    },
  },
  sitePicker: {
    inactive: "Désactivé: il n'accepte pas de pointages. Retirez-le de l'horaire ou activez-le dans Sites de travail.",
    firstOnly_one: 'Le premier site actif est affiché (ordre alphabétique).',
    firstOnly_other: 'Les {count} premiers sites actifs sont affichés (ordre alphabétique).',
    empty: {
      title: 'Aucun site actif',
      description: 'Créez un site pour le choisir dans cet horaire.',
      action: 'Créer un site',
    },
  },
  weekdayPicker: {
    blocked: "Ce jour ne fait pas partie de l'horaire",
    quick: 'Sélection rapide: {label}',
  },
  trash: {
    restoreTitle: "Restaurer l'horaire {name}?",
    banner: 'Horaire supprimé',
  },
  form,
  assign,
  requests,
} satisfies Translation<typeof es>;
