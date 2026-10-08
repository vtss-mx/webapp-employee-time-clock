import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/layout';

/** Textos de menú lateral, menú del teléfono y marco de la aplicación en italiano (it-IT): las mismas llaves que es-MX. */
export default {
  workspace: {
    verifiedIdentity: 'Identità verificata',
    platform: 'Console della piattaforma',
  },
  sidebar: 'Navigazione principale',
  menu: {
    label: 'Menu',
    open: 'Apri il menu',
    close: 'Chiudi il menu',
    expand: 'Espandi il menu',
    collapse: 'Comprimi il menu',
    withShortcut: '{action} (Ctrl/⌘ + B)',
    preferenceFailed: 'Impossibile salvare la preferenza del menu',
  },
  home: 'Pagina iniziale',
} satisfies Translation<typeof es>;
