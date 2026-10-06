import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/shifts';
import assign from './shifts/assign';
import form from './shifts/form';
import requests from './shifts/requests';

/** Textos de turnos, solicitudes de cambio y asignaciones en inglés (en-US): las mismas llaves que es-MX. */
export default {
  days: {
    all: 'Every day',
    none: 'No days',
    range: '{from}–{to}',
  },
  schedule: {
    overnight: '{range} (next day)',
  },
  moment: {
    dayBefore: '{time} the day before',
    dayAfter: '{time} the next day',
  },
  validation: {
    minutesRequired: 'Enter the minutes',
    minutesWhole: 'Enter whole minutes',
    minutesRange: 'Between {min} and {max} min',
    nameRequired: 'Enter a name (e.g., "{example}")',
    nameMax: 'Up to {max} characters',
  },
  breaks: {
    none: 'No breaks',
    each: '{count} × {minutes} min',
  },
  period: {
    from: 'From {from}',
    range: 'From {from} to {to}',
  },
  place: {
    none: 'None',
    noSites: 'None: all its days are remote',
    onSiteOnly: 'On site only: {sites}',
    allRemote: 'Remote every day',
    mixed: 'Remote: {days} · On site: {sites}',
    noSite: 'no site',
    siteRequired: 'Choose at least one site for non-remote days',
    siteFallback: 'Site {id}',
  },
  facts: {
    schedule: 'Schedule',
    sites: 'Check-in sites',
    remoteDays: 'Remote days',
  },
  card: {
    label: '{name} shift: when and where to check in',
    remote: 'Remote: {days}',
    remoteDetail: 'On those days they check in from anywhere, with their face and location.',
    within: 'Within {distance} of its location',
  },
  list: {
    title: 'Shifts',
    loadError: "Couldn't load the shifts",
    subtitle_one: '{count} shift · when and where to check in',
    subtitle_other: '{count} shifts · when and where to check in',
    new: 'New shift',
    requests: 'Change requests',
    assignMany: 'Assign to multiple',
    searchPlaceholder: 'Search by name',
    searchLabel: 'Search shifts',
    noun: { one: 'shift', other: 'shifts' },
    columns: {
      shift: 'Shift',
      days: 'Days',
      place: 'Where to check in',
      breaks: 'Breaks',
      tolerance: 'Tolerance',
      employees: 'Employees today',
    },
    lateTolerance: '{minutes} min late tolerance',
    noLateTolerance: 'No late tolerance',
    noMatch: {
      title: 'No results',
      description: 'Try another search or filter.',
    },
    empty: {
      title: 'No shifts',
      description: 'Create a shift to assign it to your staff.',
    },
  },
  recordStatus: {
    activateError: "Couldn't activate {name}",
    deactivateError: "Couldn't deactivate {name}",
    removeError: "Couldn't delete {name}",
  },
  status: {
    title: 'Shift status',
    activeMeaning: 'It can be assigned to your employees and chosen in shift change requests.',
    inactiveMeaning: "It can't be assigned, and the people who have it have no scheduled workdays.",
    deactivateWarning: "It can't be assigned or requested, and the people who have it will have no scheduled workdays until you activate it. Existing records are kept.",
    removeWarning: "Its pending change requests will be canceled. If anyone has or had it, it can't be deleted: deactivate it instead.",
    activateQuestion: 'Activate shift {name}?',
    deactivateQuestion: 'Deactivate shift {name}?',
    removeQuestion: 'Delete shift {name}?',
    activated: 'Shift activated',
    deactivated: 'Shift deactivated',
    removed: 'Shift deleted',
    inUse: 'The shift is in use: deactivate it',
  },
  choice: {
    label: 'Shift',
    placeholder: 'Choose a shift',
    chosenHint: 'To change the schedule or where to check in, edit the shift.',
    activeOnly: 'Only active shifts are listed.',
    since: 'Start date',
    empty: {
      title: 'No active shifts',
      description: 'Create or activate a shift to assign it.',
    },
  },
  sitePicker: {
    inactive: "Deactivated: it doesn't accept records. Remove it from the shift or activate it in Work sites.",
    firstOnly_one: 'Showing the first active site (alphabetical order).',
    firstOnly_other: 'Showing the first {count} active sites (alphabetical order).',
    empty: {
      title: 'No active sites',
      description: 'Create a site to choose it for this shift.',
      action: 'Create site',
    },
  },
  weekdayPicker: {
    blocked: "The shift doesn't work that day",
    quick: 'Quick pick: {label}',
  },
  trash: {
    restoreTitle: 'Restore shift {name}?',
    banner: 'Shift deleted',
  },
  form,
  assign,
  requests,
} satisfies Translation<typeof es>;
