import type { Translation } from '../../../../types/i18n';
import type es from '../../es-MX/shifts/assign';

/** Textos de asignar un turno y del historial de turnos de un empleado en francés (fr-FR): las mismas llaves que es-MX. */
export default {
  title: 'Attribuer un horaire',
  appliesFrom: "Date d'effet",
  prepareError: "Impossible de préparer l'attribution",
  error: "Impossible d'attribuer l'horaire",
  errors: {
    shiftRequired: "Choisissez l'horaire",
    dateRequired: "Choisissez la date d'effet",
    fromTomorrow: "Choisissez une date à partir de demain: un changement d'horaire est programmé un jour à l'avance.",
    notPast: "L'horaire ne peut pas commencer à une date passée.",
  },
  hints: {
    hasShift: "A déjà un horaire: le changement s'applique à partir de demain et son horaire actuel prend fin la veille.",
    firstShift: "Son premier horaire peut commencer aujourd'hui.",
    scheduled: 'Un passage à {shift} est déjà prévu à partir du {date}: choisissez une date ultérieure ou annulez-le dans son historique.',
  },
  confirm: {
    eyebrowChange: "Changement d'horaire",
    title: "Attribuer l'horaire {shift} à {employee}?",
    note: 'Son horaire actuel prend fin la veille; ce qui est déjà enregistré conserve son horaire.',
  },
  done: {
    title: 'Horaire attribué',
    text: "{employee} aura l'horaire {shift} à partir du {date}.",
    endsBefore: 'Son horaire actuel prend fin la veille.',
    keepsRecords: 'Ce qui est déjà enregistré conserve son horaire.',
  },
  bulk: {
    title: 'Attribuer à plusieurs employés',
    subtitle: 'Le même horaire et la même date de début pour plusieurs employés.',
    dateHint:
      "Un employé qui a déjà un horaire change à partir de demain; si vous choisissez aujourd'hui, l'horaire ne lui est pas attribué. Son horaire actuel prend fin la veille.",
    employees: 'Employés',
    employeesLabel: "Employés auxquels attribuer l'horaire",
    employeesHint: 'Ceux qui ont déjà cette attribution ne changent pas; les inactifs ne la reçoivent pas.',
    employeesRequired: 'Choisissez au moins un employé',
    submit_one: 'Attribuer à {count} employé',
    submit_other: 'Attribuer à {count} employés',
    confirmTitle_one: "Attribuer l'horaire {shift} à {count} employé?",
    confirmTitle_other: "Attribuer l'horaire {shift} à {count} employés?",
    confirmMessage: "Ceux qui l'ont déjà ne changent pas et les inactifs ne la reçoivent pas. Le résultat indiquera à qui elle a été attribuée.",
    confirmNote: 'Ceux qui ont déjà un horaire changent à la date choisie; leur horaire actuel prend fin la veille.',
    result: {
      done: 'Attribué',
      unchanged: "L'avait déjà",
      skipped: 'Non attribué',
    },
  },
  history: {
    title: "Horaires de l'employé",
    loadError: "Impossible de charger l'employé",
    listError: 'Impossible de charger ses horaires',
    backLabel: 'Dossier',
    subtitle: 'Horaires en vigueur, programmés et passés',
    section: 'Horaires attribués',
    noun: { one: 'attribution', other: 'attributions' },
    empty: {
      title: 'Aucun horaire attribué',
      active: "Attribuez-lui un horaire pour qu'il puisse pointer.",
      inactive: 'Activez-le depuis son dossier pour lui attribuer un horaire.',
    },
    cancel: 'Annuler le changement',
    cancelConfirm: {
      eyebrow: 'Changement programmé',
      title: "Annuler le passage de {employee} à l'horaire {shift}?",
      message: '{employee} conservera son horaire actuel.',
      scheduledShift: 'Horaire programmé',
      wasFrom: "Devait s'appliquer à partir du",
      keep: 'Conserver le changement',
    },
    cancelError: "Impossible d'annuler le changement d'horaire",
    canceled: {
      title: "Changement d'horaire annulé",
      text: '{employee} conserve son horaire actuel.',
    },
    restoreTitle: "Restaurer le passage de {employee} à l'horaire {shift}?",
  },
} satisfies Translation<typeof es>;
