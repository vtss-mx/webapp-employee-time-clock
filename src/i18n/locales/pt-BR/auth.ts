import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/auth';

/** Textos de inicio de sesión, cuenta recordada, dispositivo, empresa suspendida y cierre de sesión en portugués de Brasil (pt-BR): las mismas llaves que es-MX. */
export default {
  layout: {
    copyright: '© {year} {app}. Todos os direitos reservados.',
  },
  login: {
    title: 'Entrar',
    emailPlaceholder: 'voce@empresa.com',
    password: 'Senha',
    passwordRequired: 'A senha é obrigatória',
    remembered: 'Conta lembrada neste dispositivo.',
    useOtherAccount: 'Usar outra conta',
    remember: 'Lembrar minha conta',
    rememberHint: 'Mantenha a sessão aberta neste dispositivo. Não use em computadores compartilhados.',
    submit: 'Entrar',
    submitDisabled: 'Digite seu e-mail e sua senha',
    locating: 'Verificando sua localização…',
    failed: 'Não foi possível entrar',
    switchFailed: 'Não foi possível trocar de conta',
    sessionEnded: 'Sua sessão terminou',
  },
  session: {
    expired: 'Sua sessão expirou. Entre novamente.',
  },
  password: {
    new: 'Nova senha',
    hint: 'Mínimo de 8 caracteres, com letra maiúscula, letra minúscula e número',
  },
  device: {
    eyebrow: 'Dispositivo',
    unsupported: 'Não foi possível registrar o dispositivo',
    titles: {
      DEVICE_PENDING_APPROVAL: 'Dispositivo aguardando autorização',
      DEVICE_REJECTED: 'Dispositivo não autorizado',
      DEVICE_REVOKED: 'Autorização retirada',
      DEVICE_PROOF_INVALID: 'Não foi possível verificar o dispositivo',
    },
    pendingSteps: {
      ask: 'Peça a um administrador da sua empresa que acesse Validadores › Dispositivos.',
      authorize: 'Que ele autorize este dispositivo (aparece com o nome deste navegador).',
      retry: 'Entre novamente aqui mesmo.',
    },
  },
  deviceBlock: {
    eyebrow: 'Você está usando um computador',
    title: 'Continue em um tablete ou celular',
    footnote: 'Precisa de ajuda? Fale com o administrador da sua empresa.',
  },
  suspension: {
    badge: 'Acesso suspenso',
    title: 'Sua empresa está suspensa',
    footnote: 'Para reativá-la, fale com o administrador da plataforma.',
    exit: 'Voltar para a entrada',
  },
  logout: {
    title: 'Sair?',
    thisDevice: 'Este dispositivo',
    lastLogin: 'Último acesso',
    stay: 'Continuar aqui',
    everywhere: 'Sair de todos os meus dispositivos',
    everywhereFailed: 'Não foi possível sair de todos os dispositivos',
    consequence: {
      EMPLOYEE: 'Você precisará entrar novamente para se identificar ou mostrar seu código QR.',
      VALIDATOR: 'Este ponto de controle deixará de identificar a equipe até que alguém entre novamente neste dispositivo.',
      COMPANY: 'Seu trabalho está salvo. Você precisará entrar novamente para administrar sua empresa.',
      ADMIN: 'Seu trabalho está salvo. Você precisará entrar novamente para administrar a plataforma.',
    },
  },
  companySelect: {
    title: 'Escolha sua empresa',
    intro_one: 'Você trabalha em {count} empresa com a conta {email}.',
    intro_other: 'Você trabalha em {count} empresas com a conta {email}.',
    companyInactive: 'Empresa desativada',
    accessInactive: 'Seu acesso está desativado',
    current: 'Empresa atual · {note}',
    entering: 'Entrando',
    enterFailed: 'Não foi possível entrar em {company}',
  },
} satisfies Translation<typeof es>;
