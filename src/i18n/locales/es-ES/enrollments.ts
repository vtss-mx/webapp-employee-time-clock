import { derive } from '../../derive';
import es from '../es-MX/enrollments';

/** Textos de la revisión de registros faciales y validaciones en español de España (es-ES): nada cambia respecto de es-MX (glosario §3). */
export default derive(es, {  review: {
    voice: {
      title: 'Vídeo de verificación',
      intro: 'Respuestas en vídeo a preguntas sobre sus datos; la voz y el rostro se compararon en el servidor.',
      play: 'Reproducir vídeo',
      loadError: 'No se pudo cargar el vídeo',
      expired: 'El vídeo ya no está disponible.',
    },
  },
});
