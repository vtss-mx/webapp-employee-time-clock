import { RotateCcw, ScanFace, Users } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { ReasonFormPanel } from '../../components/ReasonFormPanel';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useFeedback } from '../../hooks/useFeedback';
import { useResource } from '../../hooks/useResource';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { employeeService } from '../../services/employeeService';
import type { Employee } from '../../types';
import type { ConfirmInput } from '../../types/confirm';

/** El motivo en la confirmación: el que se escribió o qué verá el empleado si no hay uno. */
const reasonDetail = (reason: string) => ({ label: t('employees.reverify.reasonDetail'), value: reason || t('employees.reverify.noReason') });

/** Motivo que verá el empleado al entrar al registro facial (uno o toda la empresa), en el idioma activo. */
const reasonField = () =>
  ({
    catalog: 'reverification_reasons',
    label: t('employees.reverify.reasonLabel'),
    placeholder: t('employees.reverify.reasonPlaceholder'),
  }) as const;

/** Uno: se borran sus datos faciales y no podrá identificarse hasta registrarse de nuevo y validarlo. */
function reverifyConfirm(employee: Employee, reason: string): ConfirmInput {
  return {
    tone: 'warning',
    icon: <ScanFace size={30} />,
    eyebrow: t('employees.reverify.confirm.eyebrow'),
    title: t('employees.reverify.confirm.title', { name: employee.full_name }),
    message: t('employees.reverify.confirm.message'),
    details: [reasonDetail(reason)],
    note: t('employees.reverify.confirm.note'),
    confirmLabel: t('employees.reverify.submit'),
    confirmIcon: <RotateCcw size={18} />,
  };
}

/** Todos: afecta a toda la empresa, así que dice qué pasará a cada uno. */
function reverifyAllConfirm(reason: string): ConfirmInput {
  return {
    tone: 'danger',
    icon: <Users size={30} />,
    eyebrow: t('employees.reverify.all.confirm.eyebrow'),
    title: t('employees.reverify.all.confirm.title'),
    message: t('employees.reverify.all.confirm.message'),
    details: [t('employees.reverify.all.confirm.erase'), t('employees.reverify.all.confirm.enrollAgain'), t('employees.reverify.all.confirm.meanwhile'), reasonDetail(reason)],
    note: t('common.notes.irreversible'),
    confirmLabel: t('employees.reverify.all.confirm.confirm'),
    confirmIcon: <RotateCcw size={18} />,
  };
}

const loadError = () => t('employees.loadError');
const requestError = () => t('employees.reverify.error');
/** Avisos al terminar: se arman al dibujarse (siguen al idioma activo). */
const requested = () => t('employees.reverify.done');
const requestedOne = (name: string) => () => t('employees.reverify.doneText', { name });
const requestedAll = (count: number) => () => t('employees.reverify.all.doneText', { count });

/** COMPANY solicita al empleado verificar de nuevo su identidad, con un motivo que él verá. */
export function ReverifyIdentityPage() {
  const t = useT();
  const employeeId = Number(useParams().id);
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { data: employee, error, retry } = useResource((signal) => employeeService.get(employeeId, signal), employeeId, loadError);

  const back = () => void navigate(paths.company.employee(employeeId));
  if (!employee) {
    return error ? (
      <div className="page">
        <Panel>
          <PanelHeader title={t('employees.reverify.title')} backTo={paths.company.employee(employeeId)} backLabel={t('common.fields.employee')} />
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
      title={t('employees.reverify.title')}
      subtitle={employee.full_name}
      backTo={paths.company.employee(employeeId)}
      backLabel={employee.full_name}
      icon={<ScanFace size={20} />}
      intro={t('employees.reverify.intro', { name: employee.first_name })}
      field={reasonField()}
      submit={{ label: t('employees.reverify.submit'), icon: <RotateCcw size={18} />, variant: 'warning' }}
      confirm={(reason) => reverifyConfirm(employee, reason)}
      errorTitle={requestError}
      onSend={async (reason) => {
        const updated = await employeeService.resetFace(employeeId, reason || undefined);
        void feedback.success(requested, requestedOne(updated.full_name));
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
  const t = useT();
  const navigate = useNavigate();
  const feedback = useFeedback();
  const back = () => void navigate(paths.company.employees);

  return (
    <ReasonFormPanel
      title={t('employees.reverify.all.title')}
      subtitle={t('employees.reverify.all.subtitle')}
      backTo={paths.company.employees}
      backLabel={t('employees.back')}
      icon={<Users size={20} />}
      intro={t('employees.reverify.all.intro')}
      field={reasonField()}
      submit={{ label: t('employees.reverify.all.submit'), icon: <RotateCcw size={18} />, variant: 'danger' }}
      errorTitle={requestError}
      confirm={reverifyAllConfirm}
      onSend={async (reason) => {
        const { employees } = await employeeService.resetAllFaces(reason || undefined);
        void feedback.success(requested, requestedAll(employees));
        back();
      }}
      onCancel={back}
    />
  );
}
