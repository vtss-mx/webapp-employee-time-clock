import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/dialogs';

/** Textos de popups de mensajes y confirmaciones, formularios con motivo y resultados masivos en francés (fr-FR): las mismas llaves que es-MX. */
export default {
  hero: {
    error: 'Erreur',
    warning: 'Attention',
    info: 'Information',
    success: 'Terminé',
  },
  confirm: {
    eyebrow: {
      create: 'Nouvel enregistrement',
      edit: 'Confirmer les modifications',
      delete: 'Supprimer',
      action: 'Confirmation',
    },
    changes: 'Modifications',
    changeCount_one: '{count} modification',
    changeCount_other: '{count} modifications',
    before: 'Avant:',
    after: 'Après:',
    details: 'Détails',
    typeToConfirm: 'Saisissez «{text}» pour confirmer',
  },
  bulk: {
    employeeNumber: 'Matricule {number}',
    more: 'et {count} de plus',
    withOmissions: '{title} avec omissions',
  },
  reject: {
    back: 'Demandes',
    noteLabel: "Note pour l'employé",
    noteShown: "Note visible par l'employé",
    noteTooShort: "Expliquez le motif (au moins {min} caractères). L'employé le verra.",
    errorTitle: 'Impossible de refuser la demande',
  },
} satisfies Translation<typeof es>;
