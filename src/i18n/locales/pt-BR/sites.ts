import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/sites';

/** Textos dos pontos de verificação em português do Brasil (pt-BR): as mesmas chaves que es-MX. */
export default {
  list: {
    title: 'Locais de verificação',
    loadError: 'Não foi possível carregar os locais',
    subtitle_one: '{count} local · onde a identidade é verificada e com qual raio',
    subtitle_other: '{count} locais · onde a identidade é verificada e com qual raio',
    new: 'Novo local',
    searchPlaceholder: 'Pesquisar por nome',
    searchLabel: 'Pesquisar locais',
    noun: { one: 'local', other: 'locais' },
    columns: {
      site: 'Local',
      address: 'Endereço',
      radius: 'Raio',
      code: 'Código',
    },
    kiosksOf_one: '{count} quiosque de {name}',
    kiosksOf_other: '{count} quiosques de {name}',
    noMatch: {
      title: 'Sem resultados',
      description: 'Tente outra pesquisa ou filtro.',
    },
    empty: {
      title: 'Sem locais de verificação',
      description: 'Crie um local para delimitar onde a identidade é verificada.',
    },
  },
  form: {
    loadError: 'Não foi possível carregar o local',
    newTitle: 'Novo local',
    editTitle: 'Editar local',
    newSubtitle: 'Um lugar onde a identidade é verificada: fábrica, filial, escritório…',
    create: 'Criar local',
    createError: 'Não foi possível criar o local',
    saveError: 'Não foi possível salvar o local',
    rule: 'Raio para verificar: {distance}.',
    created: {
      title: 'Local criado',
      text: '{name} já pode ser usado ao verificar. {rule}',
    },
    updated: {
      title: 'Local atualizado',
      text: '{name} · {rule}',
    },
    sections: {
      site: 'Local',
      location: 'Localização',
    },
    name: 'Nome do local',
    nameExample: 'Fábrica Hermosillo',
    nameHint: 'Único na sua empresa: por exemplo, “Fábrica Hermosillo”',
    radius: 'Raio para verificar (metros)',
    radiusHint: 'Entre {min} e {max} m: o tamanho do lugar mais a margem do GPS.',
    suggestedRadii: 'Raios sugeridos',
    onSiteNote: 'No local, a identidade é verificada com o rosto e a localização do celular, dentro deste raio.',
    locationIntro: 'Pesquise o lugar ou toque no mapa. O círculo marca o raio para verificar.',
    pointRequired: 'Marque no mapa o ponto do local',
  },
  fields: {
    address: 'Endereço',
    references: 'Referências',
    point: 'Ponto no mapa',
    radius: 'Raio para verificar',
  },
  confirm: {
    createTitle: 'Criar o local {name}?',
    createMessage: 'Poderá ser usado para delimitar onde a identidade é verificada.',
    willCreate: 'Será criado',
    editTitle: 'Salvar as alterações do local {name}?',
  },
  status: {
    title: 'Situação do local',
    activeMeaning: 'Aceita verificações de identidade neste lugar.',
    inactiveMeaning: 'Não aceita verificações de identidade neste lugar.',
    deactivateWarning: 'Não aceitará verificações aqui até que você o ative. O que já foi registrado não muda.',
    removeWarning: 'Só pode ser excluído se ninguém tiver sido verificado nele. Se já houver verificações, desative-o.',
    activateQuestion: 'Ativar o local {name}?',
    deactivateQuestion: 'Desativar o local {name}?',
    removeQuestion: 'Excluir o local {name}?',
    activated: 'Local ativado',
    deactivated: 'Local desativado',
    removed: 'Local excluído',
    inUse: 'O local está em uso: desative-o',
  },
  recordStatus: {
    activateError: 'Não foi possível ativar {name}',
    deactivateError: 'Não foi possível desativar {name}',
    removeError: 'Não foi possível excluir {name}',
  },
  validation: {
    nameRequired: 'Escreva o nome do local, por exemplo, “{example}”',
    nameMax: 'No máximo {max} caracteres',
  },
  trash: {
    restoreTitle: 'Restaurar o local {name}?',
    banner: 'Local excluído',
  },
  presence: {
    label: 'Código do local',
    hint: 'Pede ao verificar o código que o quiosque do local mostra.',
    on: 'Pede código',
    off: 'Sem código',
  },
} satisfies Translation<typeof es>;
