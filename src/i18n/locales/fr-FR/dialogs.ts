import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/dialogs';

/** Textos de popups de mensajes y confirmaciones, formularios con motivo en francés (fr-FR): las mismas llaves que es-MX. */
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
} satisfies Translation<typeof es>;
