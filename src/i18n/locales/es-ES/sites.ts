import { derive } from '../../derive';
import es from '../es-MX/sites';

/** Textos de los puntos de verificación en español de España (es-ES): solo lo que cambia respecto de es-MX (glosario §3). */
export default derive(es, {
  list: {
    kiosksOf_one: '{count} quiosco de {name}',
    kiosksOf_other: '{count} quioscos de {name}',
  },
  form: {
    /** Un ejemplo sin una ciudad de México («Planta Hermosillo» en es-MX). */
    nameExample: 'Planta Norte',
    nameHint: 'Único en tu empresa: p. ej. “Planta Norte”',
  },
  presence: {
    hint: 'Pide al verificar el código que muestra el quiosco del sitio.',
  },
});
