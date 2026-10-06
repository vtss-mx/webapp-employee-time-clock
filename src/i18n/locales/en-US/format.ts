import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/format';

/** Textos de los formatos de fechas, duraciones y porcentajes en inglés (en-US). */
export default {
  justNow: 'just now',
  minutes: '{minutes} min',
  hours: '{hours} h',
  hoursMinutes: '{hours} h {minutes} min',
  percent: '{value}%',
} satisfies Translation<typeof es>;
