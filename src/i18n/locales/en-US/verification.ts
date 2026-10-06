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
} satisfies Translation<typeof es>;
