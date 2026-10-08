import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/layout';

/** Textos de menú lateral, menú del teléfono y marco de la aplicación en francés (fr-FR): las mismas llaves que es-MX. */
export default {
  workspace: {
    verifiedIdentity: 'Identité vérifiée',
    platform: 'Console de la plateforme',
  },
  sidebar: 'Navigation principale',
  menu: {
    label: 'Menu',
    open: 'Ouvrir le menu',
    close: 'Fermer le menu',
    expand: 'Déplier le menu',
    collapse: 'Replier le menu',
    withShortcut: '{action} (Ctrl/⌘ + B)',
    preferenceFailed: "Impossible d'enregistrer la préférence du menu",
  },
  home: 'Accueil',
} satisfies Translation<typeof es>;
