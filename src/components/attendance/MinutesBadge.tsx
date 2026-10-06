import { useT } from '../../i18n';
import { formatMinutes } from '../../utils/format';

/** Qué miden los minutos: retardo al entrar, salida anticipada o descanso de más. */
export type MinutesKind = 'late' | 'early' | 'exceeded';

/** Signo y color de cada insignia; lo que significa sale del diccionario (`attendance.minutes.*`). */
const KINDS: Record<MinutesKind, { sign: string; tone: string }> = {
  late: { sign: '+', tone: 'warning' },
  early: { sign: '−', tone: 'warning' },
  exceeded: { sign: '+', tone: 'danger' },
};

/**
 * Insignia breve junto a una hora: "+25 min" (retardo), "−20 min" (salida anticipada) o "+5 min"
 * (descanso de más). Sin minutos no se dibuja. El lector de pantalla y el globo dicen qué significa.
 */
export function MinutesBadge({ kind, minutes }: { kind: MinutesKind; minutes: number }) {
  const t = useT();
  if (minutes <= 0) return null;
  const { sign, tone } = KINDS[kind];
  const text = formatMinutes(minutes);
  const description = t(`attendance.minutes.${kind}`, { time: text });
  return (
    <span className={`badge badge--plain badge--${tone}`} title={description}>
      <span aria-hidden="true">{`${sign}${text}`}</span>
      <span className="sr-only">{description}</span>
    </span>
  );
}
