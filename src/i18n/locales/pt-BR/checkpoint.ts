import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/checkpoint';

/** Textos de punto de control del validador en portugués de Brasil (pt-BR): las mismas llaves que es-MX. */
export default {
  errorTitle: 'Não foi possível carregar o ponto de controle',
  question: 'Escolha como identificar a próxima pessoa.',
  start: 'Começar',
  footer: 'Só são identificados funcionários ativos de {company} · Cada tentativa fica registrada no histórico',
  notIdentified: 'Funcionário não identificado',
  failed: 'Não foi possível identificar',
  invalidQr: 'QR inválido. Peça ao funcionário que mostre o código pelo aplicativo',
  qrDisabled: {
    title: 'Identificação por QR desativada',
    text: 'Este validador usa o modo “{mode}”, mas sua empresa desativou o QR. Peça a um administrador que o ative ou troque o modo.',
  },
  face: {
    title: 'Reconhecer rosto',
    submitting: 'Identificando…',
    useQr: 'Usar o código QR',
  },
  qr: {
    title: 'Ler QR',
    text: 'Aponte a câmera para o QR no celular do funcionário. A leitura é automática e o código vale uma única vez.',
    busy: 'QR detectado. Identificando…',
  },
  qrFace: {
    qrTitle: 'Etapa 1 de 2 · Código QR',
    qrText: 'Leia o QR no celular do funcionário. Depois o rosto será confirmado.',
    busy: 'QR detectado. Procurando o funcionário…',
    faceTitle: 'Etapa 2 de 2 · {name}',
  },
  recent: {
    title: 'Últimas identificações',
    errorTitle: 'Não foi possível carregar as identificações recentes',
    emptyTitle: 'Sem identificações',
    emptyDescription: 'Aqui você verá quem este dispositivo identifica.',
    nounOne: 'identificação',
    nounOther: 'identificações',
    identified: 'Identificado',
    notIdentified: 'Não identificado',
  },
} satisfies Translation<typeof es>;
