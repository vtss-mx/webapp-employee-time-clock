import { derive } from '../../derive';
import es from '../es-MX/signingKeys';

/**
 * Textos de las claves de firma en español de España (es-ES): solo lo que cambia respecto de es-MX
 * (vocabulario; glosario §3). Aquí «clave» ya se dice igual en los dos países, así que lo que cambia es
 * «vencer» → «caducar», «agregar» → «añadir» y «a lo más» → «como máximo».
 */
export default derive(es, {
  list: {
    add: 'Añadir clave',
  },
  form: {
    title: 'Añadir clave de firma',
    expiresIn: 'Caduca en',
    lifetimeHint_one: 'Como máximo {count} día.',
    lifetimeHint_other: 'Como máximo {count} días.',
  },
});
