import { UserPlus } from 'lucide-react';
import type { SubmitEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmployeeFormFields, HeadwearExemptField } from '../../components/EmployeeForm';
import type { MessageInput } from '../../components/MessageDialog';
import { Panel, PanelFooter, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { Button } from '../../components/ui/Button';
import { employeeLabels, useEmployeeForm } from '../../hooks/useEmployeeForm';
import { useFeedback } from '../../hooks/useFeedback';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { employeeService } from '../../services/employeeService';
import type { Employee, EmployeeFormValues } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import { describeValues } from '../../utils/changes';
import { optionalPayload } from '../../utils/formRules';

/** Antes de registrar: a quién y con qué datos (al vincular, que conserva su cuenta y su contraseña). */
function createConfirm(values: EmployeeFormValues, headwearExempt: boolean, linking: boolean): ConfirmInput {
  const name = `${values.first_name.trim()} ${values.last_name.trim()}`;
  return {
    kind: 'create',
    icon: <UserPlus size={30} />,
    title: t(linking ? 'employees.create.linkConfirm.title' : 'employees.create.confirm.title', { name }),
    message: t(linking ? 'employees.create.linkConfirm.message' : 'employees.create.confirm.message'),
    detailsTitle: t(linking ? 'employees.create.linkConfirm.detailsTitle' : 'employees.create.confirm.detailsTitle'),
    // La contraseña nunca se muestra; al vincular no se envía (conserva la suya).
    details: describeValues({ ...values, password: linking ? '' : values.password, headwear_exempt: headwearExempt || undefined }, employeeLabels()),
    confirmLabel: t(linking ? 'employees.create.linkConfirm.confirm' : 'employees.create.title'),
    confirmIcon: <UserPlus size={18} />,
  };
}

/** Qué sigue para el empleado registrado (antes era una nota fija en el formulario). */
function createdMessage(employee: Employee): MessageInput {
  const linked = employee.shared_account;
  return {
    variant: 'success',
    title: t(linked ? 'employees.create.linked.title' : 'employees.create.created.title'),
    text: t(linked ? 'employees.create.linked.text' : 'employees.create.created.text', { name: employee.full_name }),
    details: [t('employees.create.next.qr'), t('employees.create.next.face'), t('employees.create.next.review')],
    detailsStyle: 'checks',
  };
}

/** Alta de empleado: solo datos. El rostro lo registra el propio empleado y aquí se valida después. */
export function EmployeeCreatePage() {
  const t = useT();
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { values, setValues, touch, headwearExempt, setHeadwearExempt, errors, saving, canSubmit, validate, save, live, linking } =
    useEmployeeForm();

  const onSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await save(async () => {
      // Persona de otra empresa: se vincula su cuenta y conserva su contraseña (no se envía).
      const { password_confirm: _confirm, ...data } = values;
      const employee = await employeeService.create({
        ...data,
        ...optionalPayload(values), // número, RFC, CURP y NSS opcionales: vacíos viajan como null
        password: linking ? undefined : values.password,
        headwear_exempt: headwearExempt,
      });
      void navigate(paths.company.employee(employee.id), { replace: true });
      void feedback.show(() => createdMessage(employee));
    }, () => createConfirm(values, headwearExempt, linking));
  };

  return (
    <div className="page">
      <Panel onSubmit={(e) => void onSubmit(e)}>
        <PanelHeader title={t('employees.create.title')} backTo={paths.company.employees} backLabel={t('employees.back')} />
        <PanelSection title={t('employees.form.section')} icon={<UserPlus size={20} />}>
          <EmployeeFormFields
            values={values}
            errors={errors}
            onChange={setValues}
            onTouch={touch}
            disabled={saving}
            live={live}
            linking={linking}
          />
          <HeadwearExemptField checked={headwearExempt} onChange={setHeadwearExempt} disabled={saving} />
        </PanelSection>
        <PanelFooter>
          <Button variant="ghost" size="lg" onClick={() => void navigate(-1)} disabled={saving}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={saving}
            disabled={!canSubmit}
            title={canSubmit ? undefined : t('employees.form.incomplete')}
            icon={<UserPlus size={20} />}
          >
            {t('employees.create.title')}
          </Button>
        </PanelFooter>
      </Panel>
    </div>
  );
}
