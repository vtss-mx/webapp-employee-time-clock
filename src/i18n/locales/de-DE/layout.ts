import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/layout';

/** Textos de menú lateral, menú del teléfono y marco de la aplicación en alemán (de-DE): las mismas llaves que es-MX. */
export default {
  workspace: {
    verifiedIdentity: 'Verifizierte Identität',
    platform: 'Plattform-Konsole',
  },
  sidebar: 'Hauptnavigation',
  menu: {
    label: 'Menü',
    open: 'Menü öffnen',
    close: 'Menü schließen',
    expand: 'Menü ausklappen',
    collapse: 'Menü einklappen',
    /** En alemán la tecla Ctrl se llama «Strg». */
    withShortcut: '{action} (Strg/⌘ + B)',
    preferenceFailed: 'Die Menüeinstellung konnte nicht gespeichert werden',
  },
  home: 'Startseite',
} satisfies Translation<typeof es>;
