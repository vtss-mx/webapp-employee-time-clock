import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/services';

/** Textos que arman los servicios, los hooks y las utilidades del cliente en francés (fr-FR): las mismas llaves que es-MX. */
export default {
  availability: {
    checking: 'Vérification de la disponibilité…',
  },
  qr: {
    loadFailed: 'Impossible de générer le code QR. Vérifiez votre connexion.',
  },
  deviceKey: {
    unavailable: "Ce navigateur ne permet pas d'enregistrer l'appareil. Utilisez Safari ou Chrome à jour, hors navigation privée.",
  },
  clientErrors: {
    noMessage: '(aucun message)',
  },
} satisfies Translation<typeof es>;
