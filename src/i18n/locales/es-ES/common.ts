import { derive } from '../../derive';
import es from '../es-MX/common';

/** Palabras y frases generales en español de España (es-ES): solo lo que cambia respecto de es-MX (vocabulario; glosario §3). */
export default derive(es, {
  fields: {
    mobilePhone: 'Teléfono móvil',
  },
  values: {
    /** «Capturar» (introducir datos) es de México: un campo sin valor es «Sin indicar». */
    empty: 'Sin indicar',
  },
});
