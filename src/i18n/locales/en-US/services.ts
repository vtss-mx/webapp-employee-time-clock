import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/services';

/** Textos que arman los servicios, los hooks y las utilidades del cliente en inglés (en-US): las mismas llaves que es-MX. */
export default {
  availability: {
    checking: 'Checking availability…',
  },
  qr: {
    loadFailed: "Couldn't generate the QR code. Check your connection.",
  },
  deviceKey: {
    unavailable: 'This browser cannot register the device. Use an up-to-date Safari or Chrome, outside private mode.',
  },
  clientErrors: {
    noMessage: '(no message)',
  },
} satisfies Translation<typeof es>;
