import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/docScan';

/** Document scanner (DocumentScanner, en-US): same keys and variables as es-MX. */
export default {
  title: 'Document photo',
  subtitle: 'Place the document in the guide; the photo is taken automatically.',
  take: 'Take photo',
  cameraFallback: "If the camera won't open, choose a file.",
  captureError: "Couldn't take the photo",
  fileName: 'document',
  guide: {
    searching: 'Place the document in the guide',
    tooFar: 'Move closer',
    tooDark: 'More light',
    tooBright: 'Avoid direct light',
    glare: 'Avoid glare',
    straighten: 'Center the document',
    holdStill: 'Hold steady',
    capturing: 'Capturing…',
  },
} satisfies Translation<typeof es>;
