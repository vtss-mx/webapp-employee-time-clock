import type { Translation } from '../../../../types/i18n';
import type es from '../../es-MX/attendance/review';

/** Registros "en revisión" en portugués de Brasil (pt-BR): las mismas llaves que es-MX. */
export default {
  label: 'Revisão',
  inReview: 'Em revisão',
  pendingHint: 'Sua empresa precisa confirmar.',
  reasons: 'Motivo: {reasons}',
  note: 'Observação da empresa: {note}',
  decidedAt: 'Decidido em {date}',
  intro: 'Algo na captura ou na localização não foi totalmente confiável. Revise as evidências e confirme ou rejeite o registro.',
  eyebrow: 'Registro em revisão',
  confirm: 'Confirmar registro',
  confirmTitle: 'Confirmar o registro de {name}?',
  confirmMessage: 'Ele fica como válido. O funcionário o verá confirmado no histórico.',
  confirmError: 'Não foi possível confirmar o registro',
  reject: 'Rejeitar',
  onlyPending: 'Só em revisão',
  onlyPendingHint: 'Jornadas a confirmar ou rejeitar.',
  rejectPage: {
    title: 'Rejeitar registro',
    intro: 'A jornada não é excluída: fica rejeitada e você pode corrigi-la. O funcionário verá sua observação.',
    label: 'Observação para o funcionário',
    placeholder: 'Por que o registro não foi aceito',
    required: 'Escreva a observação (pelo menos 3 caracteres). O funcionário a verá.',
    confirmTitle: 'Rejeitar o registro de {name}?',
    confirmMessage: 'Ele fica marcado como rejeitado; o funcionário verá a observação no histórico.',
    decided: 'Este registro já foi decidido',
    error: 'Não foi possível rejeitar o registro',
    done: 'Registro rejeitado',
    doneText: '{name} verá sua observação no histórico.',
  },
} satisfies Translation<typeof es>;
