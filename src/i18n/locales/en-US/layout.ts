import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/layout';

/** Textos de menú lateral, menú del teléfono y marco de la aplicación en inglés (en-US): las mismas llaves que es-MX. */
export default {
  workspace: {
    verifiedIdentity: 'Verified identity',
    platform: 'Platform console',
  },
  sidebar: 'Main navigation',
  menu: {
    label: 'Menu',
    open: 'Open menu',
    close: 'Close menu',
    expand: 'Expand menu',
    collapse: 'Collapse menu',
    withShortcut: '{action} (Ctrl/⌘ + B)',
    preferenceFailed: "Couldn't save the menu preference",
  },
  home: 'Home',
} satisfies Translation<typeof es>;
