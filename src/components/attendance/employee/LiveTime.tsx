import { Timer } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocale } from '../../../i18n';
import { formatMinutes } from '../../../utils/format';
import { countdownText, MINUTE, msUntil } from './serverTime';

/**
 * Valor que se actualiza solo con UN temporizador propio: `measure` lo calcula y `nextDelay` dice
 * cuándo volver a medir (null = ya no cambia). Solo se redibuja el componente que lo usa, alineado al
 * cambio de segundo o de minuto: nunca la pantalla completa (como `QrCountdown`).
 */
function useTicking(measure: () => number, nextDelay: (value: number) => number | null): number {
  const [value, setValue] = useState(measure);
  const latest = useRef({ measure, nextDelay });
  useLayoutEffect(() => {
    latest.current = { measure, nextDelay };
  });
  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      const delay = latest.current.nextDelay(latest.current.measure());
      if (delay !== null) timer = window.setTimeout(tick, delay);
    };
    const tick = () => {
      setValue(latest.current.measure());
      schedule();
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, []);
  return value;
}

interface CountdownProps {
  /** Instante (ISO, hora del servidor) al que se cuenta. Quien lo usa le pone `key={until}`. */
  until: string;
  /** Diferencia servidor − teléfono (`serverOffset`). */
  offsetMs: number;
  /** "Tu turno empieza en" → "Tu turno empieza en 12 min 05 s". */
  label: string;
  /** Lo que se dice al llegar (p. ej. "Ya puedes checar"). */
  done: string;
}

/** "Cuánto falta" con la hora del servidor: corre cada segundo y se detiene al llegar. */
export function Countdown({ until, offsetMs, label, done }: CountdownProps) {
  useLocale(); // las unidades ("min", "s") se vuelven a armar al cambiar el idioma
  const left = useTicking(
    () => msUntil(until, offsetMs),
    (ms) => (ms > 0 ? ms % 1000 || 1000 : null),
  );
  return (
    <p className="live-time" aria-live="off">
      <Timer size={16} aria-hidden />
      {left > 0 ? (
        <span>
          {label} <strong>{countdownText(left)}</strong>
        </span>
      ) : (
        <strong>{done}</strong>
      )}
    </p>
  );
}

/**
 * Tiempo transcurrido desde un instante menos unos minutos (lo trabajado sin los descansos), con la
 * hora del servidor: "3 h 20 min". Corre cada minuto.
 */
export function Elapsed({ since, offsetMs, minusMinutes }: { since: string; offsetMs: number; minusMinutes: number }) {
  useLocale(); // "3 h 20 min" se vuelve a armar al cambiar el idioma
  const ms = useTicking(
    () => -msUntil(since, offsetMs) - minusMinutes * MINUTE,
    (value) => MINUTE - (Math.max(0, value) % MINUTE),
  );
  return <>{formatMinutes(Math.floor(Math.max(0, ms) / MINUTE))}</>;
}
