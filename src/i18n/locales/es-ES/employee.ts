import { derive } from '../../derive';
import es from '../es-MX/employee';

/** Textos de las pantallas del empleado en español de España (es-ES): solo lo que cambia respecto de es-MX (vocabulario; glosario §3). */
export default derive(es, {
  enrollment: {
    privacy: 'Tus fotos, tu vídeo y tu voz se guardan cifrados y solo los revisa tu empresa; nunca se comparten.',
    tips: {
      light: 'Colócate en un lugar bien iluminado.',
    },
    reverify: {
      step: 'Registra tu rostro con prueba de vida; lleva alrededor de un minuto.',
    },
    confirm: {
      photo: {
        title: '¿Hacer tu foto inicial?',
        message: 'Se abrirá la cámara para hacer una foto de tu rostro de frente. Se guarda cifrada para tu registro.',
      },
      captures: {
        message: 'Se abrirá la cámara para hacer {count} capturas de tu rostro y la prueba de vida.',
      },
      video: {
        title: '¿Grabar el vídeo?',
        message_one: 'Se abrirán la cámara y el micrófono para responder {count} pregunta en vídeo.',
        message_other: 'Se abrirán la cámara y el micrófono para responder {count} preguntas en vídeo.',
      },
    },
    index: {
      state: { expired: 'Caducado' },
      hint: {
        expired: 'Tu foto ha caducado. Hazla de nuevo.',
      },
      action: { photo: 'Hacer foto', video: 'Grabar vídeo', resumeVideo: 'Continuar vídeo' },
    },
  },
  myQr: {
    employeeNumber: 'N.º de empleado {number}',
    singleUse: 'Cada código sirve una sola vez y caduca en segundos: una foto o captura de pantalla no sirve. No contiene tus datos personales ni biométricos.',
  },
});
