import { Save, UserPen } from 'lucide-react';
import type { SubmitEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EmployeeFormFields, HeadwearExemptField } from '../../components/EmployeeForm';
import { Panel, PanelFooter, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { employeeLabels, useEmployeeForm } from '../../hooks/useEmployeeForm';
import { useFeedback } from '../../hooks/useFeedback';
import { useLoadValues } from '../../hooks/useLoadValues';
import { useResource } from '../../hooks/useResource';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { employeeService } from '../../services/employeeService';
import type { Employee, EmployeeFormValues, EmployeeUpdatePayload } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import { describeChanges } from '../../utils/changes';
import { OPTIONAL_FIELDS } from '../../utils/formRules';

/** El formulario con los datos actuales del empleado (la contraseña vacía = no cambiarla). */
function toForm(employee: Employee): EmployeeFormValues {
  return {
    first_name: employee.first_name,
    last_name: employee.last_name,
    birth_date: employee.birth_date,
    curp: employee.curp ?? '',
    rfc: employee.rfc ?? '',
    nss: employee.nss ?? '',
    employee_number: employee.employee_number ?? '',
    phone: employee.phone ?? '',
    email: employee.email,
    password: '',
    password_confirm: '',
  };
}

/** Antes de guardar: solo lo que cambia ("antes → después") y, si cambia la contraseña, que debe compartirla. */
function editConfirm(original: Employee, values: EmployeeFormValues, headwearExempt: boolean, passwordChanged: boolean): ConfirmInput {
  return {
    kind: 'edit',
    title: t('employees.edit.confirmTitle', { name: original.full_name }),
    changes: describeChanges({ ...toForm(original), headwear_exempt: original.headwear_exempt }, { ...values, headwear_exempt: headwearExempt }, employeeLabels()),
    note: passwordChanged ? t('employees.edit.passwordNote') : undefined,
  };
}

/** Lo que cambió respecto al empleado guardado (omitido = no cambiarlo). La contraseña solo si se escribió una. */
function changedFields(original: Employee, values: EmployeeFormValues, headwearExempt: boolean): EmployeeUpdatePayload {
  const payload: EmployeeUpdatePayload = {};
  (Object.keys(values) as Array<keyof EmployeeFormValues>).forEach((key) => {
    if (key === 'password_confirm') return; // solo en el cliente
    const value = key === 'password' ? values[key] : values[key].trim();
    if (key === 'password' ? value : value !== (original[key] ?? '')) {
      payload[key] = value;
    }
  });
  // Borrar un dato opcional (número, RFC, CURP, NSS) se envía como null: queda sin capturar.
  for (const field of OPTIONAL_FIELDS) if (payload[field] === '') payload[field] = null;
  if (headwearExempt !== original.headwear_exempt) payload.headwear_exempt = headwearExempt;
  return payload;
}

const loadFailed = () => t('employees.loadError');
const savedTitle = () => t('employees.edit.saved');

export function EmployeeEditPage() {
  const t = useT();
  const { id } = useParams();
  const employeeId = Number(id);
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { data: original, error: loadError, retry: load } = useResource((signal) => employeeService.get(employeeId, signal), employeeId, loadFailed);
  const { values, loadValues, setValues, touch, headwearExempt, setHeadwearExempt, errors, saving, canSubmit, validate, save, live } =
    useEmployeeForm({
      excludeId: employeeId,
      passwordOptional: true,
      original: original
        ? {
            employee_number: original.employee_number ?? undefined,
            rfc: original.rfc ?? undefined,
            curp: original.curp ?? undefined,
            nss: original.nss ?? undefined,
            email: original.email,
            phone: original.phone ?? undefined,
          }
        : undefined,
    });

  // Los campos se llenan con el empleado en cuanto llega (antes de pintarse: sin parpadeo de campos vacíos).
  // Por valores (`useLoadValues`): volver a pedirlo al cambiar el idioma no pisa lo que ya se escribió.
  useLoadValues(original ? { form: toForm(original), headwear: original.headwear_exempt } : null, ({ form, headwear }) => {
    setHeadwearExempt(headwear);
    loadValues(form);
  });

  // Solo se envían los campos modificados (y sin cambios no hay nada que guardar).
  const payload: EmployeeUpdatePayload = original ? changedFields(original, values, headwearExempt) : {};
  const dirty = Object.keys(payload).length > 0;

  const onSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    // Sin el empleado cargado no hay cambios (payload vacío): `dirty` también cubre ese caso.
    if (!original || !dirty || !validate()) return;

    await save(async () => {
      await employeeService.update(employeeId, payload);
      void feedback.success(savedTitle);
      void navigate(paths.company.employee(employeeId));
    }, () => editConfirm(original, values, headwearExempt, Boolean(payload.password)));
  };

  if (!original && !loadError) return <SkeletonCard lines={6} />;

  return (
    <div className="page">
      <Panel onSubmit={(e) => void onSubmit(e)}>
        <PanelHeader title={t('employees.edit.title')} subtitle={original?.full_name} backTo={paths.company.employee(employeeId)} />
        <PanelSection title={t('employees.form.section')} icon={<UserPen size={20} />}>
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
              {t('common.actions.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={saving}
              disabled={!canSubmit || !dirty}
              title={!canSubmit ? t('employees.form.incomplete') : !dirty ? t('employees.edit.noChanges') : undefined}
              icon={<Save size={20} />}
            >
              {t('common.actions.saveChanges')}
            </Button>
          </PanelFooter>
        )}
      </Panel>
    </div>
  );
}
