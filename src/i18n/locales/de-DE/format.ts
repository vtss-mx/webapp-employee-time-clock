import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/format';

/** Textos de los formatos de fechas, duraciones y porcentajes en alemán (de-DE). */
export default {
  justNow: 'gerade eben',
  minutes: '{minutes} min',
  hours: '{hours} h',
  hoursMinutes: '{hours} h {minutes} min',
  /** En alemán el porcentaje va con espacio antes del signo (DIN 5008), como en español. */
  percent: '{value} %',
} satisfies Translation<typeof es>;
