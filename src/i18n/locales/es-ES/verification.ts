import { derive } from '../../derive';
import es from '../es-MX/verification';

/** Textos de las verificaciones de identidad en español de España (es-ES): solo lo que cambia respecto de es-MX («historial», no «bitácora»). */
export default derive(es, {
  history: {
    errorTitle: 'No se pudo cargar el historial',
  },
});
