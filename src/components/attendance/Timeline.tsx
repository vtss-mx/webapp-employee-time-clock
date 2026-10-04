import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { StepTone } from './sessionFacts';

/**
 * Línea de tiempo de la asistencia: base visual ÚNICA de las jornadas (`SessionTimeline`, a partir de
 * la jornada) y de su evidencia (`EventTimeline`, a partir de la bitácora). Cada paso tiene un punto
 * con ícono y color (`tone`), un título, su hora, insignias a un lado y el detalle debajo.
 */
export function AttendanceTimeline({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ol className="att-timeline" aria-label={label}>
      {children}
    </ol>
  );
}

interface TimelineStepProps {
  icon: LucideIcon;
  tone: StepTone;
  title: string;
  /** Hora del paso ("07:55", "12:00 – 12:35") o su estado ("Pendiente"). */
  time: string;
  /** Insignias junto a la hora (retardo, minutos de más, estado). */
  badges?: ReactNode;
  /** Detalle del paso (programado, modalidad, sitio, evidencia...). */
  children?: ReactNode;
}

export function TimelineStep({ icon: Icon, tone, title, time, badges, children }: TimelineStepProps) {
  return (
    <li className={`att-step att-step--${tone}`}>
      <span className="timeline__dot att-step__dot" aria-hidden="true">
        <Icon size={16} />
      </span>
      <div className="att-step__body">
        <div className="att-step__head">
          <strong>{title}</strong>
          <span className="att-step__time">{time}</span>
          {badges}
        </div>
        {children && <div className="att-step__detail">{children}</div>}
      </div>
    </li>
  );
}
