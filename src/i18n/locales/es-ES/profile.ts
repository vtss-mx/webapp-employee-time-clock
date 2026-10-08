import { derive } from '../../derive';
import es from '../es-MX/profile';

/**
 * Textos de Mi perfil en español de España (es-ES): solo lo que cambia respecto de es-MX. En España «iniciar» no se usa
 * como intransitivo («la sesión inició»): la sesión está «iniciada».
 */
export default derive(es, {
  sessions: {
    activity: '{ip} · Activa {ago} · Iniciada {started}',
    revoke: {
      started: 'Iniciada',
    },
  },
});
