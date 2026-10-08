import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/feedback';

/** Textos de los popups de mensajes y de las confirmaciones en francés (fr-FR). */
export default {
  understood: 'Compris',
  queue: '{position} sur {total}',
  trace: {
    label: 'Code de suivi',
    copy: 'Copier le code de suivi',
    copied: 'Copié',
  },
  invalidForm: {
    title: 'Vérifiez les informations',
    text: 'Corrigez les champs signalés.',
  },
  noChanges: {
    title: 'Aucune modification',
    text: "Il n'y a rien à enregistrer.",
  },
} satisfies Translation<typeof es>;
