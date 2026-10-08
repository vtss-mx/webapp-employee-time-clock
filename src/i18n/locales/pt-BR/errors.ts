import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/errors';

/** Textos de los errores que arma el cliente en portugués de Brasil (pt-BR). */
export default {
  status: {
    network: 'Não foi possível conectar ao servidor. Verifique sua conexão.',
    ok: 'Pronto',
    badRequest: 'Solicitação inválida',
    unauthorized: 'Sua sessão não é válida. Entre novamente.',
    forbidden: 'Você não tem permissão para esta ação',
    notFound: 'Não encontrado',
    methodNotAllowed: 'Ação não permitida',
    timeout: 'O servidor não respondeu a tempo. Tente novamente.',
    conflict: 'Conflito com dados existentes',
    payloadTooLarge: 'O arquivo é grande demais',
    unsupportedMedia: 'Formato não compatível',
    unprocessable: 'Dados inválidos',
    rateLimited: 'Muitas tentativas. Aguarde alguns segundos.',
    server: 'Ocorreu um erro inesperado. Tente novamente.',
    unavailable: 'Serviço indisponível. Tente novamente em alguns segundos.',
  },
  invalidResponse: 'Resposta inesperada do servidor. Tente novamente.',
  unexpected: 'Ocorreu um erro inesperado',
  unexpectedRetry: 'Ocorreu um erro inesperado. Tente novamente.',
  titles: {
    network: 'Sem conexão com o servidor',
    unauthorized: 'Não foi possível validar seu acesso',
    forbidden: 'Ação não permitida',
    notFound: 'Não encontrado',
    timeout: 'Sem resposta do servidor',
    conflict: 'As informações já existem',
    payloadTooLarge: 'O arquivo é grande demais',
    unprocessable: 'Revise os dados',
    rateLimited: 'Muitas tentativas',
    server: 'Erro do servidor',
    failed: 'Não foi possível concluir',
    generic: 'Ocorreu um problema',
  },
} satisfies Translation<typeof es>;
