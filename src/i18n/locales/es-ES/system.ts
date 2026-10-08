import { derive } from '../../derive';
import es from '../es-MX/system';

/** Textos de las pantallas del sistema en español de España (es-ES): solo lo que cambia respecto de es-MX («Inténtalo de nuevo.»). */
export default derive(es, {
  loadError: {
    message: 'Revisa tu conexión e inténtalo de nuevo. Si continúa, avisa al administrador de tu empresa.',
  },
  crash: {
    message: 'Tus datos están a salvo. Inténtalo de nuevo.',
  },
  unexpected: {
    title: 'Se ha producido un problema',
    text: 'Inténtalo de nuevo. Si continúa, recarga la página.',
  },
});
