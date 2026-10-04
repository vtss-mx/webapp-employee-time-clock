import { Save, UserPen } from 'lucide-react';
import { useLayoutEffect, type SubmitEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EmployeeFormFields, HeadwearExemptField } from '../../components/EmployeeForm';
import { Panel, PanelFooter, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { EMPLOYEE_LABELS, useEmployeeForm } from '../../hooks/useEmployeeForm';
import { useFeedback } from '../../hooks/useFeedback';
import { useResource } from '../../hooks/useResource';
import { paths } from '../../routes/paths';
import { employeeService } from '../../services/employeeService';
import type { Employee, EmployeeFormValues, EmployeeUpdatePayload } from '../../types';
import { describeChanges } from '../../utils/changes';

/** El formulario con los datos actuales del empleado (la contraseña vacía = no cambiarla). */
function toForm(employee: Employee): EmployeeFormValues {
  return {
    first_name: employee.first_name,
    last_name: employee.last_name,
    birth_date: employee.birth_date,
    curp: employee.curp ?? '',
    rfc: employee.rfc ?? '',
    nss: employee.nss ?? '',
    employee_number: employee.employee_number,
    phone: employee.phone ?? '',
    email: employee.email,
    password: '',
    password_confirm: '',
  };
}

export function EmployeeEditPage() {
  const { id } = useParams();
  const employeeId = Number(id);
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { data: original, error: loadError, retry: load } = useResource((signal) => employeeService.get(employeeId, signal), employeeId, 'No se pudo cargar el empleado');
  const { values, loadValues, setValues, touch, headwearExempt, setHeadwearExempt, errors, saving, canSubmit, validate, save, live } =
    useEmployeeForm({
      excludeId: employeeId,
      passwordOptional: true,
      original: original
        ? {
            employee_number: original.employee_number,
            rfc: original.rfc ?? undefined,
            curp: original.curp ?? undefined,
            nss: original.nss ?? undefined,
            email: original.email,
            phone: original.phone ?? undefined,
          }
        : undefined,
    });

  // Los campos se llenan con el empleado en cuanto llega (antes de pintarse: sin parpadeo de campos vacíos).
  useLayoutEffect(() => {
    if (!original) return;
    setHeadwearExempt(original.headwear_exempt);
    loadValues(toForm(original));
  }, [original, setHeadwearExempt, loadValues]);

  // Solo se envían los campos modificados (y sin cambios no hay nada que guardar).
  const payload: EmployeeUpdatePayload = {};
  if (original) {
    (Object.keys(values) as Array<keyof EmployeeFormValues>).forEach((key) => {
      if (key === 'password_confirm') return; // solo en el cliente
      const value = key === 'password' ? values[key] : values[key].trim();
      if (key === 'password' ? value : value !== (original[key] ?? '')) {
        payload[key] = value;
      }
    });
    if (headwearExempt !== original.headwear_exempt) payload.headwear_exempt = headwearExempt;
  }
  const dirty = Object.keys(payload).length > 0;

  const onSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    // Sin el empleado cargado no hay cambios (payload vacío): `dirty` también cubre ese caso.
    if (!original || !dirty || !validate()) return;

    await save(async () => {
      await employeeService.update(employeeId, payload);
      void feedback.success('Cambios guardados');
      void navigate(paths.company.employee(employeeId));
    }, {
      kind: 'edit',
      title: `¿Guardar los cambios de ${original.full_name}?`,
      changes: describeChanges({ ...toForm(original), headwear_exempt: original.headwear_exempt }, { ...values, headwear_exempt: headwearExempt }, EMPLOYEE_LABELS),
      note: payload.password ? 'Deberá entrar con la nueva contraseña: compártela por un medio seguro.' : undefined,
    });
  };

  if (!original && !loadError) return <SkeletonCard lines={6} />;

  return (
    <div className="page">
      <Panel onSubmit={(e) => void onSubmit(e)}>
        <PanelHeader title="Editar empleado" subtitle={original?.full_name} backTo={paths.company.employee(employeeId)} />
        <PanelSection title="Datos del empleado" icon={<UserPen size={20} />}>
          {Boolean(loadError) && !original && <RetryState onRetry={load} />}
          {original && (
            <>
              <EmployeeFormFields
                values={values}
                errors={errors}
                onChange={setValues}
                onTouch={touch}
                disabled={saving}
                isEdit
                live={live}
                accountLocked={original?.shared_account}
              />
              <HeadwearExemptField checked={headwearExempt} onChange={setHeadwearExempt} disabled={saving} />
            </>
          )}
        </PanelSection>
        {original && (
          <PanelFooter>
            <Button variant="ghost" size="lg" onClick={() => void navigate(-1)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={saving}
              disabled={!canSubmit || !dirty}
              title={!canSubmit ? 'Completa correctamente todos los campos obligatorios' : !dirty ? 'No hay cambios por guardar' : undefined}
              icon={<Save size={20} />}
            >
              Guardar cambios
            </Button>
          </PanelFooter>
        )}
      </Panel>
    </div>
  );
}
