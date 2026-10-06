import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/dialogs';

/** Textos de popups de mensajes y confirmaciones, formularios con motivo y resultados masivos en inglés (en-US): las mismas llaves que es-MX. */
export default {
  hero: {
    error: 'Error',
    warning: 'Attention',
    info: 'Information',
    success: 'Done',
  },
  confirm: {
    eyebrow: {
      create: 'New record',
      edit: 'Confirm changes',
      delete: 'Delete',
      action: 'Confirmation',
    },
    changes: 'Changes',
    changeCount_one: '{count} change',
    changeCount_other: '{count} changes',
    before: 'Before:',
    after: 'After:',
    details: 'Details',
    typeToConfirm: 'Type “{text}” to confirm',
  },
  bulk: {
    employeeNumber: 'No. {number}',
    more: 'and {count} more',
    withOmissions: '{title} (some skipped)',
  },
  reject: {
    back: 'Requests',
    noteLabel: 'Note for the employee',
    noteShown: 'Note they will see',
    noteTooShort: 'Explain why (at least {min} characters). The employee will see it.',
    errorTitle: "Couldn't reject the request",
  },
} satisfies Translation<typeof es>;
