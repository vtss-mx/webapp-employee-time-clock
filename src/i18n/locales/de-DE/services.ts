import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/services';

/** Textos que arman los servicios, los hooks y las utilidades del cliente en alemán (de-DE): las mismas llaves que es-MX. */
export default {
  availability: {
    checking: 'Verfügbarkeit wird geprüft…',
  },
  qr: {
    loadFailed: 'Der QR-Code konnte nicht erstellt werden. Prüfen Sie Ihre Verbindung.',
  },
  deviceKey: {
    unavailable: 'Dieser Browser kann das Gerät nicht registrieren. Verwenden Sie ein aktuelles Safari oder Chrome außerhalb des privaten Modus.',
  },
  clientErrors: {
    noMessage: '(keine Meldung)',
  },
} satisfies Translation<typeof es>;
