import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/layout';

/** Textos de menú lateral, menú del teléfono y marco de la aplicación en portugués de Brasil (pt-BR): las mismas llaves que es-MX. */
export default {
  workspace: {
    verifiedIdentity: 'Identidade verificada',
    platform: 'Console da plataforma',
  },
  sidebar: 'Navegação principal',
  menu: {
    label: 'Menu',
    open: 'Abrir menu',
    close: 'Fechar menu',
    expand: 'Expandir menu',
    collapse: 'Recolher menu',
    withShortcut: '{action} (Ctrl/⌘ + B)',
    preferenceFailed: 'Não foi possível salvar a preferência do menu',
  },
  home: 'Início',
} satisfies Translation<typeof es>;
