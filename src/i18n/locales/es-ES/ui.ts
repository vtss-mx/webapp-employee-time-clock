import { derive } from '../../derive';
import es from '../es-MX/ui';

/** Textos de los componentes base en español de España (es-ES): solo lo que cambia respecto de es-MX («prefijo», no «lada»). */
export default derive(es, {
  phoneField: {
    country: 'Prefijo: {country} ({dialCode}). Cambiar país',
    search: 'Buscar país o prefijo',
    searchPlaceholder: 'País o prefijo',
  },
  video: { position: 'Posición del vídeo' },
});
