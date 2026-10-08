import { derive } from '../../derive';
import es from '../es-MX/systemErrors';

/**
 * Textos de los errores del sistema y del estado del servidor en español de España (es-ES): solo lo que cambia respecto
 * de es-MX (vocabulario; glosario §3): «fallo», «registros» (del servidor), «cabeceras», «en cola» y «justificante».
 */
export default derive(es, {
  list: {
    subtitle_one: '{count} pendiente · fallos del servidor y de la aplicación web',
    subtitle_other: '{count} pendientes · fallos del servidor y de la aplicación web',
    emptyDescription: 'No hay fallos del servidor ni de la aplicación.',
  },
  detail: {
    lastTrace: 'Último traceId (búscalo en los registros del servidor)',
  },
  context: {
    headers: 'Cabeceras',
  },
  server: {
    kpis: {
      waiting: 'En cola',
    },
    storageReason: '{reason}. Hasta configurarlo, no se pueden guardar registros faciales ni justificantes',
  },
});
