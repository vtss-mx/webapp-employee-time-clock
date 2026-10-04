import { formatMinutes } from '../../utils/format';

/** Qué miden los minutos: retardo al entrar, salida anticipada o descanso de más. */
export type MinutesKind = 'late' | 'early' | 'exceeded';

const KINDS: Record<MinutesKind, { sign: string; tone: string; describe: (text: string) => string }> = {
  late: { sign: '+', tone: 'warning', describe: (text) => `${text} de retardo` },
  early: { sign: '−', tone: 'warning', describe: (text) => `Salió ${text} antes` },
  exceeded: { sign: '+', tone: 'danger', describe: (text) => `${text} de descanso de más` },
};

/**
 * Insignia breve junto a una hora: "+25 min" (retardo), "−20 min" (salida anticipada) o "+5 min"
 * (descanso de más). Sin minutos no se dibuja. El lector de pantalla y el globo dicen qué significa.
 */
export function MinutesBadge({ kind, minutes }: { kind: MinutesKind; minutes: number }) {
  if (minutes <= 0) return null;
  const { sign, tone, describe } = KINDS[kind];
  const text = formatMinutes(minutes);
  return (
    <span className={`badge badge--plain badge--${tone}`} title={describe(text)}>
      <span aria-hidden="true">{`${sign}${text}`}</span>
      <span className="sr-only">{describe(text)}</span>
    </span>
  );
}
