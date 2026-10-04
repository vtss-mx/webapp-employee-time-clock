import type { ReactNode } from 'react';
import type { EmployeeRef } from '../../types';
import { initials } from '../../utils/format';
import { ShiftItem } from '../shifts/ShiftItem';

interface EmployeeCardProps {
  employee: EmployeeRef;
  badges: ReactNode;
  actions?: ReactNode;
  /** Renglones de detalle bajo el nombre. */
  children: ReactNode;
}

/** Un registro de un empleado en las listas del calendario (ausencia, día laborable): avatar, nombre y número. */
export function EmployeeCard({ employee, badges, actions, children }: EmployeeCardProps) {
  return (
    <ShiftItem
      lead={<span className="avatar">{initials(employee.full_name)}</span>}
      title={
        <>
          {employee.full_name} <span className="muted small">· {employee.employee_number}</span>
        </>
      }
      badges={badges}
      actions={actions}
    >
      {children}
    </ShiftItem>
  );
}
