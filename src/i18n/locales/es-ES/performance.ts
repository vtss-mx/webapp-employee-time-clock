import { derive } from '../../derive';
import es from '../es-MX/performance';

/** Textos de la pantalla Rendimiento en español de España (es-ES): solo lo que cambia respecto de es-MX («fallo», no «falla»). */
export default derive(es, {
  kpis: {
    serverErrors: 'Fallos del servidor (5xx)',
    errorRate: 'Fallos',
    errorRateHint_one: '{count} fallo',
    errorRateHint_other: '{count} fallos',
  },
  metrics: {
    intro: {
      HTTP: 'Cada ruta de la API medida en el servidor: duración, tiempo en la base de datos y datos. Fallos: respuestas 5xx.',
      FUNCTION: 'Funciones clave del servidor (rostro, almacenamiento, tareas en segundo plano). Fallos: excepciones.',
      WEB_API: 'El tiempo completo que espera la persona por cada ruta de la API, red incluida. Fallos: 5xx, sin conexión o tiempo agotado.',
    },
    sort: {
      errors: 'Más fallos',
    },
    columns: {
      errors: 'Fallos',
    },
  },
});
