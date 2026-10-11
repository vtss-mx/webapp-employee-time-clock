import { derive } from '../../derive';
import es from '../es-MX/continuity';

/**
 * Continuidad del servicio en español de España (es-ES): solo lo que cambia respecto de es-MX (glosario §3:
 * «bitácora» es «historial»).
 */
export default derive(es, {
  pitrArchive: 'Cada cuánto se archiva el historial',
  rpoUnreachable: 'El RPO prometido es menor que el tiempo con que se archiva el historial: no se puede cumplir.',
});
