import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/services';

/** Textos que arman los servicios, los hooks y las utilidades del cliente en italiano (it-IT): las mismas llaves que es-MX. */
export default {
  availability: {
    checking: 'Verifica della disponibilità…',
  },
  qr: {
    loadFailed: 'Impossibile generare il codice QR. Controlla la connessione.',
  },
  deviceKey: {
    unavailable: 'Questo browser non consente di registrare il dispositivo. Usa Safari o Chrome aggiornati, fuori dalla navigazione privata.',
  },
  clientErrors: {
    noMessage: '(nessun messaggio)',
  },
} satisfies Translation<typeof es>;
