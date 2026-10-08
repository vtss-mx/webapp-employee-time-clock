import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/devices';

/** Dispositivos de un empleado (antifraude 1b, decisión D2) en portugués de Brasil (pt-BR): las mismas llaves que es-MX. */
export default {
  title: 'Dispositivos',
  intro:
    'Navegadores e celulares usados para registrar o ponto ou verificar a identidade, cada um com uma chave que não pode ser copiada. Conforme a política, um não aprovado exige uma etapa a mais ou deixa os registros em revisão.',
  mineTitle: 'Meus dispositivos',
  mineIntro: 'Os navegadores ou celulares em que você registrou sua presença ou verificou sua identidade. Sua empresa pode aprová-los ou revogá-los.',
  empty: {
    title: 'Sem dispositivos',
    description: 'Aqui você verá os navegadores e celulares usados para registrar o ponto.',
  },
  noun: {
    one: 'dispositivo',
    other: 'dispositivos',
  },
  firstSeen: 'Primeiro uso: {date}',
  lastSeen: 'último uso: {date}',
  uses_one: '{count} uso',
  uses_other: '{count} usos',
  steppedUp: 'passou por uma etapa a mais em {date}',
  reviewedBy: 'Decidido por {name}',
  loadError: 'Não foi possível carregar os dispositivos',
  error: 'Não foi possível atualizar o dispositivo',
  eyebrow: 'Dispositivo do funcionário',
  actionLabel: '{action}: {name}',
  approve: {
    label: 'Aprovar',
    title: 'Aprovar “{name}”?',
    message: 'Os registros dele deixarão de ficar em revisão ou de exigir uma etapa a mais por causa do dispositivo. O resto do mecanismo de risco continua igual.',
  },
  revoke: {
    label: 'Revogar',
    title: 'Revogar “{name}”?',
    message: 'Ele voltará a ser tratado como um dispositivo desconhecido: conforme a política, os registros dele exigirão uma etapa a mais ou ficarão em revisão.',
  },
} satisfies Translation<typeof es>;
