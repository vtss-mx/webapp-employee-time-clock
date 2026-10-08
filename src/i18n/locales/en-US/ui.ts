import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/ui';

/** Textos de componentes base de components/ui (campos, listas, paginador, fechas, horas...) en inglés (en-US): las mismas llaves que es-MX. */
export default {
  loading: 'Loading',
  retry: 'Reload',
  formField: {
    confirmPassword: 'Confirm password',
    checking: 'Checking',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
  },
  copyField: {
    copied: 'Copied',
  },
  listToolbar: {
    filter: 'Filter by status',
    all: 'All statuses',
    active: 'Active',
    inactive: 'Inactive',
    deleted: 'Deleted',
    allRecords: 'All',
  },
  paginator: {
    navigation: 'Pagination',
    range: 'Showing {range} of {total} {noun}',
    perPage: 'Per page',
    first: 'First page',
    previous: 'Previous page',
    next: 'Next page',
    last: 'Last page',
    page: 'Page {page}',
    status: 'Page {page} of {pages}',
    noun: {
      one: 'result',
      other: 'results',
    },
  },
  phoneField: {
    country: 'Country code: {country} ({dialCode}). Change country',
    search: 'Search country or code',
    searchPlaceholder: 'Country or code',
    countries: 'Countries',
    noResults: 'No results for “{query}”',
  },
  rangeMeter: {
    min: 'Minimum',
    max: 'Cap',
  },
  select: {
    placeholder: 'Select an option',
    search: 'Search…',
    empty: 'No results',
  },
  filePicker: {
    choose: 'Choose file',
    drop: 'or drag it here',
    change: 'Change',
    remove: 'Remove file',
  },
  numberField: {
    decrement: 'Decrease',
    increment: 'Increase',
  },
  columnChart: {
    summary: '{title}. {count} {items}. Total {totals}. Maximum per {item}: {max}.',
    latest: '{title}. {count} {items}. At the end: {totals}. Maximum: {max}.',
    day: {
      header: 'Day',
      one: 'day',
      other: 'days',
    },
  },
  timeField: {
    open: 'Choose time',
    title: 'Choose time',
    hours: 'Hour',
    minutes: 'Min',
    presets: 'Suggested times',
    placeholder: 'hh:mm AM',
    invalid: 'Enter a time between {min} and {max}',
    outOfRange: 'Choose a time between {min} and {max}',
  },
  dateField: {
    placeholder: 'mm/dd/yyyy',
    invalid: 'Enter a valid date (mm/dd/yyyy)',
    open: 'Open calendar',
    dialog: 'Choose date',
    chooseMonth: 'Choose month, current: {month}',
    chooseYear: 'Choose year, current: {year}',
    monthsOf: 'Months of {year}',
    years: 'Years',
    nav: {
      days: { previous: 'Previous month', next: 'Next month' },
      months: { previous: 'Previous year', next: 'Next year' },
      years: { previous: 'Previous years', next: 'Next years' },
    },
  },
  trash: {
    mark: 'Deleted',
    deletedBy: 'Deleted {date} by {email}',
    deletedOn: 'Deleted {date}',
    column: 'Deleted',
    actions: 'Actions',
    restore: 'Restore',
    restoreLabel: 'Restore {name}',
    restoreError: "Couldn't restore",
    eyebrow: 'Deleted',
    note: 'It moves to Deleted: you can restore it for 1 year.',
    personNote: 'Their face data and photos are erased permanently.',
    faceAgain: "They'll need to enroll their face again.",
    photosGone: "Their photos aren't restored.",
    empty: 'Nothing deleted',
    emptyDescription: 'What you delete stays here for one year.',
    count_one: '{count} deleted',
    count_other: '{count} deleted',
  },
  /** Reproductor de video propio (ui/VideoPlayer). */
  video: {
    position: 'Video position',
  },
} satisfies Translation<typeof es>;
