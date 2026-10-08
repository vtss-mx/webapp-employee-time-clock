import { derive } from '../../derive';
import es from '../es-MX/companyHome';

/** Textos del panel de la empresa en español de España (es-ES): solo lo que cambia respecto de es-MX (vocabulario; glosario §3). */
export default derive(es, {
  cards: {
    newEmployee: {
      text: 'Introduce sus datos; el rostro se registra al iniciar sesión.',
    },
  },
});
