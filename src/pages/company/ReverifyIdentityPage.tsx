import { RotateCcw, ScanFace, Users } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { ReasonFormPanel } from '../../components/ReasonFormPanel';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useFeedback } from '../../hooks/useFeedback';
import { useResource } from '../../hooks/useResource';
import { paths } from '../../routes/paths';
import { employeeService } from '../../services/employeeService';

/** El motivo en la confirmación: el que se escribió o qué verá el empleado si no hay uno. */
const reasonDetail = (reason: string) => ({ label: 'Motivo que verá', value: reason || 'Sin motivo: se le indicará que la empresa solicitó verificar su identidad' });

/** Motivo que verá el empleado al entrar al registro facial (uno o toda la empresa). */
const REASON_FIELD = {
  catalog: 'reverification_reasons',
  label: 'Motivo (opcional, visible para el empleado)',
  placeholder: 'Si no escribes un motivo, se le indicará que la empresa solicitó verificar su identidad.',
} as const;

/** COMPANY solicita al empleado verificar de nuevo su identidad, con un motivo que él verá. */
export function ReverifyIdentityPage() {
  const employeeId = Number(useParams().id);
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { data: employee, error, retry } = useResource((signal) => employeeService.get(employeeId, signal), employeeId, 'No se pudo cargar el empleado');

  const back = () => void navigate(paths.company.employee(employeeId));
  if (!employee) {
    return error ? (
      <div className="page">
        <Panel>
          <PanelHeader title="Solicitar nueva verificación de identidad" backTo={paths.company.employee(employeeId)} backLabel="Empleado" />
          <PanelSection>
            <RetryState onRetry={retry} />
          </PanelSection>
        </Panel>
      </div>
    ) : (
      <SkeletonCard lines={4} />
    );
  }
  return (
    <ReasonFormPanel
      title="Solicitar nueva verificación de identidad"
      subtitle={employee.full_name}
      backTo={paths.company.employee(employeeId)}
      backLabel={employee.full_name}
      icon={<ScanFace size={20} />}
      intro={`Se eliminarán sus datos faciales actuales. En su próximo acceso, ${employee.first_name} deberá registrar su rostro con prueba de vida y tendrás que validarlo nuevamente. Mientras tanto no podrá identificarse.`}
      field={REASON_FIELD}
      submit={{ label: 'Solicitar verificación', icon: <RotateCcw size={18} />, variant: 'warning' }}
      confirm={(reason) => ({
        tone: 'warning',
        icon: <ScanFace size={30} />,
        eyebrow: 'Nueva verificación',
        title: `¿Solicitar a ${employee.full_name} verificar su identidad?`,
        message: 'Se eliminarán sus datos faciales actuales y no podrá identificarse con su rostro hasta registrarse de nuevo y que lo valides.',
        details: [reasonDetail(reason)],
        note: 'Sus datos faciales actuales no se pueden recuperar.',
        confirmLabel: 'Solicitar verificación',
        confirmIcon: <RotateCcw size={18} />,
      })}
      errorTitle="No se pudo solicitar la verificación"
      onSend={async (reason) => {
        const updated = await employeeService.resetFace(employeeId, reason || undefined);
        void feedback.success('Verificación solicitada', `${updated.full_name} deberá registrar su rostro de nuevo en su próximo acceso.`);
        back();
      }}
      onCancel={back}
    />
  );
}

/**
 * COMPANY solicita a TODOS sus empleados verificar de nuevo su identidad (tras un incidente de
 * seguridad, un cambio de cámaras o una auditoría). Afecta a toda la empresa, así que pide una
 * confirmación explícita antes de enviarse.
 */
export function ReverifyAllPage() {
  const navigate = useNavigate();
  const feedback = useFeedback();
  const back = () => void navigate(paths.company.employees);

  return (
    <ReasonFormPanel
      title="Solicitar nueva verificación a todos"
      subtitle="Todos los empleados con registro facial"
      backTo={paths.company.employees}
      backLabel="Empleados"
      icon={<Users size={20} />}
      intro="Se eliminarán los datos faciales de todos tus empleados con registro (aprobado, en validación o rechazado). En su próximo acceso cada uno deberá registrar su rostro con prueba de vida y tendrás que validarlo. Mientras tanto no podrán identificarse con su rostro."
      field={REASON_FIELD}
      submit={{ label: 'Solicitar a todos', icon: <RotateCcw size={18} />, variant: 'danger' }}
      errorTitle="No se pudo solicitar la verificación"
      confirm={(reason) => ({
        tone: 'danger',
        icon: <Users size={30} />,
        eyebrow: 'Toda la empresa',
        title: '¿Solicitar nueva verificación a todos?',
        message: 'Esta acción afecta a todos tus empleados con registro facial.',
        details: [
          'Se borran los datos faciales de cada empleado con registro.',
          'Cada uno deberá registrar su rostro de nuevo y tú validarlo.',
          'Mientras tanto no podrán identificarse con su rostro.',
          reasonDetail(reason),
        ],
        note: 'Esta acción no se puede deshacer.',
        confirmLabel: 'Sí, solicitar a todos',
        confirmIcon: <RotateCcw size={18} />,
      })}
      onSend={async (reason) => {
        const { employees } = await employeeService.resetAllFaces(reason || undefined);
        void feedback.success(
          'Verificación solicitada',
          employees === 1 ? '1 empleado deberá registrar su rostro de nuevo en su próximo acceso.' : `${employees} empleados deberán registrar su rostro de nuevo en su próximo acceso.`,
        );
        back();
      }}
      onCancel={back}
    />
  );
}
