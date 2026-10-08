import type { Translation } from '../../../../types/i18n';
import type es from '../../es-MX/policy/tuning';

/** Ajustes de los candados de la política y su confirmación en portugués de Brasil (pt-BR): las mismas llaves que es-MX. */
export default {
  title: 'Ajustes das travas',
  hint: 'Mais rigor protege mais, mas pode pedir para repetir a captura com mais frequência.',
  confirmTitle: 'Alterar “{label}” para {value}?',
  relaxes: 'Este valor protege menos contra fraude de identidade.',
  confirmLabel: 'Salvar ajuste',
  antiSpoofing: {
    label: 'Sensibilidade da detecção de fraude de identidade',
    description: 'O quanto ela é rigorosa ao detectar fotos, telas e vídeos.',
    saved: 'Detecção de fraude de identidade: nível {level}',
  },
  steps: {
    label: 'Movimentos da prova de vida',
    description: 'Movimentos aleatórios da cabeça (virar, olhar para cima ou para baixo, aproximar-se).',
    one: 'Um movimento aleatório (mais rápido, menos seguro).',
    two: 'Dois movimentos aleatórios: um vídeo gravado teria que acertar a sequência.',
    three: 'Três movimentos aleatórios: o mais difícil de enganar, inclusive para um vídeo gerado.',
    option_one: '{count} movimento',
    option_other: '{count} movimentos',
    saved: 'Prova de vida atualizada',
    savedText_one: 'Será pedido {count} movimento aleatório da cabeça.',
    savedText_other: 'Serão pedidos {count} movimentos aleatórios da cabeça.',
  },
  timeout: {
    label: 'Tempo para a prova de vida',
    description: 'Para os movimentos da prova de vida; se o tempo acabar, é pedido outro desafio sem repetir a leitura do rosto.',
    saved: 'Tempo da prova de vida atualizado',
    savedText: 'Cada desafio vencerá após {time}.',
  },
  flash: {
    label: 'Flash de cores',
    retired: 'Desativado por decisão do produto (2026-10-06): a tela não pisca mais cores. Os movimentos, a sequência e a verificação por voz cobrem a prova de vida.',
  },
  quality: {
    label: 'Qualidade mínima da captura',
    description: 'Capturas escuras ou borradas comparam mal e facilitam fraudes; mais alta, mais repetições com pouca luz.',
    none: 'Sem mínimo',
    basic: 'Básica',
    medium: 'Média',
    high: 'Alta',
    saved: 'Qualidade mínima atualizada',
    savedText: 'Capturas com qualidade inferior a “{level}” serão rejeitadas.',
    savedAny: 'Qualquer captura que passe pelos controles básicos é aceita.',
  },
  lockoutSaved: 'Bloqueio atualizado',
  lockoutFailures: {
    label: 'Tentativas antes do bloqueio',
    description: 'Tentativas malsucedidas ou suspeitas seguidas que bloqueiam temporariamente a verificação facial.',
    option_one: '{count} tentativa',
    option_other: '{count} tentativas',
    savedText_one: 'Será bloqueada após {count} tentativa malsucedida.',
    savedText_other: 'Será bloqueada após {count} tentativas malsucedidas seguidas.',
  },
  lockoutMinutes: {
    label: 'Duração do bloqueio',
    description: 'Tempo que a pessoa (ou o validador) deve esperar antes de tentar novamente.',
    savedText: 'O bloqueio durará {time}.',
  },
  qrLifetime: {
    label: 'Validade do código QR',
    description: 'Cada QR do funcionário se renova sozinho ao completar este tempo e vale uma única vez. Menos tempo, mais seguro.',
    saved: 'Validade do QR atualizada',
    savedText: 'Cada código QR durará {time} e valerá uma única vez.',
  },
  accuracy: {
    label: 'Precisão da localização',
    description: 'Margem máxima que o celular pode informar; mais rigor pode exigir ativar a localização precisa.',
    option: 'Até {distance}',
    saved: 'Precisão atualizada',
    savedText: 'Será pedido para repetir o registro se a localização tiver margem maior que {distance}.',
  },
  speed: {
    label: 'Velocidade máxima plausível',
    description: 'Entre dois registros seguidos; o que exigir ir mais rápido é rejeitado como deslocamento impossível.',
    saved: 'Velocidade atualizada',
    savedText: 'Serão rejeitados registros que exijam deslocamento a mais de {speed} desde o anterior.',
  },
} satisfies Translation<typeof es>;
