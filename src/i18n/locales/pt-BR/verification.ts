import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/verification';

/** Textos de resultados e historial de verificaciones de identidad en portugués de Brasil (pt-BR): las mismas llaves que es-MX. */
export default {
  outcome: {
    success: 'Bem-sucedida',
    failed: 'Malsucedida',
  },
  result: {
    kiosk: {
      title: 'Funcionário identificado',
      greeting: 'Identidade confirmada: {name}.',
      next: 'Próxima pessoa',
      home: 'Voltar ao início',
    },
    self: {
      title: 'Identidade confirmada',
      greeting: 'Olá, {name}.',
      finish: 'Concluir',
      changeMethod: 'Trocar método',
    },
    number: 'Número',
    confidence: 'Confiança',
    dateTime: 'Data e hora',
    retry: 'Tentar novamente',
  },
  history: {
    errorTitle: 'Não foi possível carregar o histórico',
    emptyTitle: 'Sem verificações',
    emptyDescription: 'Aqui você verá cada tentativa de verificar a identidade.',
    nounOne: 'tentativa',
    nounOther: 'tentativas',
    confidence: 'Confiança {value}',
  },
  map: {
    label: 'Mapa de verificações',
    pin: 'Local da verificação',
    loading: 'Carregando o mapa…',
    failed: 'O mapa não está disponível.',
  },
  company: {
    title: 'Verificações',
    subtitle: 'Onde e quando a identidade da sua gente foi verificada.',
    loadError: 'Não foi possível carregar as verificações',
    mapHint: 'Escolha uma verificação com localização para vê-la no mapa.',
    notIdentified: 'Não identificado',
    noun: { one: 'verificação', other: 'verificações' },
    filters: { all: 'Todas', success: 'Com sucesso', failed: 'Com falha', from: 'De', to: 'Até' },
    columns: { when: 'Data e hora', result: 'Resultado', method: 'Método', place: 'Local' },
    place: { show: 'Ver no mapa', none: 'Sem localização', accuracy: 'Precisão {distance}' },
    empty: { title: 'Sem verificações', description: 'Aqui você verá onde cada verificação foi feita.' },
    noMatch: { title: 'Sem resultados', description: 'Tente outro filtro ou intervalo de datas.' },
  },
} satisfies Translation<typeof es>;
