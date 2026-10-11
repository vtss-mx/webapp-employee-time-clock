import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/location';

/** Textos de domicilios, mapas, búsqueda de lugares y ubicación en portugués de Brasil (pt-BR): las mismas llaves que es-MX. */
export default {
  eyebrow: 'Localização',
  problems: {
    unsupported: {
      title: 'Localização indisponível',
      text: 'Este navegador não permite ler a localização. Use o Safari ou o Chrome atualizados.',
    },
    insecure: {
      title: 'Conexão não segura',
      text: 'A localização só pode ser lida por uma conexão segura (https). Abra o aplicativo pelo endereço seguro.',
    },
    denied: {
      title: 'Permita o acesso à sua localização',
      text: 'A permissão de localização está bloqueada neste navegador.',
    },
    unavailable: {
      title: 'Não foi possível obter sua localização',
      text: 'Ative a localização (GPS) e tente novamente, de preferência perto de uma janela.',
    },
    timeout: {
      title: 'A localização demorou demais',
      text: 'Ative a localização precisa do dispositivo e tente novamente.',
    },
  },
  permissionSteps: {
    iphone: 'iPhone: Ajustes › Privacidade e Segurança › Serviços de Localização › Safari (ou seu navegador) › permita o acesso durante o uso do aplicativo.',
    android: 'Android: toque no cadeado ao lado do endereço › Permissões › Localização › Permitir.',
  },
  deniedFor: {
    login: {
      text: 'Este validador só pode entrar no local onde opera e a permissão de localização está bloqueada.',
      next: 'Volte ao aplicativo e entre novamente.',
    },
    map: {
      text: 'Para localizar você no mapa é preciso a permissão de localização, e ela está bloqueada neste navegador.',
      next: 'Toque de novo em “Minha localização” (ou marque o ponto no mapa).',
    },
    checkpoint: {
      text: 'Este validador envia a localização em cada identificação e a permissão está bloqueada neste navegador.',
      next: 'Abra o ponto de controle novamente.',
    },
    verification: {
      text: 'Esta verificação precisa da sua localização e a permissão está bloqueada neste navegador.',
      next: 'Volte aqui e toque em “Tentar novamente”.',
    },
  },
  server: {
    outOfRange: 'Você está fora do local permitido',
    inaccurate: 'Sua localização não é precisa',
    required: 'É preciso sua localização',
    approach: 'Aproxime-se do acesso onde este validador opera.',
    gps: 'Ative a localização precisa (GPS) do dispositivo.',
    signInAgain: 'Entre novamente.',
  },
  address: {
    country: {
      label: 'País',
      hint: 'País onde fica o endereço.',
      placeholder: 'Escolha o país',
      search: 'Pesquisar país',
      empty: 'Nenhum país corresponde',
    },
    state: { label: 'Estado ou província', hint: 'Unidade federativa ou região.' },
    municipality: { label: 'Município ou distrito', hint: 'Divisão administrativa à qual pertence.' },
    city: { label: 'Cidade ou localidade', hint: 'Cidade, vila ou localidade; pode ter um nome diferente do município.' },
    neighborhood: { label: 'Bairro', hint: 'Zona ou povoado dentro da localidade.' },
    postalCode: { label: 'Código postal', hint: 'Código da zona postal.' },
    street: { label: 'Rua ou via', hint: 'Nome da rua, avenida, rodovia etc.' },
    exteriorNumber: { label: 'Número', hint: 'Número que identifica o imóvel; pode conter letras.' },
    interiorNumber: { label: 'Complemento', hint: 'Apartamento, sala ou loja dentro do imóvel. É opcional.' },
    referenceNotes: {
      label: 'Referências',
      hint: 'Indicações adicionais para localizá-lo, como ruas transversais ou pontos próximos. São opcionais.',
      placeholder: 'Entre a Juárez e a Morelos, em frente à praça',
    },
    interior: 'Complemento {number}',
    required: {
      country: 'Escolha o país',
      state: 'Informe o estado ou província',
      municipality: 'Informe o município ou distrito',
      city: 'Informe a cidade ou localidade',
      neighborhood: 'Informe o bairro',
      postalCode: 'Informe o código postal',
      street: 'Informe a rua',
      exteriorNumber: 'Informe o número (ou S/N)',
    },
    postalCodeMx: 'O código postal do México tem 5 dígitos',
    postalCodeInvalid: 'O código postal não é válido',
    minLength: 'Digite pelo menos {min} caracteres',
    maxLength: 'Máximo de {max} caracteres',
  },
  picker: {
    notices: {
      geocoding: 'Não foi possível completar o endereço pelo mapa. Digite-o manualmente; o ponto ficou marcado.',
      geolocation: 'Não foi possível obter sua localização. Marque o ponto no mapa.',
      places: 'A pesquisa de lugares não está disponível. Digite o endereço e marque o ponto no mapa.',
      maps: 'O mapa não está disponível. Digite o endereço manualmente.',
      offline: 'O Google Maps não respondeu. Verifique sua conexão e tente novamente.',
      notFound: 'O endereço não foi encontrado. Revise o endereço ou marque o ponto no mapa.',
    },
    locateError: 'Não foi possível localizar o ponto',
    notConfigured: 'O mapa não está configurado: o endereço é informado manualmente e não é possível exigir localização.',
    myLocation: 'Minha localização',
    point: 'Ponto: {point}',
    tapToMark: {
      access: 'Toque no mapa para marcar o ponto do acesso',
      site: 'Toque no mapa para marcar o ponto do local',
    },
    findingAddress: 'buscando o endereço…',
    locateWritten: 'Localizar o endereço digitado',
    removePoint: 'Remover ponto',
  },
  map: {
    label: 'Mapa: toque para marcar o ponto',
    pin: 'Ponto marcado',
    loading: 'Carregando o mapa…',
    failed: 'O mapa não está disponível. Digite o endereço manualmente.',
  },
  search: {
    label: 'Pesquisar um lugar ou um endereço',
    clear: 'Limpar pesquisa',
    results: 'Lugares encontrados',
    credit: 'Resultados do Google',
    creditNearest: 'Os mais próximos primeiro · Resultados do Google',
    failed: {
      title: 'Não foi possível pesquisar',
      hint: 'Verifique sua conexão ou marque o ponto no mapa.',
    },
    unavailable: {
      title: 'Sem resultados',
      hint: 'Digite o endereço e marque o ponto no mapa.',
    },
    none: {
      title: 'Sem resultados',
      hint: 'Tente outro endereço ou marque o ponto no mapa.',
    },
  },
} satisfies Translation<typeof es>;
