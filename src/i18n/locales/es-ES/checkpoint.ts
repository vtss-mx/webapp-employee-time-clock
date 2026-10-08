import { derive } from '../../derive';
import es from '../es-MX/checkpoint';

/** Textos del punto de control del validador en español de España (es-ES): solo lo que cambia respecto de es-MX (vocabulario; glosario §3). */
export default derive(es, {
  footer: 'Solo se identifican empleados activos de {company} · Cada intento queda en el historial',
});
