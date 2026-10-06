import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/checkpoint';

/** Textos de punto de control del validador en inglés (en-US): las mismas llaves que es-MX. */
export default {
  errorTitle: "Couldn't load the checkpoint",
  question: 'Choose how to identify the next person.',
  start: 'Start',
  footer: 'Only active employees of {company} are identified · Every attempt is logged',
  notIdentified: 'Employee not identified',
  failed: "Couldn't identify",
  invalidQr: 'Invalid QR. Ask the employee to show their code from the app',
  qrDisabled: {
    title: 'QR identification turned off',
    text: 'This validator uses the “{mode}” mode, but your company turned off QR. Ask an administrator to turn it on or change the mode.',
  },
  face: {
    title: 'Recognize face',
    submitting: 'Identifying…',
    useQr: 'Use their QR code',
  },
  qr: {
    title: 'Scan QR',
    text: "Point the camera at the QR code on the employee's phone. It scans automatically and works only once.",
    busy: 'QR detected. Identifying…',
  },
  qrFace: {
    qrTitle: 'Step 1 of 2 · QR code',
    qrText: "Scan the QR code on the employee's phone. Then their face will be confirmed.",
    busy: 'QR detected. Looking up the employee…',
    faceTitle: 'Step 2 of 2 · {name}',
  },
  recent: {
    title: 'Latest identifications',
    errorTitle: "Couldn't load recent identifications",
    emptyTitle: 'No identifications',
    emptyDescription: 'People this device identifies will appear here.',
    nounOne: 'identification',
    nounOther: 'identifications',
    identified: 'Identified',
    notIdentified: 'Not identified',
  },
} satisfies Translation<typeof es>;
