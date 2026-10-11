import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/docScan';

/** Scanner de document (DocumentScanner, fr-FR) : mêmes clés et variables que es-MX (sans espace avant « ; »). */
export default {
  title: 'Photo du document',
  subtitle: 'Placez le document dans le guide; la photo se prend automatiquement.',
  take: 'Prendre une photo',
  cameraFallback: "Si la caméra ne s'ouvre pas, choisissez un fichier.",
  captureError: 'Impossible de prendre la photo',
  fileName: 'document',
  guide: {
    searching: 'Placez le document dans le guide',
    tooFar: 'Rapprochez-vous',
    tooDark: 'Plus de lumière',
    tooBright: 'Évitez la lumière directe',
    glare: 'Évitez les reflets',
    straighten: 'Centrez le document',
    holdStill: 'Maintenez stable',
    capturing: 'Capture en cours…',
  },
} satisfies Translation<typeof es>;
