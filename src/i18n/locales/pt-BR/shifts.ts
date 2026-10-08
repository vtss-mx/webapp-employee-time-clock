import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/shifts';
import assign from './shifts/assign';
import form from './shifts/form';
import requests from './shifts/requests';

/** Textos de turnos, solicitudes de cambio y asignaciones en portugués de Brasil (pt-BR): las mismas llaves que es-MX. */
export default {
  days: {
    all: 'Todos os dias',
    none: 'Nenhum dia',
    range: '{from} a {to}',
  },
  schedule: {
    overnight: '{range} (dia seguinte)',
  },
  moment: {
    dayBefore: '{time} do dia anterior',
    dayAfter: '{time} do dia seguinte',
  },
  validation: {
    minutesRequired: 'Informe os minutos',
    minutesWhole: 'Informe minutos inteiros',
    minutesRange: 'Entre {min} e {max} min',
    nameRequired: 'Escreva um nome (por exemplo, “{example}”)',
    nameMax: 'Máximo de {max} caracteres',
  },
  breaks: {
    none: 'Sem intervalos',
    each: '{count} × {minutes} min',
  },
  period: {
    from: 'A partir de {from}',
    range: 'De {from} a {to}',
  },
  place: {
    none: 'Nenhum',
    noSites: 'Nenhum: todos os dias são remotos',
    onSiteOnly: 'Só no local: {sites}',
    allRemote: 'Remoto todos os dias',
    mixed: 'Remoto: {days} · No local: {sites}',
    noSite: 'nenhum local',
    siteRequired: 'Escolha pelo menos um local para os dias não remotos',
    siteFallback: 'Local {id}',
  },
  facts: {
    schedule: 'Horário',
    sites: 'Locais onde registra o ponto',
    remoteDays: 'Dias remotos',
  },
  card: {
    label: 'Turno {name}: quando e onde se registra o ponto',
    remote: 'Remoto: {days}',
    remoteDetail: 'Nesses dias, o ponto é registrado de qualquer lugar, com o rosto e a localização.',
    within: 'Até {distance} da localização dele',
  },
  list: {
    title: 'Turnos',
    loadError: 'Não foi possível carregar os turnos',
    subtitle_one: '{count} turno · quando e onde se registra o ponto',
    subtitle_other: '{count} turnos · quando e onde se registra o ponto',
    new: 'Novo turno',
    requests: 'Solicitações de troca',
    assignMany: 'Atribuir a vários',
    searchPlaceholder: 'Pesquisar por nome',
    searchLabel: 'Pesquisar turnos',
    noun: { one: 'turno', other: 'turnos' },
    columns: {
      shift: 'Turno',
      days: 'Dias',
      place: 'Onde se registra o ponto',
      breaks: 'Intervalos',
      tolerance: 'Tolerância',
      employees: 'Funcionários hoje',
    },
    lateTolerance: '{minutes} min de tolerância de atraso',
    noLateTolerance: 'Sem tolerância de atraso',
    noMatch: {
      title: 'Sem resultados',
      description: 'Tente outra pesquisa ou filtro.',
    },
    empty: {
      title: 'Sem turnos',
      description: 'Crie um turno para atribuí-lo à sua equipe.',
    },
  },
  recordStatus: {
    activateError: 'Não foi possível ativar {name}',
    deactivateError: 'Não foi possível desativar {name}',
    removeError: 'Não foi possível excluir {name}',
  },
  status: {
    title: 'Situação do turno',
    activeMeaning: 'Pode ser atribuído aos seus funcionários e escolhido nas solicitações de troca.',
    inactiveMeaning: 'Não pode ser atribuído, e quem o tem fica sem jornadas programadas.',
    deactivateWarning: 'Não poderá ser atribuído nem solicitado, e quem o tem ficará sem jornadas programadas até que você o ative. O que já foi registrado é mantido.',
    removeWarning: 'As solicitações de troca pendentes dele serão canceladas. Se alguém o tem ou já o teve, não pode ser excluído: desative-o.',
    activateQuestion: 'Ativar o turno {name}?',
    deactivateQuestion: 'Desativar o turno {name}?',
    removeQuestion: 'Excluir o turno {name}?',
    activated: 'Turno ativado',
    deactivated: 'Turno desativado',
    removed: 'Turno excluído',
    inUse: 'O turno está em uso: desative-o',
  },
  choice: {
    label: 'Turno',
    placeholder: 'Escolha um turno',
    chosenHint: 'Para alterar o horário ou onde se registra o ponto, edite o turno.',
    activeOnly: 'Só são oferecidos os turnos ativos.',
    since: 'A partir de quando',
    empty: {
      title: 'Sem turnos ativos',
      description: 'Crie ou ative um turno para atribuí-lo.',
    },
  },
  sitePicker: {
    inactive: 'Desativado: não aceita registros. Remova-o do turno ou ative-o em Locais de trabalho.',
    firstOnly_one: 'É mostrado o primeiro local ativo (ordem alfabética).',
    firstOnly_other: 'São mostrados os primeiros {count} locais ativos (ordem alfabética).',
    empty: {
      title: 'Sem locais ativos',
      description: 'Crie um local para escolhê-lo neste turno.',
      action: 'Criar local',
    },
  },
  weekdayPicker: {
    blocked: 'O turno não trabalha nesse dia',
    quick: 'Seleção rápida: {label}',
  },
  trash: {
    restoreTitle: 'Restaurar o turno {name}?',
    banner: 'Turno excluído',
  },
  form,
  assign,
  requests,
} satisfies Translation<typeof es>;
