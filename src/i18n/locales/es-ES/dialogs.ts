import { derive } from '../../derive';
import es from '../es-MX/dialogs';

/** Textos de popups y confirmaciones en español de España (es-ES): solo lo que cambia respecto de es-MX (abreviatura «N.º», RAE). */
export default derive(es, {
  bulk: {
    employeeNumber: 'N.º {number}',
  },
});
