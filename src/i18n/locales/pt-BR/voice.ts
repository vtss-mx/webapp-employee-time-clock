import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/voice';

/** Voice and video check of the face enrollment (VoiceVerificationFlow). */
export default {
  title: 'Verificação por voz',
  stage: 'Pergunta {current} de {total}',
  intro: 'Responda em voz alta a cada pergunta olhando para a câmera. Vídeo e áudio são gravados.',
  answerNow: 'Responda agora',
  recording: 'Gravando',
  start: 'Responder',
  stop: 'Pronto',
  sending: 'Validando sua resposta…',
  retry: 'Repita a resposta',
  attemptsLeft_one: '{count} tentativa disponível',
  attemptsLeft_other: '{count} tentativas disponíveis',
  micLevel: 'Nível do microfone',
  micDenied: 'O acesso ao microfone está bloqueado. Permita no navegador para continuar.',
  unsupported: 'Seu navegador não consegue gravar vídeo com áudio. Abra a aplicação em Chrome, Safari, Edge ou Firefox atualizados.',
  tooShort: 'A gravação foi muito curta. Diga sua resposta completa.',
  seconds: '{seconds} s',
} satisfies Translation<typeof es>;
