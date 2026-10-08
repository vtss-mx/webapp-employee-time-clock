/** Verificación por voz y video del registro facial (VoiceVerificationFlow; decisión del dueño, 2026-10-06). */
export default {
  title: 'Verificación por voz',
  stage: 'Pregunta {current} de {total}',
  intro: 'Responde en voz alta a cada pregunta mirando a la cámara. Se graba video y audio.',
  answerNow: 'Responde ahora',
  recording: 'Grabando',
  start: 'Responder',
  stop: 'Listo',
  sending: 'Validando tu respuesta…',
  retry: 'Repite la respuesta',
  attemptsLeft_one: '{count} intento disponible',
  attemptsLeft_other: '{count} intentos disponibles',
  micLevel: 'Nivel del micrófono',
  micDenied: 'El permiso del micrófono está bloqueado. Permítelo en tu navegador para continuar.',
  unsupported: 'Tu navegador no puede grabar video con audio. Abre la aplicación en Chrome, Safari, Edge o Firefox actualizados.',
  tooShort: 'La grabación fue muy corta. Di tu respuesta completa.',
  seconds: '{seconds} s',
} as const;
