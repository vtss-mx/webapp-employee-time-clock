import { t } from '../i18n/core';

/**
 * Cómo se nombra a un empleado en subtítulos, listas y confirmaciones. El número de empleado es OPCIONAL (decisión del
 * dueño del producto; backend, migración 0076): quien lo muestra lo omite si falta, nunca dibuja «· null» ni un
 * separador colgando. Una sola implementación para toda la app.
 */
export interface NamedEmployee {
  full_name: string;
  employee_number?: string | null;
}

/** «No. EMP-7», o '' sin número (se une con otros datos con `filter(Boolean)`). */
export const employeeNumberLabel = (number: string | null | undefined): string => (number ? t('employees.number', { number }) : '');

/**
 * «Ana Ruiz · EMP-7» (con `prefixed`, «Ana Ruiz · No. EMP-7»), o solo el nombre si no tiene número. Se arma al dibujar
 * (sigue al idioma activo).
 */
export function employeeLabel({ full_name, employee_number }: NamedEmployee, { prefixed = false } = {}): string {
  if (!employee_number) return full_name;
  return `${full_name} · ${prefixed ? employeeNumberLabel(employee_number) : employee_number}`;
}
