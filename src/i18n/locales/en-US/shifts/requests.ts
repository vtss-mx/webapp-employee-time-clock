import type { Translation } from '../../../../types/i18n';
import type es from '../../es-MX/shifts/requests';

/** Textos de las solicitudes de cambio de turno en inglés (en-US): las mismas llaves que es-MX. */
export default {
  title: 'Shift change requests',
  backLabel: 'Requests',
  loadError: "Couldn't load the requests",
  subtitle_one: '{count} request from your employees',
  subtitle_other: '{count} requests from your employees',
  all: 'All requests',
  filter: 'Filter by status',
  noun: { one: 'request', other: 'requests' },
  empty: {
    pendingTitle: 'All caught up',
    pendingDescription: 'No shift requests to review.',
    statusTitle: 'No requests',
    statusDescription: 'Try another status.',
    allDescription: 'Shift changes your staff requests will appear here.',
  },
  item: {
    approve: "Approve {name}'s request",
    reject: "Reject {name}'s request",
    when: 'From {date} · requested {ago}',
    companyNote: 'Company note: “{note}”',
  },
  summary: {
    change: 'Change',
    from: 'From',
    requested: 'Requested',
    noShift: 'No shift',
    changesTo: 'changes to',
  },
  closed: {
    loadError: "Couldn't load the request",
    title: 'This request is no longer pending',
    description: 'It was already approved, rejected, or canceled by the employee.',
    action: 'View requests',
  },
  approve: {
    title: 'Approve shift change',
    request: 'Request',
    requestedShift: 'Requested shift',
    fromTomorrow: 'Choose tomorrow or later: the shift change is scheduled one day in advance.',
    dateHint: "Requested from {date}. Their current shift ends the day before, and what's already recorded doesn't change.",
    error: "Couldn't approve the shift change",
    confirmTitle: "Approve {employee}'s change to shift {shift}?",
    confirmMessage: "Their current shift ends the day before, and what's already recorded doesn't change.",
    submit: 'Approve change',
    done: {
      title: 'Shift change approved',
      text: '{employee} will have the {shift} shift from {date}.',
    },
  },
  reject: {
    title: 'Reject shift change',
    intro: "Asked to switch to shift {shift} from {date}. They'll keep their current shift and see this note on their request.",
    placeholder: "Explain why the change can't be made (e.g., not enough staff on that schedule)",
    confirmTitle: "Reject {employee}'s change?",
    confirmMessage: "They'll keep their current shift and see your note on their request.",
    requestedValue: '{shift} from {date}',
    done: {
      title: 'Request rejected',
      text: '{employee} keeps their shift and will see your note.',
    },
  },
} satisfies Translation<typeof es>;
