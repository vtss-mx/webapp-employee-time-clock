import { derive } from '../../derive';
import es from '../es-MX/voice';

/** Verificación por voz y vídeo del registro facial en español de España (es-ES): solo cambia «vídeo» (glosario §3). */
export default derive(es, {
  intro: 'Responde en voz alta a cada pregunta mirando a la cámara. Se graba vídeo y audio.',
  unsupported: 'Tu navegador no puede grabar vídeo con audio. Abre la aplicación en Chrome, Safari, Edge o Firefox actualizados.',
});
