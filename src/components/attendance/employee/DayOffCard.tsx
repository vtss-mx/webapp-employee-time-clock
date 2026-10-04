import { CalendarCheck, CalendarOff, PartyPopper, Stethoscope, TreePalm, type LucideIcon } from 'lucide-react';
import type { DayOff } from '../../../types';
import { daysText, rangeText, spanDays } from '../../calendar/calendarRules';

/** Ícono de cada motivo de un día libre (festivo o tipo de ausencia del catálogo day_off_types). */
const ICONS: Record<string, LucideIcon> = {
  HOLIDAY: PartyPopper,
  VACATION: TreePalm,
  PERMISSION: CalendarCheck,
  SICK_LEAVE: Stethoscope,
};

/** El ícono del motivo; uno nuevo del catálogo usa el de "día libre". */
export const dayOffIcon = (kind: string): LucideIcon => ICONS[kind] ?? CalendarOff;

interface DayOffCardProps {
  /** Por qué no trabaja (lo calcula el servidor: festivo o ausencia aprobada). */
  dayOff: DayOff;
  /** Hoy ("YYYY-MM-DD") con la hora del servidor: decide "Hoy no trabajas" o "Tus próximos días libres". */
  today: string;
  /** Lo que explica el servidor (p. ej. cuándo es su siguiente turno); dentro del reloj ya se ve. */
  message?: string;
}

/**
 * Día libre del empleado en "Mi asistencia": amable y claro, sin botones (ese día no hay nada que
 * registrar). Un ícono según el motivo, si es hoy o lo que viene, el nombre del festivo o del tipo de
 * ausencia y su rango de fechas (con cuántos días son). Dentro del reloj checador toma sus colores.
 *
 *   <DayOffCard dayOff={today.day_off} today={businessToday(new Date(today.now))} />
 */
export function DayOffCard({ dayOff, today, message }: DayOffCardProps) {
  const Icon = dayOffIcon(dayOff.kind);
  const holiday = dayOff.kind === 'HOLIDAY';
  const days = spanDays(dayOff.starts_on, dayOff.ends_on);
  return (
    <section className={`day-off ${holiday ? 'day-off--holiday' : ''}`.trim()} aria-label="Día libre">
      <span className="day-off__icon" aria-hidden>
        <Icon size={26} />
      </span>
      <div className="day-off__body">
        <h3 className="day-off__title">{dayOff.work_date === today ? 'Hoy no trabajas' : 'Tus próximos días libres'}</h3>
        <strong className="day-off__name">{holiday ? `Día festivo: ${dayOff.name}` : dayOff.name}</strong>
        <span className="day-off__range">
          {rangeText(dayOff.starts_on, dayOff.ends_on)}
          {days > 1 && <span className="day-off__days"> · {daysText(days)}</span>}
        </span>
        {message && <p className="day-off__message">{message}</p>}
      </div>
    </section>
  );
}
