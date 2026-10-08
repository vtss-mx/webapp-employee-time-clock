import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/system';

/** Textos de pantallas del sistema: errores de la app, sin permiso, no encontrada, versión nueva, sin conexión en portugués de Brasil (pt-BR): las mismas llaves que es-MX. */
export default {
  goHome: 'Ir para o início',
  loadError: {
    badge: 'Erro ao carregar',
    title: 'Não foi possível carregar as informações',
    message: 'Verifique sua conexão e tente novamente. Se continuar, avise o administrador da sua empresa.',
  },
  crash: {
    title: 'Erro nesta tela',
    message: 'Seus dados estão seguros. Tente novamente.',
  },
  unexpected: {
    title: 'Ocorreu um problema',
    text: 'Tente novamente. Se continuar, recarregue a página.',
  },
  newVersion: {
    eyebrow: 'Atualização',
    title: 'Nova versão disponível',
    text: 'Atualize para usar as melhorias mais recentes.',
    later: 'Mais tarde',
    reload: 'Atualizar agora',
  },
  offline: 'Sem conexão. Tentando reconectar automaticamente.',
  forbidden: {
    title: 'Acesso negado',
    text: 'Você não tem permissão para ver esta seção.',
  },
  notFound: {
    title: 'Página não encontrada',
    text: 'Esta página não existe ou mudou de lugar.',
  },
} satisfies Translation<typeof es>;
