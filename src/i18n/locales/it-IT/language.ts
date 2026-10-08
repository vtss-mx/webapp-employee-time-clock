import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/language';

/** Textos del selector de idioma en italiano (it-IT). */
export default {
  label: 'Lingua',
  hintAccount: 'Si applica a tutti i tuoi dispositivi.',
  hintDevice: 'Viene ricordata su questo dispositivo.',
  saveFailed: 'Impossibile salvare la lingua',
  loadFailed: 'Impossibile cambiare la lingua',
} satisfies Translation<typeof es>;
