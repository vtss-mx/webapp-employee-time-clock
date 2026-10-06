import type { Translation } from '../../../../types/i18n';
import type es from '../../es-MX/attendance/review';

/** Registros "en revisión" en inglés (en-US): las mismas llaves que es-MX. */
export default {
  label: 'Review',
  inReview: 'Under review',
  pendingHint: 'Your company needs to confirm it.',
  reasons: 'Why: {reasons}',
  note: 'Company note: {note}',
  decidedAt: 'Decided on {date}',
  intro: 'Something in the capture or location wasn’t fully reliable. Review the evidence and confirm or reject the record.',
  eyebrow: 'Record under review',
  confirm: 'Confirm record',
  confirmTitle: 'Confirm {name}’s record?',
  confirmMessage: 'It’s kept as valid. The employee will see it confirmed in their history.',
  confirmError: 'Couldn’t confirm the record',
  reject: 'Reject',
  onlyPending: 'Under review only',
  onlyPendingHint: 'Workdays to confirm or reject.',
  rejectPage: {
    title: 'Reject record',
    intro: 'The workday isn’t deleted: it’s marked as rejected and you can correct it. The employee will see your note.',
    label: 'Note for the employee',
    placeholder: 'Why the record isn’t accepted',
    required: 'Write the note (at least 3 characters). The employee will see it.',
    confirmTitle: 'Reject {name}’s record?',
    confirmMessage: 'It’s marked as rejected; the employee will see the note in their history.',
    decided: 'This record has already been decided',
    error: 'Couldn’t reject the record',
    done: 'Record rejected',
    doneText: '{name} will see your note in their history.',
  },
} satisfies Translation<typeof es>;
