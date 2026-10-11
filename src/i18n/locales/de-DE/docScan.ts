import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/docScan';

/** Dokumentscanner (DocumentScanner, de-DE): gleiche Schlüssel und Variablen wie es-MX (Anrede „Sie“). */
export default {
  title: 'Foto des Dokuments',
  subtitle: 'Platzieren Sie das Dokument im Rahmen; das Foto wird automatisch aufgenommen.',
  take: 'Foto aufnehmen',
  cameraFallback: 'Wenn die Kamera nicht startet, wählen Sie eine Datei.',
  captureError: 'Das Foto konnte nicht aufgenommen werden',
  fileName: 'Dokument',
  guide: {
    searching: 'Platzieren Sie das Dokument im Rahmen',
    tooFar: 'Kommen Sie näher',
    tooDark: 'Mehr Licht',
    tooBright: 'Vermeiden Sie direktes Licht',
    glare: 'Vermeiden Sie Reflexionen',
    straighten: 'Zentrieren Sie das Dokument',
    holdStill: 'Ruhig halten',
    capturing: 'Aufnahme…',
  },
} satisfies Translation<typeof es>;
