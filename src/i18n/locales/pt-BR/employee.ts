import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/employee';

/** Textos de pantallas del empleado (verificación, registro facial, mi QR) en portugués de Brasil (pt-BR): las mismas llaves que es-MX. */
export default {
  menu: {
    eyebrow: 'Identificação',
    hello: 'Olá, {name}',
    helloAnonymous: 'Olá',
    question: 'Como você deseja se identificar?',
    face: 'VERIFICAR COM O ROSTO',
    faceLiveness: 'Reconhecimento facial com prova de vida',
    faceOnly: 'Reconhecimento facial',
    start: 'Começar',
    qr: 'MOSTRAR MEU QR',
    qrText: 'Mostre ao validador: muda a cada {seconds} s e vale uma única vez',
    show: 'Mostrar',
    footer: 'Identidade validada pela sua empresa · Conexão protegida',
  },
  verify: {
    title: 'Verificação facial',
    submitting: 'Verificando sua identidade…',
    failed: 'Não foi possível verificar sua identidade',
    showQr: 'Mostrar meu código QR',
  },
  enrollment: {
    title: 'Cadastro facial',
    tips: {
      light: 'Fique em um lugar bem iluminado.',
      front: 'Olhe de frente para a câmera, com o rosto descoberto.',
    },
    rejected: {
      title: 'Seu cadastro anterior foi rejeitado',
      reason: 'Motivo: “{reason}”.',
      noReason: 'Sua empresa não conseguiu validar sua identidade com as capturas enviadas.',
    },
    reverify: {
      title: 'Verifique sua identidade novamente',
      eyebrow: 'Solicitação da sua empresa',
      step: 'Cadastre seu rosto com prova de vida; leva cerca de um minuto.',
    },
    confirm: {
      replaces: 'Seu cadastro anterior será substituído por este.',
      replacesPhoto: 'Sua foto inicial anterior será substituída por esta.',
      open: 'Abrir câmera',
      photo: {
        title: 'Tirar sua foto inicial?',
        message: 'A câmera será aberta para tirar uma foto do seu rosto de frente. Ela é guardada criptografada para o seu cadastro.',
      },
      captures: {
        title: 'Iniciar as capturas?',
        message: 'A câmera será aberta para fazer {count} capturas do seu rosto e a prova de vida.',
      },
      video: {
        title: 'Gravar o vídeo?',
        message_one: 'A câmera e o microfone serão abertos para você responder {count} pergunta em vídeo.',
        message_other: 'A câmera e o microfone serão abertos para você responder {count} perguntas em vídeo.',
      },
    },
    submitting: 'Enviando seu cadastro…',
    sent: {
      title: 'Cadastro enviado',
      text: 'Sua empresa validará sua identidade em breve.',
      offline: 'Sua empresa validará sua identidade em breve. A tela será atualizada quando a conexão voltar.',
    },
    fatal: 'Não foi possível concluir o cadastro',
    again: 'Cadastre seu rosto novamente',
    welcome: 'Boas-vindas, {name}',
    intro: 'Para proteger sua identidade, cadastre seu rosto. Isso é feito uma única vez e sua empresa o validará.',
    after: {
      title: 'Depois: validação da sua empresa',
      text: 'Sua empresa revisa e aprova sua identidade; você verá o resultado no aplicativo.',
    },
    before: 'Antes de começar:',
    privacy: 'Suas fotos, seu vídeo e sua voz são guardados criptografados e só sua empresa os revisa; nunca são compartilhados.',
    /** El indicador sobre el visor: los pasos los manda el servidor y su nombre sale del catálogo; «Listo» es el final. */
    steps: {
      label: 'Passo {current} de {total}',
      done: 'Pronto',
    },
    /** Mientras se guarda la foto inicial. */
    photoSaving: 'Salvando sua foto…',
    /** El índice del registro: estado, aviso y botón de cada paso (su nombre y descripción, del catálogo). */
    index: {
      steps_one: '{count} etapa',
      steps_other: '{count} etapas',
      resume: 'Faça as etapas em ordem. Você pode sair depois de qualquer uma e continuar outro dia: o que você fez fica salvo.',
      errorTitle: 'Não foi possível carregar seu cadastro',
      label: 'Etapas do seu cadastro',
      state: {
        pending: 'Pendente',
        done: 'Concluída · {date}',
        complete: 'Concluída',
        locked: 'Bloqueada',
        expired: 'Vencida',
        exhausted: 'Tentativas esgotadas',
        answered: '{answered} de {total} respondidas',
      },
      hint: {
        /** `step`: el nombre del paso que falta, del catálogo. */
        blocked: 'Primeiro conclua “{step}”.',
        validUntil: 'Válida até {date}',
        expired: 'Sua foto venceu. Tire outra.',
        exhausted: 'As tentativas se esgotaram. Repita a foto inicial e as capturas.',
        unknown: 'Atualize o aplicativo para continuar esta etapa.',
      },
      action: {
        photo: 'Tirar foto',
        retakePhoto: 'Repetir foto',
        captures: 'Iniciar capturas',
        video: 'Gravar vídeo',
        resumeVideo: 'Continuar vídeo',
        document: 'Enviar documento',
        replaceDocument: 'Substituir documento',
      },
    },
    /** La pantalla de un paso que ahora no se puede abrir: qué pasa (su vacío) y de vuelta al índice. */
    blocked: {
      back: 'Voltar ao cadastro',
      blocked: {
        title: 'Falta uma etapa antes',
        text: 'Conclua “{step}” para continuar esta etapa.',
      },
      done: {
        title: 'Etapa concluída',
        text: 'Já está pronta. Continue com a próxima etapa.',
      },
      disabled: {
        title: 'Etapa não solicitada',
        text: 'Sua empresa não pede esta etapa do seu cadastro.',
      },
      exhausted: {
        title: 'Tentativas esgotadas',
        text: 'Repita a foto inicial e as capturas para tentar de novo.',
      },
      unknown: {
        title: 'Etapa indisponível',
        text: 'Atualize o aplicativo para continuar esta etapa.',
      },
    },
    /** Un 409 del servidor: el paso ya no toca (lo bloquea otro o la empresa dejó de pedirlo). */
    stepGone: 'Esta etapa não está mais disponível',
    /** Un paso que se cumple con un documento de identidad: cómo va. */
    document: {
      pending: 'Falta enviar seu documento.',
      done: 'Documento recebido · {date}',
      doneNoDate: 'Documento recebido.',
    },
  },
  myQr: {
    errorTitle: 'Não foi possível gerar seu código QR',
    alt: 'Código QR de {name}',
    eyebrow: 'Crachá digital',
    title: 'Meu código QR',
    intro: 'Mostre ao validador para se identificar. Muda a cada {seconds} s e vale uma única vez.',
    validated: 'Identidade validada',
    employeeNumber: 'Matrícula {number}',
    enlarge: 'Mostrar em tela cheia',
    another: 'Gerar outro',
    brightness: 'Aumente o brilho da tela para que a leitura seja mais rápida.',
    singleUse: 'Cada código vale uma única vez e vence em segundos: uma foto ou captura de tela não funciona. Não contém seus dados pessoais nem biométricos.',
    brightnessLarge: 'Aumente o brilho para que a leitura seja instantânea.',
    unavailable: {
      qrTitle: 'QR indisponível',
      faceTitle: 'Cadastro facial pendente',
    },
  },
  pending: {
    errorTitle: 'Não foi possível atualizar a situação',
    title: 'Sua identidade está em validação',
    text: '{name}, seu cadastro facial foi enviado. Um administrador da sua empresa vai revisá-lo; aqui você verá quando for aprovado.',
    sent: {
      title: 'Cadastro facial enviado',
      text: 'Rosto, prova de vida e qualidade verificados.',
    },
    review: {
      title: 'Validação pela sua empresa',
      text: 'Um administrador confirma que é você.',
    },
    access: {
      title: 'Acesso liberado',
      text: 'Você poderá se identificar com o rosto ou o código QR.',
    },
    refresh: 'Atualizar situação',
    auto: 'Esta tela é atualizada automaticamente.',
  },
} satisfies Translation<typeof es>;
