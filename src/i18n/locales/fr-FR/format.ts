import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/format';

/** Textos de los formatos de fechas, duraciones y porcentajes en francés (fr-FR): en francés el porcentaje lleva espacio antes del signo. */
export default {
  justNow: "à l'instant",
  minutes: '{minutes} min',
  hours: '{hours} h',
  hoursMinutes: '{hours} h {minutes} min',
  percent: '{value} %',
} satisfies Translation<typeof es>;
