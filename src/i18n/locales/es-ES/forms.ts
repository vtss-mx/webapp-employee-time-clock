import { derive } from '../../derive';
import es from '../es-MX/forms';

/** Textos de las validaciones del cliente en español de España (es-ES): solo lo que cambia respecto de es-MX (vocabulario; glosario §3). */
export default derive(es, {
  validation: {
    email: {
      invalid: 'Introduce un correo válido',
    },
    rfc: {
      companyLength: 'El RFC debe tener 12 caracteres (persona jurídica) o 13 (persona física)',
    },
    maxEmployees: 'Escribe un número entero mayor que 0',
  },
  phone: {
    invalid: 'El teléfono no es válido para el prefijo +{code}',
  },
});
