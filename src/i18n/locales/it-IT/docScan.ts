import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/docScan';

/** Scanner del documento (DocumentScanner, it-IT): stesse chiavi e variabili di es-MX (si dà del «tu»). */
export default {
  title: 'Foto del documento',
  subtitle: 'Posiziona il documento nella guida; la foto viene scattata da sola.',
  take: 'Scatta foto',
  cameraFallback: 'Se la fotocamera non si apre, scegli un file.',
  captureError: 'Impossibile scattare la foto',
  fileName: 'documento',
  guide: {
    searching: 'Posiziona il documento nella guida',
    tooFar: 'Avvicinati',
    tooDark: 'Più luce',
    tooBright: 'Evita la luce diretta',
    glare: 'Evita i riflessi',
    straighten: 'Centra il documento',
    holdStill: 'Tieni fermo',
    capturing: 'Acquisizione…',
  },
} satisfies Translation<typeof es>;
