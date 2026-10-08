import type { Translation } from '../../../../types/i18n';
import type es from '../../es-MX/attendance/review';

/** Registros "en revisión" en francés (fr-FR): las mismas llaves que es-MX. */
export default {
  label: 'Examen',
  inReview: "En cours d'examen",
  pendingHint: 'Votre entreprise doit le confirmer.',
  reasons: 'Motif: {reasons}',
  note: "Note de l'entreprise: {note}",
  decidedAt: 'Décidé le {date}',
  intro: "Un élément de la capture ou de la position n'était pas entièrement fiable. Examinez les éléments et confirmez ou refusez le pointage.",
  eyebrow: "Pointage en cours d'examen",
  confirm: 'Confirmer le pointage',
  confirmTitle: 'Confirmer le pointage de {name}?',
  confirmMessage: "Il est conservé comme valide. L'employé le verra confirmé dans son historique.",
  confirmError: 'Impossible de confirmer le pointage',
  reject: 'Refuser',
  onlyPending: "En cours d'examen uniquement",
  onlyPendingHint: 'Journées de travail à confirmer ou à refuser.',
  rejectPage: {
    title: 'Refuser le pointage',
    intro: "La journée de travail n'est pas supprimée: elle est marquée comme refusée et vous pouvez la corriger. L'employé verra votre note.",
    label: "Note pour l'employé",
    placeholder: "Pourquoi le pointage n'est pas accepté",
    required: "Saisissez la note (au moins 3 caractères). L'employé la verra.",
    confirmTitle: 'Refuser le pointage de {name}?',
    confirmMessage: "Il est marqué comme refusé; l'employé verra la note dans son historique.",
    decided: 'Une décision a déjà été prise pour ce pointage',
    error: 'Impossible de refuser le pointage',
    done: 'Pointage refusé',
    doneText: '{name} verra votre note dans son historique.',
  },
} satisfies Translation<typeof es>;
