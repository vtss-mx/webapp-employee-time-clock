import { derive } from '../../derive';
import es from '../es-MX/devices';

/** Textos de los dispositivos de un empleado en español de España (es-ES): solo lo que cambia respecto de es-MX (vocabulario; glosario §3). */
export default derive(es, {
  intro:
    'Navegadores y teléfonos desde los que fichó o verificó su identidad, cada uno con una clave que no se puede copiar. Según la política, uno sin aprobar pide un paso más o deja sus registros en revisión.',
  empty: {
    description: 'Aquí verás los navegadores y teléfonos usados para fichar.',
  },
});
