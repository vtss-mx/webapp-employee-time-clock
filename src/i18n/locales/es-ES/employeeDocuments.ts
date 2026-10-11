import { derive } from '../../derive';
import es from '../es-MX/employeeDocuments';

/**
 * Documentos de identidad del empleado en español de España (es-ES): solo cambia «tomar (fotos)» por «hacer (fotos)»
 * (glosario `docs/i18n/glosario.md` §3); lo demás es el español común de es-MX.
 */
export default derive(es, {
  upload: {
    notRecognized: {
      retake: 'Volver a hacer la foto',
    },
  },
});
