import type { ReactNode } from 'react';
import type { EmployeeRef } from '../../types';
import { ShiftItem } from '../shifts/ShiftItem';
import { Avatar } from '../ui/Avatar';
import { DeletedMark } from '../ui/DeletedMark';

interface EmployeeCardProps {
  employee: EmployeeRef;
  badges: ReactNode;
  actions?: ReactNode;
  /** Renglones de detalle bajo el nombre. */
  children: ReactNode;
}

/**
 * Un registro de un empleado en las listas del calendario (ausencia, día laborable): avatar, nombre y número
 * (con su marca si el empleado ya está en «Eliminados»: lo registrado no cambia).
 */
export function EmployeeCard({ employee, badges, actions, children }: EmployeeCardProps) {
  return (
    <ShiftItem
      lead={<Avatar name={employee.full_name} decorative />}
      title={
        <>
          {employee.full_name} <span className="muted small">· {employee.employee_number}</span>
          <DeletedMark deleted={employee.deleted} />
        </>
      }
      badges={badges}
      actions={actions}
    >
      {children}
    </ShiftItem>
  );
}
