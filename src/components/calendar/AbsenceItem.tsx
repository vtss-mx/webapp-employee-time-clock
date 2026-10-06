import type { ReactNode } from 'react';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useT } from '../../i18n';
import type { Absence } from '../../types';
import { timeAgo } from '../../utils/format';
import { CatalogStatusBadge } from '../StatusBadge';
import { daysText, rangeText } from './calendarRules';
import { EmployeeCard } from './EmployeeCard';

/** Tipo de ausencia con el nombre y el color del catálogo (sin el punto que late de un estado en espera). */
export function DayOffTypeBadge({ code }: { code: string }) {
  const { byCode } = useCatalogs();
  const type = byCode('day_off_types', code);
  return <span className={`badge badge--plain badge--${type?.tone ?? 'muted'}`}>{type?.name ?? code}</span>;
}

/**
 * Una ausencia en la lista: quién, qué tipo, el rango con sus días, su estado, quién la registró (la
 * empresa o la pidió el empleado), sus notas y las acciones que apliquen (cancelar, aprobar, rechazar).
 */
export function AbsenceItem({ absence, actions }: { absence: Absence; actions?: ReactNode }) {
  const t = useT();
  return (
    <EmployeeCard
      employee={absence.employee}
      badges={
        <>
          <DayOffTypeBadge code={absence.type} />
          <CatalogStatusBadge catalog="shift_request_statuses" code={absence.status} />
        </>
      }
      actions={actions}
    >
      <small>
        {rangeText(absence.starts_on, absence.ends_on)} · <strong>{daysText(absence.days)}</strong>
      </small>
      <small className="muted">{absence.requested_by_employee ? t('calendar.absence.requested', { when: timeAgo(absence.created_at) }) : t('calendar.absence.byCompany')}</small>
      {absence.note && <small className="shift-item__quote">“{absence.note}”</small>}
      {absence.decision_note && <small className="muted">{t('calendar.absence.decisionNote', { note: absence.decision_note })}</small>}
    </EmployeeCard>
  );
}
