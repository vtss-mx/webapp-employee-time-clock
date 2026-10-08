import { derive } from '../../derive';
import es from '../es-MX/usage';

/** Textos del consumo de la plataforma en español de España (es-ES): solo lo que cambia respecto de es-MX («coste», «fallo»). */
export default derive(es, {
  kpis: {
    serverErrors: 'Fallos del servidor (5xx)',
  },
  cost: {
    title: 'Coste frente a consumo',
    noPlan: 'No se le cobra: no hay coste con qué comparar su consumo.',
    perThousandRequests: 'Coste estimado por {thousand} peticiones',
    perMegabyte: 'Coste estimado por MB transferido',
  },
});
