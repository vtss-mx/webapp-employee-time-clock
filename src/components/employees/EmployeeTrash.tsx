import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { employeeService } from '../../services/employeeService';
import type { Employee } from '../../types';
import { DeletedRecordPage } from '../trash/TrashParts';
import type { RestoreQuestion } from '../trash/useRestore';
import { EmployeeInfo } from './EmployeeInfo';

/** Restaurar a un empleado: quién regresa y que deberá registrar su rostro de nuevo (se borró al eliminarlo). */
export const employeeRestore = (employee: Employee): RestoreQuestion => ({
  title: t('employees.trash.restoreTitle', { name: employee.full_name }),
  details: [
    // El número es opcional: sin él, la persona se reconoce por su nombre y su correo.
    ...(employee.employee_number ? [{ label: t('common.fields.employeeNumber'), value: employee.employee_number }] : []),
    { label: t('employees.email'), value: employee.email },
  ],
  note: t('ui.trash.faceAgain'),
});

/**
 * Expediente de un empleado eliminado: sus datos, el aviso con cuándo y quién lo eliminó, y «Restaurar». Sin
 * editar, activar ni eliminar, y sin sus secciones (registro facial, QR, historial, dispositivos, turnos): el
 * backend las responde 404. Al restaurarlo, `onRestored` muestra el expediente vigente.
 */
export function DeletedEmployee({ employee, onRestored }: { employee: Employee; onRestored: (employee: Employee) => void }) {
  const t = useT();
  return (
    <DeletedRecordPage
      record={employee}
      name={employee.full_name}
      subtitle={employee.employee_number ? <span className="badge badge--info badge--plain">{employee.employee_number}</span> : undefined}
      backTo={paths.company.employees}
      backLabel={t('employees.back')}
      banner={t('employees.trash.banner')}
      restore={() => employeeService.restore(employee.id)}
      question={() => employeeRestore(employee)}
      onRestored={onRestored}
    >
      <EmployeeInfo employee={employee} />
    </DeletedRecordPage>
  );
}
