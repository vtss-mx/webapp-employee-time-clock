import { derive } from '../../derive';
import es from '../es-MX/employees';

/** Textos de los empleados de la empresa en español de España (es-ES): solo lo que cambia respecto de es-MX (vocabulario; glosario §3). */
export default derive(es, {
  number: 'N.º {number}',
  fields: {
    firstName: 'Nombre',
    nss: 'N.º de Seguridad Social (NSS)',
    employeeNumber: 'N.º de empleado',
    headwearHint: 'Para prendas usadas por motivos religiosos o médicos. Las gafas y la mascarilla siempre se deben retirar.',
  },
  detail: {
    history: 'Historial de verificaciones',
  },
});
