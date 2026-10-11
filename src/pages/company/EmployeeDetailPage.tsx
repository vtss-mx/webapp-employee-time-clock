import { Activity, Camera, ClipboardCheck, MonitorSmartphone, Pause, Pencil, Play, RotateCcw, ScanFace, ShieldCheck, Trash2, UserCheck } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { VerificationHistory } from '../../components/VerificationHistory';
import { EmployeeInfo } from '../../components/employees/EmployeeInfo';
import { DeletedEmployee } from '../../components/employees/EmployeeTrash';
import { deleteNote } from '../../components/trash/TrashParts';
import { DataExportSection } from '../../components/dataExport/DataExportSection';
import { EmployeeDevices } from '../../components/devices/EmployeeDevices';
import { Panel, PanelFooter, PanelGrid, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { QrCodePanel } from '../../components/QrCodePanel';
import { FaceStatusBadge, StatusBadge } from '../../components/StatusBadge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useAction, type SuccessNotice } from '../../hooks/useAction';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useConfirm } from '../../hooks/useConfirm';
import { useResource } from '../../hooks/useResource';
import { RetryState } from '../../components/ui/RetryState';
import { t, Trans, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { employeeDeviceService } from '../../services/employeeDeviceService';
import { employeeService } from '../../services/employeeService';
import type { Employee } from '../../types';
import type { ConfirmInput } from '../../types/confirm';

/** Activar o desactivar: qué cambia para el empleado (el estado, "antes → después"). */
function statusConfirm(employee: Employee): ConfirmInput {
  const active = t('common.states.active');
  const inactive = t('common.states.inactive');
  const state = { label: t('common.fields.status'), before: employee.active ? active : inactive, after: employee.active ? inactive : active };
  const name = { name: employee.full_name };
  return employee.active
    ? {
        tone: 'danger',
        icon: <Pause size={30} />,
        eyebrow: t('common.actions.changeStatus'),
        title: t('employees.detail.deactivateConfirm.title', name),
        message: t('employees.detail.deactivateConfirm.message'),
        changes: [state],
        confirmLabel: t('common.actions.deactivate'),
        confirmIcon: <Pause size={18} />,
      }
    : {
        tone: 'success',
        icon: <Play size={30} />,
        eyebrow: t('common.actions.changeStatus'),
        title: t('employees.detail.activateConfirm.title', name),
        message: t('employees.detail.activateConfirm.message'),
        changes: [state],
        confirmLabel: t('common.actions.activate'),
        confirmIcon: <Play size={18} />,
      };
}

/**
 * Eliminar: va a «Eliminados» (se restaura durante 1 año), pero su rostro y sus fotos se borran para siempre;
 * por eso se escribe su número de empleado para habilitarlo.
 */
function deleteConfirm(employee: Employee): ConfirmInput {
  return {
    kind: 'delete',
    title: t('employees.detail.deleteConfirm.title', { name: employee.full_name }),
    message: <Trans k="employees.detail.deleteConfirm.message" values={{ deactivate: <em>{t('common.actions.deactivate')}</em> }} />,
    details: [
      ...(employee.employee_number ? [{ label: t('common.fields.employeeNumber'), value: employee.employee_number }] : []),
      { label: t('employees.email'), value: employee.email },
    ],
    note: deleteNote({ person: true }),
    // Se escribe su número para confirmar; sin número (es opcional), su nombre.
    confirmText: employee.employee_number ?? employee.full_name,
    confirmLabel: t('employees.detail.delete'),
  };
}

/** Registrar en persona: qué pasará al abrir la cámara (y que reemplaza el registro actual, si hay). */
function enrollConfirm(employee: Employee): ConfirmInput {
  return {
    kind: 'create',
    icon: <Camera size={30} />,
    eyebrow: t('employees.face.enrollConfirm.eyebrow'),
    title: t('employees.face.enrollConfirm.title', { name: employee.full_name }),
    message: t('employees.face.enrollConfirm.message'),
    details: [t('employees.face.enrollConfirm.present'), t('employees.face.loggedBy')],
    note: employee.face_status === 'NOT_ENROLLED' ? undefined : t('employees.face.enrollConfirm.replaces'),
    confirmLabel: t('employees.face.enrollConfirm.confirm'),
    confirmIcon: <Camera size={18} />,
  };
}

const loadError = () => t('employees.loadError');
const statusError = () => t('employees.detail.statusError');
const deleteError = () => t('employees.detail.deleteError');
/** Avisos al terminar: se arman al dibujarse (siguen al idioma activo). */
const statusChanged = (active: boolean) => (): SuccessNotice => [t(active ? 'employees.detail.deactivated' : 'employees.detail.activated')];
const deleted = (): SuccessNotice => [t('employees.detail.deleted')];

/** Registro facial del empleado: estado, validación y acciones en persona (registrar o verificar). */
function FaceSection({ employee }: { employee: Employee }) {
  const t = useT();
  const { byCode } = useCatalogs();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const approved = employee.face_status === 'APPROVED';
  // Registrar en persona crea (o reemplaza) su registro facial: se confirma antes de abrir la cámara.
  const enroll = async () => {
    const ok = await confirm(() => enrollConfirm(employee));
    if (ok) void navigate(paths.company.employeeFace(employee.id, 'enroll'));
  };
  return (
    <PanelSection title={t('employees.face.title')} icon={<ScanFace size={20} />} aside={<FaceStatusBadge status={employee.face_status} />}>
      <p className="muted">{byCode('face_statuses', employee.face_status)?.description}</p>
      {employee.face_status === 'REJECTED' && employee.face_rejection_reason && (
        <p className="small">{t('employees.face.reason', { reason: employee.face_rejection_reason })}</p>
      )}
      <p className="small muted inline-note">
        <ShieldCheck size={16} color="var(--success)" />
        <span>
          {employee.headwear_exempt ? `${t('employees.face.privacy')} ${t('employees.face.headwearExempt')}` : t('employees.face.privacy')}
        </span>
      </p>
      <div className="button-row">
        {/* En persona, con la cámara de la empresa: registrar (aprobado al momento) o verificar. */}
        {employee.active && approved && (
          <ButtonLink to={paths.company.employeeFace(employee.id, 'verify')} variant="primary" icon={<UserCheck size={18} />}>
            {t('employees.face.verify')}
          </ButtonLink>
        )}
        {employee.active && (
          <Button variant={approved ? 'ghost' : 'primary'} icon={<Camera size={18} />} onClick={() => void enroll()}>
            {t(approved ? 'employees.face.enrollAgain' : 'employees.face.enroll')}
          </Button>
        )}
        {employee.latest_enrollment_id && (
          <ButtonLink
            to={paths.company.validation(employee.latest_enrollment_id)}
            variant={employee.face_status === 'PENDING_REVIEW' ? 'primary' : 'secondary'}
            icon={<ClipboardCheck size={18} />}
          >
            {t(employee.face_status === 'PENDING_REVIEW' ? 'employees.face.review' : 'employees.face.viewReview')}
          </ButtonLink>
        )}
        {employee.face_status !== 'NOT_ENROLLED' && (
          <ButtonLink to={paths.company.reverifyEmployee(employee.id)} variant="ghost" icon={<RotateCcw size={18} />}>
            {t('employees.face.reverify')}
          </ButtonLink>
        )}
      </div>
    </PanelSection>
  );
}

export function EmployeeDetailPage() {
  const t = useT();
  const { id } = useParams();
  const employeeId = Number(id);
  const navigate = useNavigate();
  const { data: employee, setData, error, retry: load } = useResource((signal) => employeeService.get(employeeId, signal), employeeId, loadError);
  const action = useAction<'status' | 'delete'>();
  const busy = action.busy !== null;
  // Los turnos del empleado se ven solo si el backend le dio al usuario la pantalla de Turnos.

  if (!employee) {
    return error ? (
      <div className="page">
        <Panel>
          <PanelHeader title={t('employees.detail.title')} backTo={paths.company.employees} backLabel={t('employees.back')} />
          <PanelSection>
            <RetryState onRetry={load} />
          </PanelSection>
        </Panel>
      </div>
    ) : (
      <div className="two-columns">
        <SkeletonCard lines={6} />
        <SkeletonCard lines={4} />
      </div>
    );
  }

  // En «Eliminados»: solo sus datos y «Restaurar» (sus secciones ya no existen para el backend).
  if (employee.deleted_at) return <DeletedEmployee employee={employee} onRestored={setData} />;

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={employee.full_name}
          backTo={paths.company.employees}
          backLabel={t('employees.back')}
          subtitle={
            <>
              {employee.employee_number && <span className="badge badge--info badge--plain">{employee.employee_number}</span>}
              <StatusBadge active={employee.active} />
              <FaceStatusBadge status={employee.face_status} />
              {employee.shared_account && (
                <span className="badge badge--info" title={t('employees.detail.sharedAccountHint')}>
                  {t('employees.detail.sharedAccount')}
                </span>
              )}
            </>
          }
          actions={
            <>
              <ButtonLink to={paths.company.editEmployee(employee.id)} variant="primary" icon={<Pencil size={18} />}>
                {t('common.actions.edit')}
              </ButtonLink>
            </>
          }
        />

        <PanelGrid>
          <EmployeeInfo employee={employee} />

          <FaceSection employee={employee} />

          <QrCodePanel employeeId={employee.id} />

          <PanelSection title={t('employees.detail.history')} icon={<Activity size={20} />}>
            <VerificationHistory employeeId={employee.id} />
          </PanelSection>

          {/* Datos del empleado (RGPD arts. 15 y 20): la empresa responde por escrito cuando él los pide. */}
          <DataExportSection subject={{ kind: 'employee', employeeId: employee.id, name: employee.full_name }} />

          <PanelSection title={t('devices.title')} icon={<MonitorSmartphone size={20} />}>
            <p className="muted small">{t('devices.intro')}</p>
            <EmployeeDevices
              filterKey={String(employee.id)}
              load={(query, signal) => employeeDeviceService.list(employee.id, query, signal)}
              decide={(device, decision) => employeeDeviceService.setStatus(employee.id, device.id, decision)}
            />
          </PanelSection>
        </PanelGrid>

        <PanelFooter align="between">
          <Button
            variant={employee.active ? 'warning' : 'success'}
            icon={employee.active ? <Pause size={18} /> : <Play size={18} />}
            loading={action.busy === 'status'}
            disabled={busy}
            onClick={() =>
              void action.run(() => employeeService.setStatus(employee.id, !employee.active), {
                busy: 'status',
                confirm: () => statusConfirm(employee),
                errorTitle: statusError,
                success: statusChanged(employee.active),
                onSuccess: load, // el expediente se vuelve a pedir: el backend decide su estado
              })
            }
          >
            {t(employee.active ? 'employees.detail.deactivate' : 'employees.detail.activate')}
          </Button>
          <Button
            variant="danger-outline"
            icon={<Trash2 size={18} />}
            loading={action.busy === 'delete'}
            disabled={busy}
            onClick={() =>
              void action.run(() => employeeService.remove(employee.id), {
                busy: 'delete',
                confirm: () => deleteConfirm(employee),
                errorTitle: deleteError,
                success: deleted,
                onSuccess: () => void navigate(paths.company.employees, { replace: true }),
                keepBusy: true,
              })
            }
          >
            {t('employees.detail.delete')}
          </Button>
        </PanelFooter>
      </Panel>
    </div>
  );
}
