import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/feedback';

/** Textos de los popups de mensajes y de las confirmaciones en inglés (en-US). */
export default {
  understood: 'Got it',
  queue: '{position} of {total}',
  trace: {
    label: 'Trace code',
    copy: 'Copy trace code',
    copied: 'Copied',
  },
  invalidForm: {
    title: 'Check the details',
    text: 'Fix the highlighted fields.',
  },
  noChanges: {
    title: 'No changes',
    text: "There's nothing to save.",
  },
} satisfies Translation<typeof es>;
