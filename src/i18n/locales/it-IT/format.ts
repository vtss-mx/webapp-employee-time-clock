import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/format';

/** Textos de los formatos de fechas, duraciones y porcentajes en italiano (it-IT): el porcentaje va sin espacio («16%»). */
export default {
  justNow: 'poco fa',
  minutes: '{minutes} min',
  hours: '{hours} h',
  hoursMinutes: '{hours} h {minutes} min',
  percent: '{value}%',
} satisfies Translation<typeof es>;
