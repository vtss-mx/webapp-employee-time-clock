import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/policy';
import antifraud from './policy/antifraud';
import tuning from './policy/tuning';

/** Textos de política de verificación y ajustes de la prueba de vida de una empresa en portugués de Brasil (pt-BR): las mismas llaves que es-MX. */
export default {
  /** Control retirado por decisión del dueño del producto (2026-10-06): se muestra apagado y sin cambios. */
  retired: 'Desativado por decisão do produto (2026-10-06).',
  loadError: 'Não foi possível carregar a política de verificação',
  title: 'Política de verificação de identidade',
  saveError: 'Não foi possível salvar',
  recommended: 'Recomendado',
  appliesTo: 'É aplicada em segundos a toda a equipe de {company}.',
  confidence: {
    title: 'Nível de confiança',
    intro: 'Probabilidade mínima de que a pessoa diante da câmera seja o funcionário cadastrado.',
    identifyIntro:
      '{lead} (validadores): você pode exigir mais, porque procurar entre muitos aumenta as correspondências falsas. Nunca vale abaixo do nível anterior.',
    identifyLead: 'Ao identificar entre todos os funcionários',
    identifyLabel: 'Nível de confiança para identificar entre todos',
    saved: 'Nível de confiança atualizado',
    savedText: 'Será exigido {value} em cada verificação facial.',
    identifySaved: 'Confiança para identificar atualizada',
    identifySavedText: 'Os validadores exigirão {value} ao identificar entre todos os funcionários.',
  },
  sections: {
    face: {
      title: 'Requisitos do rosto',
      hint: 'O que a pessoa deve retirar antes da leitura do rosto. Cobrir o rosto reduz a precisão.',
    },
    security: {
      title: 'Segurança',
      hint: 'Proteções contra fraude de identidade; convém mantê-las ativas.',
    },
    locks: {
      title: 'Travas contra fraude de identidade',
      hint: 'Cada trava bloqueia uma forma diferente de enganar o reconhecimento facial; convém manter todas ativas.',
    },
    learning: {
      title: 'Aprendizado contínuo',
      hint: 'Cada identificação segura ensina como cada funcionário está hoje. As amostras que a empresa validou nunca são substituídas.',
    },
    location: {
      title: 'Localização da presença',
      hint: 'Cada registro de presença leva a localização do celular e a hora do servidor; ajuste abaixo a precisão e a velocidade.',
    },
    methods: {
      title: 'Métodos de identificação',
      hint: 'Formas como os funcionários podem se identificar.',
    },
    antifraud: {
      title: 'Antifraude',
      hint: 'Na dúvida, o mecanismo exige uma etapa a mais ou deixa o registro em revisão da empresa. As evidências das tentativas suspeitas só o administrador vê, em “Casos de fraude”.',
    },
    capture: {
      title: 'Protocolo de captura',
      hint: 'Provas em tempo real contra vídeos injetados. Por enquanto só medem.',
    },
    devices: {
      title: 'Dispositivos dos validadores',
      hint: 'Só os validadores têm restrições; funcionários e administradores usam qualquer dispositivo.',
    },
  },
  accessories: {
    remove: 'Retirar {phrase}',
    blockGlasses: {
      on: 'Será pedido para tirar os óculos (inclusive os de sol).',
      off: 'É permitido se identificar de óculos.',
    },
    blockHeadwear: {
      on: 'Será pedido para tirar bonés, chapéus e viseiras (exceto funcionários dispensados por motivos religiosos ou médicos).',
      off: 'É permitido se identificar com algo na cabeça.',
    },
    blockMask: {
      on: 'Será pedido para tirar a máscara (verificação física do nariz e das bochechas).',
      off: 'É permitido se identificar de máscara (menor precisão).',
    },
  },
  options: {
    livenessChallenge: {
      label: 'Prova de vida',
      on: 'A pessoa faz movimentos aleatórios com a cabeça.',
      off: 'Sem desafio de movimentos.',
    },
    antiSpoofing: {
      label: 'Detecção de fraude de identidade',
      on: 'Detecta fotos impressas, telas e vídeos diante da câmera.',
      off: 'Fotos e telas não são analisadas.',
    },
    blockVirtualCameras: {
      label: 'Bloquear câmeras virtuais',
      on: 'São rejeitados programas que se passam por câmera (OBS, ManyCam…).',
      off: 'Qualquer câmera é aceita, inclusive as virtuais.',
    },
    rejectForeignImages: {
      label: 'Só capturas ao vivo',
      on: 'São rejeitadas imagens da galeria ou editadas.',
      off: 'São aceitas imagens da galeria ou editadas.',
    },
    detectStaticCaptures: {
      label: 'Detectar fotos estáticas',
      on: 'Uma tentativa é rejeitada se as capturas forem idênticas (uma foto enviada várias vezes).',
      off: 'As capturas não são comparadas entre si.',
    },
    detectReplays: {
      label: 'Detectar capturas reutilizadas',
      on: 'Cada captura vale uma única vez: reenviar capturas guardadas ou interceptadas é rejeitado.',
      off: 'As capturas recebidas não são lembradas.',
    },
    checkCaptureContinuity: {
      label: 'Exigir uma única tomada',
      on: 'Todas as capturas devem vir da mesma câmera, com o rosto e a luz contínuos ao girar.',
      off: 'Não se compara a câmera, o enquadramento nem a luz entre as capturas.',
    },
    enforceHumanTiming: {
      label: 'Tempo humano na prova de vida',
      on: 'São rejeitadas respostas ao desafio mais rápidas do que uma pessoa consegue (programas automáticos).',
      off: 'Não se mede quanto tempo leva a resposta ao desafio.',
    },
    detectDuplicateFaces: {
      label: 'Detectar rostos duplicados',
      on: 'Ao cadastrar um rosto já aprovado para outro funcionário: é marcado para revisão ou, presencialmente, bloqueado.',
      off: 'O cadastro não é comparado com os demais funcionários.',
    },
    lockoutEnabled: {
      label: 'Bloqueio por tentativas malsucedidas',
      on: 'Após várias tentativas malsucedidas ou suspeitas seguidas, é bloqueado temporariamente (ajuste abaixo).',
      off: 'É possível tentar sem limite (só o limite geral de requisições).',
    },
    adaptiveLearning: {
      label: 'Aprender com cada identificação segura',
      on: 'Aprende só com identificações com prova de vida e confiança folgada (outra luz, câmera, penteado ou barba).',
      off: 'Cada funcionário é comparado só com as amostras do cadastro aprovado.',
    },
    detectImpossibleTravel: {
      label: 'Detectar deslocamentos impossíveis',
      on: 'É rejeitado um registro longe demais do anterior para o tempo decorrido (localização falsa ou conta compartilhada).',
      off: 'A localização de um registro não é comparada com a do anterior.',
    },
    qrEnabled: {
      label: 'Verificação com código QR',
      on: 'Os funcionários mostram no celular um QR dinâmico: muda sozinho e cada código vale uma única vez.',
      off: 'Só reconhecimento facial.',
    },
    validatorDeviceApproval: {
      label: 'Autorizar dispositivos de validadores',
      on: 'Cada tablete ou celular de um validador fica aguardando autorização em Validadores › Dispositivos.',
      off: 'Os validadores podem entrar em qualquer dispositivo com o e-mail e a senha.',
    },
    qrOnlyAttendance: {
      label: 'Presença só com o QR',
      on: 'Um validador no modo QR registra a entrada e a saída com o código, sem rosto.',
      off: 'Com o QR só se identifica; para registrar a presença é preciso o rosto.',
    },
    riskEngine: {
      label: 'Mecanismo de risco',
      on: 'Cada tentativa é avaliada com os sinais dela e decidida conforme o nível de risco (ajuste abaixo).',
      off: 'Só as travas decidem; os sinais não se somam.',
    },
    flashPaced: {
      label: 'Flash ditado pelo servidor',
      on: 'Cada cor é revelada no momento: ninguém consegue preparar as capturas.',
      off: 'As cores são enviadas com o desafio.',
    },
    captureBurst: {
      label: 'Sequência de recortes do rosto',
      on: 'São enviados alguns segundos de recortes para medir o movimento natural e a continuidade.',
      off: 'Só são enviadas as capturas avulsas.',
    },
    fraudEvidence: {
      label: 'Guardar evidências das tentativas suspeitas',
      on: 'São guardados alguns quadros criptografados de cada tentativa suspeita para revisar o caso; são apagados automaticamente ao vencer.',
      off: 'Os casos são abertos sem quadros: só com o que foi medido.',
    },
    voiceVerification: {
      label: 'Verificação por voz e vídeo no cadastro',
      on: 'Depois das fotos, o funcionário responde em vídeo três perguntas sobre seus dados; a voz e o rosto são comparados no servidor e a empresa revisa o vídeo.',
      off: 'O cadastro termina com as fotos.',
    },
    voiceGuidance: {
      label: 'Orientação por voz',
      on: 'As instruções do cadastro são lidas em voz alta no dispositivo.',
      off: 'O cadastro não lê as instruções em voz alta.',
    },
    validatorMobileOnly: {
      label: 'Validadores só em tablete ou celular',
      on: 'Os validadores só entram em tabletes e celulares.',
      off: 'Os validadores também podem operar em um computador com câmera.',
    },
  },
  warnings: {
    spoofing: 'Isso reduz a proteção contra fraude de identidade (fotos, telas ou vídeos).',
    impossibleTravel: 'Um registro com localização falsa ou feito de outro lugar não será detectado pela distância.',
    deviceApproval: 'Qualquer pessoa com o e-mail e a senha de um validador poderá operar a partir de qualquer dispositivo.',
    mobileOnly: 'Os validadores poderão operar em computadores, cuja câmera costuma ser mais fácil de enganar com fotos ou telas.',
    qrOnly: 'Quem tiver o celular de outro funcionário poderá registrar a presença dele sem mostrar o rosto.',
    riskEngine: 'Os sinais deixarão de se somar: uma tentativa com vários indícios de fraude passará se nenhuma trava a detiver sozinha.',
    captureProtocol: 'Um vídeo preparado com antecedência será mais difícil de detectar.',
    voiceVerification: 'Um cadastro com fotos de outra pessoa não terá mais a segunda verificação de voz e rosto em vídeo.',
  },
  toggle: {
    eyebrow: 'Política de verificação',
    eyebrowSecurity: 'Proteção recomendada',
    activateTitle: 'Ativar “{label}”?',
    deactivateTitle: 'Desativar “{label}”?',
    on: 'Ativado',
    off: 'Desativado',
    activate: 'Ativar',
    deactivate: 'Desativar',
    activated: '{label}: ativado',
    deactivated: '{label}: desativado',
  },
  voice: {
    title: 'Orientação por voz',
    hint: 'Lê em voz alta as instruções do cadastro facial, com a síntese do próprio dispositivo.',
    profile: {
      label: 'Voz da orientação',
      description: 'Voz com que as instruções são lidas durante o cadastro.',
      saved: 'Voz da orientação atualizada',
      savedText: 'As instruções serão lidas com a voz “{name}”.',
      confirmTitle: 'Usar a voz “{value}”?',
      confirmLabel: 'Salvar voz',
    },
    preview: 'Testar voz',
  },
  tuning,
  ...antifraud,
} satisfies Translation<typeof es>;
