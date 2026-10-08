import { derive } from '../../derive';
import es from '../es-MX/qr';

/**
 * Textos del QR dinámico y del lector de QR en español de España (es-ES): solo lo que cambia respecto de es-MX
 * (vocabulario; glosario §3). La opción del menú de Chrome en España es «Versión para ordenador».
 */
export default derive(es, {
  dynamic: {
    paused: {
      text: 'Caducó mientras no lo veías.',
    },
  },
  phoneGuide: {
    accessAddress: 'Entra en la dirección de acceso',
    desktopSite: '¿Ya estás en una tableta o un teléfono? Desactiva {option} en el menú del navegador e inténtalo de nuevo.',
    desktopSiteOption: '«Versión para ordenador»',
  },
});
