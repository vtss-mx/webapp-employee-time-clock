import { derive } from '../../derive';
import es from '../es-MX/accessReview';

/**
 * Revisión de accesos en español de España (es-ES): solo lo que cambia respecto de es-MX (glosario §3: «llave» es
 * «clave» y «vencer» es «caducar»).
 */
export default derive(es, {
  activeKeys_one: '{count} clave de integración vigente',
  activeKeys_other: '{count} claves de integración vigentes',
  kpis: {
    expiringKeys: 'Claves por caducar',
  },
  mfa: {
    satisfied_one: 'Cumple con {count} clave',
    satisfied_other: 'Cumple con {count} claves',
  },
  flags: {
    withoutMfa: 'Sin clave de acceso',
  },
  controls: {
    mfaGrace: 'Plazo para registrar la clave',
  },
});
