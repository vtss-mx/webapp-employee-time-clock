import type { Translation } from '../../../../types/i18n';
import type es from '../../es-MX/shifts/requests';

/** Textos de las solicitudes de cambio de turno en portugués de Brasil (pt-BR): las mismas llaves que es-MX. */
export default {
  title: 'Solicitações de troca de turno',
  backLabel: 'Solicitações',
  loadError: 'Não foi possível carregar as solicitações',
  subtitle_one: '{count} solicitação dos seus funcionários',
  subtitle_other: '{count} solicitações dos seus funcionários',
  all: 'Todas as solicitações',
  filter: 'Filtrar por situação',
  noun: { one: 'solicitação', other: 'solicitações' },
  empty: {
    pendingTitle: 'Tudo em dia',
    pendingDescription: 'Não há solicitações de turno para revisar.',
    statusTitle: 'Sem solicitações',
    statusDescription: 'Tente outra situação.',
    allDescription: 'Aqui você verá as trocas de turno que sua equipe pedir.',
  },
  item: {
    approve: 'Aprovar a solicitação de {name}',
    reject: 'Rejeitar a solicitação de {name}',
    when: 'A partir de {date} · pedida {ago}',
    companyNote: 'Observação da empresa: “{note}”',
  },
  summary: {
    change: 'Troca',
    from: 'A partir de',
    requested: 'Pedida',
    noShift: 'Sem turno',
    changesTo: 'muda para',
  },
  closed: {
    loadError: 'Não foi possível carregar a solicitação',
    title: 'Esta solicitação não está mais pendente',
    description: 'Já foi aprovada, rejeitada ou o funcionário a cancelou.',
    action: 'Ver solicitações',
  },
  approve: {
    title: 'Aprovar troca de turno',
    request: 'Solicitação',
    requestedShift: 'Turno pedido',
    fromTomorrow: 'Escolha a partir de amanhã: a troca de turno é programada com um dia de antecedência.',
    dateHint: 'Pediu a partir de {date}. O turno atual termina no dia anterior e o que já foi registrado não muda.',
    error: 'Não foi possível aprovar a troca de turno',
    confirmTitle: 'Aprovar a troca de {employee} para o turno {shift}?',
    confirmMessage: 'O turno atual termina no dia anterior e o que já foi registrado não muda.',
    submit: 'Aprovar troca',
    done: {
      title: 'Troca de turno aprovada',
      text: '{employee} terá o turno {shift} a partir de {date}.',
    },
  },
  reject: {
    title: 'Rejeitar troca de turno',
    intro: 'Pediu para mudar para o turno {shift} a partir de {date}. Manterá o turno atual e verá esta observação na solicitação.',
    placeholder: 'Explique por que a troca não pode ser feita (por exemplo, falta de pessoal nesse horário)',
    confirmTitle: 'Rejeitar a troca de {employee}?',
    confirmMessage: 'Manterá o turno atual e verá sua observação na solicitação.',
    requestedValue: '{shift} a partir de {date}',
    done: {
      title: 'Solicitação rejeitada',
      text: '{employee} mantém o turno e verá sua observação.',
    },
  },
} satisfies Translation<typeof es>;
