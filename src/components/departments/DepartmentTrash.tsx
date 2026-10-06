import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { departmentService } from '../../services/departmentService';
import type { Department } from '../../types';
import { DeletedRecordPage } from '../trash/TrashParts';
import type { RestoreQuestion } from '../trash/useRestore';

/** Restaurar un departamento: cuál regresa (con su descripción, si tiene). */
export const departmentRestore = (department: Department): RestoreQuestion => ({
  title: t('departments.trash.restoreTitle', { name: department.name }),
  details: department.description ? [{ label: t('departments.form.description'), value: department.description }] : undefined,
});

/**
 * Detalle de un departamento eliminado: el aviso con cuándo y quién lo eliminó, y «Restaurar». Sin editar,
 * asignar ni eliminar, y sin pedir sus empleados (el backend responde 404). Al restaurarlo, `onRestored` muestra
 * el detalle vigente.
 */
export function DeletedDepartment({ department, onRestored }: { department: Department; onRestored: (department: Department) => void }) {
  const t = useT();
  return (
    <DeletedRecordPage
      record={department}
      name={department.name}
      subtitle={department.description ?? undefined}
      backTo={paths.company.departments}
      backLabel={t('departments.back')}
      banner={t('departments.trash.banner')}
      restore={() => departmentService.restore(department.id)}
      question={() => departmentRestore(department)}
      onRestored={onRestored}
    />
  );
}
