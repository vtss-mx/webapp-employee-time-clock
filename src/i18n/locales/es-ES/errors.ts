import { derive } from '../../derive';
import es from '../es-MX/errors';

/**
 * Textos de los errores que arma el cliente en español de España (es-ES): solo lo que cambia respecto de es-MX
 * («Inténtalo de nuevo.» y «Se ha producido…», los mismos textos del servidor).
 */
export default derive(es, {
  status: {
    timeout: 'El servidor no respondió a tiempo. Inténtalo de nuevo.',
    server: 'Se ha producido un error inesperado. Inténtalo de nuevo.',
    unavailable: 'Servicio no disponible. Inténtalo de nuevo en unos segundos.',
  },
  invalidResponse: 'Respuesta inesperada del servidor. Inténtalo de nuevo.',
  unexpected: 'Se ha producido un error inesperado',
  unexpectedRetry: 'Se ha producido un error inesperado. Inténtalo de nuevo.',
  titles: {
    generic: 'Se ha producido un problema',
  },
});
