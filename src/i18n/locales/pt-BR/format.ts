import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/format';

/** Textos de los formatos de fechas, duraciones y porcentajes en portugués de Brasil (pt-BR). */
export default {
  justNow: 'agora mesmo',
  minutes: '{minutes} min',
  hours: '{hours} h',
  hoursMinutes: '{hours} h {minutes} min',
  /** En portugués de Brasil el signo va pegado a la cifra (como lo escribe `Intl`). */
  percent: '{value}%',
} satisfies Translation<typeof es>;
