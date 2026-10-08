import { derive } from '../../derive';
import es from '../es-MX/faceSecurity';

/** Textos de la seguridad facial de la plataforma en español de España (es-ES): solo lo que cambia respecto de es-MX (vocabulario; glosario §3). */
export default derive(es, {
  flash: {
    explain:
      'La respuesta mide cuánto siguió el rostro los colores de la pantalla (1 = perfecto). Con demasiada luz ambiente, el destello casi no se nota y la medición no cuenta.',
  },
  protocol: {
    explain: 'El destello dictado revela cada color en el momento y la ráfaga envía unos segundos de recortes. Sirven contra vídeos inyectados.',
  },
});
