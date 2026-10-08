import { derive } from '../../derive';
import es from '../es-MX/drift';

/** Deriva de señales en español de España (es-ES): solo lo que cambia respecto de es-MX (glosario §3: «historial»). */
export default derive(es, {
  versions: {
    intro: 'Cambios de versión anotados en el historial del motor: una semana con un motor o unos modelos distintos no se compara con la anterior.',
  },
});
