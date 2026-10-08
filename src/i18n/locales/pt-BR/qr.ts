import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/qr';

/** Textos de QR dinámico del empleado y lector de QR en portugués de Brasil (pt-BR): las mismas llaves que es-MX. */
export default {
  dynamic: {
    used: {
      title: 'Código usado',
      text: 'Gerando um novo…',
    },
    replaced: {
      title: 'Código substituído',
      text: 'Outro foi gerado em outro dispositivo ou sua empresa o invalidou.',
      action: 'Mostrar um código novo',
    },
    paused: {
      title: 'Em pausa',
      text: 'Expirou enquanto você não o via.',
      action: 'Mostrar código',
    },
    error: 'Não foi possível gerar seu código',
    imageError: 'Não foi possível mostrar seu código QR',
    enlarge: 'Ampliar código QR',
    renewsIn: 'Renova em {seconds}',
    seconds: '{value} s',
  },
  scan: {
    aim: 'Aponte a câmera para o código QR',
    busy: 'QR detectado. Verificando…',
    invalid: 'QR inválido. Use o código gerado para sua conta',
    noPersonalData: 'O código não contém dados pessoais.',
  },
  panel: {
    title: 'Código QR dinâmico',
    errorTitle: 'Não foi possível carregar a atividade do QR',
    live: 'Na tela',
    none: 'Sem código vigente',
    intro: 'O funcionário o gera no celular (Meu código QR). Muda a cada {seconds} s e vale uma única vez: não pode ser baixado nem impresso.',
    liveUntil: 'Vigente até',
    lastIssued: 'Último gerado',
    lastUsed: 'Último uso',
    never: 'Nunca',
    revoke: {
      action: 'Invalidar código vigente',
      eyebrow: 'Código QR',
      title: 'Invalidar o código vigente?',
      message: 'O código na tela do funcionário deixará de funcionar imediatamente. Ele poderá mostrar um novo no celular.',
      confirm: 'Invalidar',
      error: 'Não foi possível invalidar o código',
      done: 'Código invalidado',
      doneText: 'O funcionário pode mostrar um novo no celular.',
    },
  },
  phoneGuide: {
    open: 'Abra o tablete ou o celular.',
    openHow: 'Use o navegador (Safari, Chrome…) ou a câmera.',
    scanOrType: '{scan} ou digite este endereço:',
    scanCode: 'Leia o código',
    copyAddress: 'Copiar endereço',
    enterAddress: '{address} que sua empresa forneceu.',
    accessAddress: 'Abra o endereço de acesso',
    signIn: '{action} com o mesmo e-mail e senha.',
    signInAction: 'Entre',
    scan: 'Leia com o tablete ou o celular',
    qrAlt: 'Código QR para abrir o aplicativo. Leia com o tablete ou o celular',
    desktopSite: 'Já está em um tablete ou celular? Desative {option} no menu do navegador e tente novamente.',
    desktopSiteOption: '“Site para computador”',
  },
} satisfies Translation<typeof es>;
