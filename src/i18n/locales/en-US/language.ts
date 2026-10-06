import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/language';

/** Textos del selector de idioma en inglés (en-US). */
export default {
  label: 'Language',
  names: {
    'es-MX': 'Spanish (Mexico)',
    'en-US': 'English (United States)',
  },
  hintAccount: 'Applies on all your devices.',
  hintDevice: 'Remembered on this device.',
  saveFailed: "Couldn't save your language",
  loadFailed: "Couldn't change the language",
} satisfies Translation<typeof es>;
