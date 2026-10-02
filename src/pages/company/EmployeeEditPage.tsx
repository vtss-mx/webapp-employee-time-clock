import { Save, UserPen } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EmployeeFormFields, HeadwearExemptField } from '../../components/EmployeeForm';
import { Panel, PanelFooter, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { useEmployeeForm } from '../../hooks/useEmployeeForm';
import { useErrorPopup, useFeedback } from '../../hooks/useFeedback';
import { paths } from '../../routes/paths';
import { employeeService } from '../../services/employeeService';
import type { Employee, EmployeeFormValues, EmployeeUpdatePayload } from '../../types';

export function EmployeeEditPage() {
  const { id } = useParams();
  const employeeId = Number(id);
  const navigate = useNavigate();
  const feedback = useFeedback();
  const [original, setOriginal] = useState<Employee | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
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

  const load = useCallback(() => {
    setLoadError(null);
    employeeService
      .get(employeeId)
      .then((emp) => {
        setOriginal(emp);
        setHeadwearExempt(emp.headwear_exempt);
        loadValues({
          first_name: emp.first_name,
          last_name: emp.last_name,
          birth_date: emp.birth_date,
          curp: emp.curp ?? '',
          rfc: emp.rfc ?? '',
          nss: emp.nss ?? '',
          employee_number: emp.employee_number,
          phone: emp.phone ?? '',
          email: emp.email,
          password: '',
        });
      })
      .catch(setLoadError);
  }, [employeeId, setHeadwearExempt, loadValues]);

  useEffect(load, [load]);
  useErrorPopup(loadError, { title: 'No se pudo cargar el empleado', retry: load });

  // Solo se envían los campos modificados (y sin cambios no hay nada que guardar).
  const payload: EmployeeUpdatePayload = {};
  if (original) {
    (Object.keys(values) as Array<keyof EmployeeFormValues>).forEach((key) => {
      const value = key === 'password' ? values[key] : values[key].trim();
      if (key === 'password' ? value : value !== String(original[key as keyof Employee] ?? '')) {
        payload[key] = value;
      }
    });
    if (headwearExempt !== original.headwear_exempt) payload.headwear_exempt = headwearExempt;
  }
  const dirty = Object.keys(payload).length > 0;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!original || !dirty || !validate()) return;

    await save(async () => {
      await employeeService.update(employeeId, payload);
      feedback.success('Cambios guardados');
      void navigate(paths.company.employee(employeeId));
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
