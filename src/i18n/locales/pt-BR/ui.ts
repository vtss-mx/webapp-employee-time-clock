import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/ui';

/** Textos de componentes base de components/ui (campos, listas, paginador, fechas, horas...) en portugués de Brasil (pt-BR): las mismas llaves que es-MX. */
export default {
  loading: 'Carregando',
  retry: 'Carregar novamente',
  formField: {
    confirmPassword: 'Confirmar senha',
    checking: 'Verificando',
    showPassword: 'Mostrar senha',
    hidePassword: 'Ocultar senha',
  },
  copyField: {
    copied: 'Copiado',
  },
  listToolbar: {
    filter: 'Filtrar por situação',
    all: 'Todas as situações',
    active: 'Ativos',
    inactive: 'Inativos',
    deleted: 'Excluídos',
    allRecords: 'Todos',
  },
  paginator: {
    navigation: 'Paginação',
    range: 'Mostrando {range} de {total} {noun}',
    perPage: 'Por página',
    first: 'Primeira página',
    previous: 'Página anterior',
    next: 'Próxima página',
    last: 'Última página',
    page: 'Página {page}',
    status: 'Página {page} de {pages}',
    noun: {
      one: 'resultado',
      other: 'resultados',
    },
  },
  phoneField: {
    country: 'Código do país: {country} ({dialCode}). Trocar país',
    search: 'Pesquisar país ou código',
    searchPlaceholder: 'País ou código',
    countries: 'Países',
    noResults: 'Sem resultados para “{query}”',
  },
  rangeMeter: {
    min: 'Mínimo',
    max: 'Teto',
  },
  select: {
    placeholder: 'Selecione uma opção',
    search: 'Pesquisar…',
    empty: 'Sem resultados',
  },
  filePicker: {
    choose: 'Escolher arquivo',
    drop: 'ou arraste aqui',
    change: 'Trocar',
    remove: 'Remover arquivo',
  },
  numberField: {
    decrement: 'Diminuir',
    increment: 'Aumentar',
  },
  columnChart: {
    summary: '{title}. {count} {items}. Total {totals}. Máximo por {item}: {max}.',
    latest: '{title}. {count} {items}. No final: {totals}. Máximo: {max}.',
    day: {
      header: 'Dia',
      one: 'dia',
      other: 'dias',
    },
  },
  timeField: {
    open: 'Escolher hora',
    title: 'Escolher hora',
    hours: 'Hora',
    minutes: 'Min',
    presets: 'Horários sugeridos',
    placeholder: 'hh:mm',
    invalid: 'Informe uma hora entre {min} e {max}',
    outOfRange: 'Escolha uma hora entre {min} e {max}',
  },
  dateField: {
    placeholder: 'dd/mm/aaaa',
    invalid: 'Informe uma data válida (dd/mm/aaaa)',
    open: 'Abrir calendário',
    dialog: 'Escolher data',
    chooseMonth: 'Escolher mês, atual: {month}',
    chooseYear: 'Escolher ano, atual: {year}',
    monthsOf: 'Meses de {year}',
    years: 'Anos',
    nav: {
      days: { previous: 'Mês anterior', next: 'Próximo mês' },
      months: { previous: 'Ano anterior', next: 'Próximo ano' },
      years: { previous: 'Anos anteriores', next: 'Próximos anos' },
    },
  },
  trash: {
    mark: 'Excluído',
    deletedBy: 'Excluído em {date} por {email}',
    deletedOn: 'Excluído em {date}',
    column: 'Exclusão',
    actions: 'Ações',
    restore: 'Restaurar',
    restoreLabel: 'Restaurar {name}',
    restoreError: 'Não foi possível restaurar',
    eyebrow: 'Excluídos',
    note: 'Irá para “Excluídos”: você poderá restaurá-lo durante 1 ano.',
    personNote: 'Os dados faciais e as fotos são apagados para sempre.',
    faceAgain: 'Precisará cadastrar o rosto novamente.',
    photosGone: 'As fotos não são recuperadas.',
    empty: 'Nada excluído',
    emptyDescription: 'O que você excluir fica guardado aqui durante um ano.',
    count_one: '{count} excluído',
    count_other: '{count} excluídos',
  },
  /** Reproductor de video propio (ui/VideoPlayer). */
  video: {
    position: 'Posição do vídeo',
  },
} satisfies Translation<typeof es>;
