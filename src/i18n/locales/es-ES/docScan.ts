import { derive } from '../../derive';
import es from '../es-MX/docScan';

/**
 * Escáner de documento en español de España (es-ES): deriva de es-MX y solo cambia «tomar (fotos)» por «hacer (fotos)»
 * (glosario `docs/i18n/glosario.md` §3). Lo demás es el español común.
 */
export default derive(es, {
  subtitle: 'Coloca el documento en la guía; la foto se hace sola.',
  take: 'Hacer foto',
  captureError: 'No se pudo hacer la foto',
});
