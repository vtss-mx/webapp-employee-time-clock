import { UserPlus } from 'lucide-react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmployeeFormFields, HeadwearExemptField } from '../../components/EmployeeForm';
import { Panel, PanelFooter, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { Button } from '../../components/ui/Button';
import { useEmployeeForm } from '../../hooks/useEmployeeForm';
import { useFeedback } from '../../hooks/useFeedback';
import { paths } from '../../routes/paths';
import { employeeService } from '../../services/employeeService';

/** Alta de empleado: solo datos. El rostro lo registra el propio empleado y aquí se valida después. */
export function EmployeeCreatePage() {
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { values, setValues, touch, headwearExempt, setHeadwearExempt, errors, saving, canSubmit, validate, save, live, linking } =
    useEmployeeForm();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await save(async () => {
      // Persona de otra empresa: se vincula su cuenta y conserva su contraseña (no se envía).
      const { password_confirm: _confirm, ...data } = values;
      const employee = await employeeService.create({
        ...data,
        password: linking ? undefined : values.password,
        headwear_exempt: headwearExempt,
      });
      void navigate(paths.company.employee(employee.id), { replace: true });
      // Qué sigue para este empleado (antes era una nota fija en el formulario).
      void feedback.show({
        variant: 'success',
        title: employee.shared_account ? 'Persona vinculada a tu empresa' : 'Empleado registrado',
        text: employee.shared_account
          ? `${employee.full_name} ya trabajaba en otra empresa: entra con su misma cuenta y elige tu empresa al iniciar sesión.`
          : `${employee.full_name} ya puede iniciar sesión con su correo y contraseña.`,
        details: [
          'Se generó su código QR personal.',
          'Registrará su rostro en su primer inicio de sesión, con prueba de vida.',
          'Recibirás la solicitud en Validaciones para aceptar o rechazar su identidad.',
        ],
        detailsStyle: 'checks',
      });
    });
  };

  return (
    <div className="page">
      <Panel onSubmit={(e) => void onSubmit(e)}>
        <PanelHeader title="Registrar empleado" backTo={paths.company.employees} backLabel="Empleados" />
        <PanelSection title="Datos del empleado" icon={<UserPlus size={20} />}>
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
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={saving}
            disabled={!canSubmit}
            title={canSubmit ? undefined : 'Completa correctamente todos los campos obligatorios'}
            icon={<UserPlus size={20} />}
          >
            Registrar empleado
          </Button>
        </PanelFooter>
      </Panel>
    </div>
  );
}
