import { derive } from '../../derive';
import es from '../es-MX/dataExport';

/**
 * Exportación de los datos de una persona en español de España (es-ES): solo lo que cambia respecto de es-MX
 * (glosario §3: «llave de acceso» es «clave de acceso» y «vencer» es «caducar»).
 */
export default derive(es, {
  sections: {
    passkeys: 'Claves de acceso',
  },
  ask: {
    account: 'La cuenta, sus sesiones y sus claves de acceso',
  },
});
