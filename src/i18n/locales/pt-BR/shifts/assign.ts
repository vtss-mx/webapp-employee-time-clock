import type { Translation } from '../../../../types/i18n';
import type es from '../../es-MX/shifts/assign';

/** Textos de asignar un turno y del historial de turnos de un empleado en portugués de Brasil (pt-BR): las mismas llaves que es-MX. */
export default {
  title: 'Atribuir turno',
  appliesFrom: 'Vale a partir de',
  prepareError: 'Não foi possível preparar a atribuição',
  error: 'Não foi possível atribuir o turno',
  errors: {
    shiftRequired: 'Escolha o turno',
    dateRequired: 'Escolha a data a partir da qual vale',
    fromTomorrow: 'Escolha a partir de amanhã: uma troca de turno é programada com um dia de antecedência.',
    notPast: 'O turno não pode começar em uma data passada.',
  },
  hints: {
    hasShift: 'Já tem turno: a troca vale a partir de amanhã ou depois e o turno atual termina no dia anterior.',
    firstShift: 'O primeiro turno pode começar hoje.',
    scheduled: 'Já tem uma troca para {shift} a partir de {date}: escolha uma data posterior ou cancele-a no histórico.',
  },
  confirm: {
    eyebrowChange: 'Troca de turno',
    title: 'Atribuir o turno {shift} a {employee}?',
    note: 'O turno atual termina no dia anterior; o que já foi registrado mantém o seu turno.',
  },
  done: {
    title: 'Turno atribuído',
    text: '{employee} terá o turno {shift} a partir de {date}.',
    endsBefore: 'O turno atual termina no dia anterior.',
    keepsRecords: 'O que já foi registrado mantém o seu turno.',
  },
  bulk: {
    title: 'Atribuir a vários funcionários',
    subtitle: 'O mesmo turno e a mesma data de início para vários funcionários.',
    dateHint: 'Quem já tem turno muda a partir de amanhã ou depois; se você escolher hoje, não recebe a atribuição. O turno atual termina no dia anterior.',
    employees: 'Funcionários',
    employeesLabel: 'Funcionários que recebem o turno',
    employeesHint: 'Quem já tem esta atribuição não muda; os inativos não recebem a atribuição.',
    employeesRequired: 'Escolha pelo menos um funcionário',
    submit_one: 'Atribuir a {count} funcionário',
    submit_other: 'Atribuir a {count} funcionários',
    confirmTitle_one: 'Atribuir o turno {shift} a {count} funcionário?',
    confirmTitle_other: 'Atribuir o turno {shift} a {count} funcionários?',
    confirmMessage: 'Quem já o tem não muda e os inativos não recebem a atribuição. O resultado mostrará quem recebeu.',
    confirmNote: 'Quem já tem turno muda a partir da data escolhida; o turno atual termina no dia anterior.',
    result: {
      done: 'Atribuído',
      unchanged: 'Já tinham',
      skipped: 'Não atribuído',
    },
  },
  history: {
    title: 'Turnos do funcionário',
    loadError: 'Não foi possível carregar o funcionário',
    listError: 'Não foi possível carregar os turnos',
    backLabel: 'Ficha',
    subtitle: 'Turnos vigentes, programados e anteriores',
    section: 'Turnos atribuídos',
    noun: { one: 'atribuição', other: 'atribuições' },
    empty: {
      title: 'Sem turno atribuído',
      active: 'Atribua um turno para que possa registrar o ponto.',
      inactive: 'Ative o funcionário na ficha dele para atribuir um turno.',
    },
    cancel: 'Cancelar troca',
    cancelConfirm: {
      eyebrow: 'Troca programada',
      title: 'Cancelar a troca de {employee} para o turno {shift}?',
      message: '{employee} manterá o turno que tem.',
      scheduledShift: 'Turno programado',
      wasFrom: 'Valeria a partir de',
      keep: 'Manter a troca',
    },
    cancelError: 'Não foi possível cancelar a troca de turno',
    canceled: {
      title: 'Troca de turno cancelada',
      text: '{employee} mantém o turno que tinha.',
    },
    restoreTitle: 'Restaurar a troca de {employee} para o turno {shift}?',
  },
} satisfies Translation<typeof es>;
