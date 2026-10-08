import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/services';

/** Textos que arman los servicios, los hooks y las utilidades del cliente en portugués de Brasil (pt-BR): las mismas llaves que es-MX. */
export default {
  availability: {
    checking: 'Verificando disponibilidade…',
  },
  qr: {
    loadFailed: 'Não foi possível gerar o código QR. Verifique sua conexão.',
  },
  deviceKey: {
    unavailable: 'Este navegador não permite registrar o dispositivo. Use o Safari ou o Chrome atualizados, fora do modo privado.',
  },
  clientErrors: {
    noMessage: '(sem mensagem)',
  },
} satisfies Translation<typeof es>;
