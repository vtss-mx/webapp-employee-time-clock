import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/verification';

/** Textos de resultados e historial de verificaciones de identidad en inglés (en-US): las mismas llaves que es-MX. */
export default {
  outcome: {
    success: 'Successful',
    failed: 'Failed',
  },
  result: {
    kiosk: {
      title: 'Employee identified',
      greeting: 'Identity confirmed: {name}.',
      next: 'Next person',
      home: 'Back to start',
    },
    self: {
      title: 'Identity confirmed',
      greeting: 'Hi, {name}.',
      finish: 'Finish',
      changeMethod: 'Change method',
    },
    number: 'Number',
    confidence: 'Confidence',
    dateTime: 'Date and time',
    retry: 'Try again',
  },
  history: {
    errorTitle: "Couldn't load the log",
    emptyTitle: 'No verifications',
    emptyDescription: 'Each identity verification attempt will appear here.',
    nounOne: 'attempt',
    nounOther: 'attempts',
    confidence: 'Confidence {value}',
  },
  map: {
    label: 'Verifications map',
    pin: 'Verification location',
    loading: 'Loading the map…',
    failed: 'The map isn’t available.',
  },
  company: {
    title: 'Verifications',
    subtitle: 'Where and when your people’s identity was verified.',
    loadError: 'Couldn’t load the verifications',
    mapHint: 'Pick a verification with a location to see it on the map.',
    notIdentified: 'Not identified',
    noun: { one: 'verification', other: 'verifications' },
    filters: { all: 'All', success: 'Successful', failed: 'Failed', from: 'From', to: 'To' },
    columns: { when: 'Date and time', result: 'Result', method: 'Method', place: 'Place' },
    place: { show: 'View on the map', none: 'No location', accuracy: 'Accuracy {distance}' },
    empty: { title: 'No verifications', description: 'Here you’ll see where each verification happened.' },
    noMatch: { title: 'No results', description: 'Try another filter or date range.' },
  },
} satisfies Translation<typeof es>;
