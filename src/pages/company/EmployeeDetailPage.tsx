import { Activity, CalendarClock, Camera, ClipboardCheck, Pause, Pencil, Play, RotateCcw, ScanFace, ShieldCheck, Trash2, UserCheck, UserRound } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { VerificationHistory } from '../../components/VerificationHistory';
import { Panel, PanelFooter, PanelGrid, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { QrCodePanel } from '../../components/QrCodePanel';
import { FaceStatusBadge, StatusBadge } from '../../components/StatusBadge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useAction } from '../../hooks/useAction';
import { useAuth } from '../../hooks/useAuth';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useConfirm } from '../../hooks/useConfirm';
import { useResource } from '../../hooks/useResource';
import { RetryState } from '../../components/ui/RetryState';
import { paths } from '../../routes/paths';
import { employeeService } from '../../services/employeeService';
import type { Employee } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import { formatDate, formatDateTime, initials } from '../../utils/format';
import { formatPhone } from '../../utils/phone';

/** Activar o desactivar: qué cambia para el empleado (el estado, "antes → después"). */
function statusConfirm(employee: Employee): ConfirmInput {
  const state = { label: 'Estado', before: employee.active ? 'Activo' : 'Inactivo', after: employee.active ? 'Inactivo' : 'Activo' };
  return employee.active
    ? {
        tone: 'danger',
        icon: <Pause size={30} />,
        eyebrow: 'Cambiar estado',
        title: `¿Desactivar a ${employee.full_name}?`,
        message: 'No podrá iniciar sesión ni verificarse hasta que lo reactives. Su sesión actual se cerrará.',
        changes: [state],
        confirmLabel: 'Desactivar',
        confirmIcon: <Pause size={18} />,
      }
    : {
        tone: 'success',
        icon: <Play size={30} />,
        eyebrow: 'Cambiar estado',
        title: `¿Activar a ${employee.full_name}?`,
        message: 'Podrá volver a iniciar sesión y verificarse.',
        changes: [state],
        confirmLabel: 'Activar',
        confirmIcon: <Play size={18} />,
      };
}

/** Eliminar definitivamente: se escribe su número de empleado para habilitarlo (no se deshace). */
function deleteConfirm(employee: Employee): ConfirmInput {
  return {
    kind: 'delete',
    title: `¿Eliminar a ${employee.full_name}?`,
    message: (
      <>
        Se eliminarán definitivamente su usuario, datos faciales, QR e historial. Si solo deseas bloquear su acceso, usa <em>Desactivar</em>.
      </>
    ),
    details: [
      { label: 'Número de empleado', value: employee.employee_number },
      { label: 'Correo', value: employee.email },
    ],
    note: 'Esta acción no se puede deshacer.',
    confirmText: employee.employee_number,
    confirmLabel: 'Eliminar definitivamente',
  };
}

/** Dato del empleado o "Sin capturar" (empleados registrados antes de existir el campo). */
const orMissing = (value: string | null | undefined) => value || <span className="muted">Sin capturar</span>;

/** Registro facial del empleado: estado, validación y acciones en persona (registrar o verificar). */
function FaceSection({ employee }: { employee: Employee }) {
  const { byCode } = useCatalogs();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const approved = employee.face_status === 'APPROVED';
  // Registrar en persona crea (o reemplaza) su registro facial: se confirma antes de abrir la cámara.
  const enroll = async () => {
    const ok = await confirm({
      kind: 'create',
      icon: <Camera size={30} />,
      eyebrow: 'Registro en persona',
      title: `¿Registrar el rostro de ${employee.full_name}?`,
      message: 'Se abrirá la cámara para capturar su rostro con prueba de vida. Su identidad quedará aprobada al momento porque la registras en persona.',
      details: ['La persona debe estar frente a la cámara, con el rostro descubierto.', 'Queda constancia de quién lo registró.'],
      note: employee.face_status === 'NOT_ENROLLED' ? undefined : 'Su registro facial actual se reemplazará por el nuevo.',
      confirmLabel: 'Abrir cámara',
      confirmIcon: <Camera size={18} />,
    });
    if (ok) void navigate(paths.company.employeeFace(employee.id, 'enroll'));
  };
  return (
    <PanelSection title="Registro facial" icon={<ScanFace size={20} />} aside={<FaceStatusBadge status={employee.face_status} />}>
      <p className="muted">{byCode('face_statuses', employee.face_status)?.description}</p>
      {employee.face_status === 'REJECTED' && employee.face_rejection_reason && (
        <p className="small">Motivo: “{employee.face_rejection_reason}”</p>
      )}
      <p className="small muted inline-note">
        <ShieldCheck size={16} color="var(--success)" />
        <span>
          Solo se guardan vectores biométricos y una foto de referencia, cifrados.
          {employee.headwear_exempt && ' Exento de retirar prenda de cabeza.'}
        </span>
      </p>
      <div className="button-row">
        {/* En persona, con la cámara de la empresa: registrar (aprobado al momento) o verificar. */}
        {employee.active && approved && (
          <ButtonLink to={paths.company.employeeFace(employee.id, 'verify')} variant="primary" icon={<UserCheck size={18} />}>
            Verificar identidad
          </ButtonLink>
        )}
        {employee.active && (
          <Button variant={approved ? 'ghost' : 'primary'} icon={<Camera size={18} />} onClick={() => void enroll()}>
            {approved ? 'Registrar de nuevo en persona' : 'Registrar rostro en persona'}
          </Button>
        )}
        {employee.latest_enrollment_id && (
          <ButtonLink
            to={paths.company.validation(employee.latest_enrollment_id)}
            variant={employee.face_status === 'PENDING_REVIEW' ? 'primary' : 'secondary'}
            icon={<ClipboardCheck size={18} />}
          >
            {employee.face_status === 'PENDING_REVIEW' ? 'Validar identidad' : 'Ver validación'}
          </ButtonLink>
        )}
        {employee.face_status !== 'NOT_ENROLLED' && (
          <ButtonLink to={paths.company.reverifyEmployee(employee.id)} variant="ghost" icon={<RotateCcw size={18} />}>
            Solicitar nueva verificación
          </ButtonLink>
        )}
      </div>
    </PanelSection>
  );
}

export function EmployeeDetailPage() {
  const { id } = useParams();
  const employeeId = Number(id);
  const navigate = useNavigate();
  const { data: employee, error, retry: load } = useResource((signal) => employeeService.get(employeeId, signal), employeeId, 'No se pudo cargar el empleado');
  const action = useAction<'status' | 'delete'>();
  const busy = action.busy !== null;
  // Los turnos del empleado se ven solo si el backend le dio al usuario la pantalla de Turnos.
  const canSeeShifts = useAuth().user?.screens.some((screen) => screen.code === 'COMPANY_SHIFTS') ?? false;

  if (!employee) {
    return error ? (
      <div className="page">
        <Panel>
          <PanelHeader title="Empleado" backTo={paths.company.employees} backLabel="Empleados" />
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

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={employee.full_name}
          backTo={paths.company.employees}
          backLabel="Empleados"
          subtitle={
            <>
              <span className="badge badge--info badge--plain">{employee.employee_number}</span>
              <StatusBadge active={employee.active} />
              <FaceStatusBadge status={employee.face_status} />
              {employee.shared_account && (
                <span className="badge badge--info" title="Trabaja también en otra empresa con la misma cuenta">
                  Cuenta compartida
                </span>
              )}
            </>
          }
          actions={
            <>
              {canSeeShifts && (
                <ButtonLink to={paths.company.employeeShifts(employee.id)} variant="ghost" icon={<CalendarClock size={18} />}>
                  Turnos
                </ButtonLink>
              )}
              <ButtonLink to={paths.company.editEmployee(employee.id)} variant="primary" icon={<Pencil size={18} />}>
                Editar
              </ButtonLink>
            </>
          }
        />

        <PanelGrid>
          <PanelSection
            title="Información"
            icon={<UserRound size={20} />}
            aside={<span className="avatar avatar--lg">{initials(employee.full_name)}</span>}
          >
            <dl className="details">
              <div>
                <dt>Nombres</dt>
                <dd>{employee.first_name}</dd>
              </div>
              <div>
                <dt>Apellidos</dt>
                <dd>{employee.last_name}</dd>
              </div>
              <div>
                <dt>Fecha de nacimiento</dt>
                <dd>{formatDate(employee.birth_date)}</dd>
              </div>
              <div>
                <dt>Número de empleado</dt>
                <dd>{employee.employee_number}</dd>
              </div>
              <div>
                <dt>CURP</dt>
                <dd>{orMissing(employee.curp)}</dd>
              </div>
              <div>
                <dt>RFC</dt>
                <dd>{orMissing(employee.rfc)}</dd>
              </div>
              <div>
                <dt>NSS</dt>
                <dd>{orMissing(employee.nss)}</dd>
              </div>
              <div>
                <dt>Teléfono celular</dt>
                <dd>{orMissing(employee.phone && formatPhone(employee.phone))}</dd>
              </div>
              <div>
                <dt>Correo</dt>
                <dd>{employee.email}</dd>
              </div>
              <div>
                <dt>Departamento</dt>
                <dd>
                  {employee.department_id && employee.department_name ? (
                    <Link to={paths.company.department(employee.department_id)}>{employee.department_name}</Link>
                  ) : (
                    <span className="muted">Sin departamento</span>
                  )}
                </dd>
              </div>
              {employee.managed_departments && employee.managed_departments.length > 0 && (
                <div>
                  <dt>Responsable de</dt>
                  <dd className="inline-links">
                    {employee.managed_departments.map((d) => (
                      <Link key={d.id} to={paths.company.department(d.id)}>
                        {d.name}
                      </Link>
                    ))}
                  </dd>
                </div>
              )}
              <div>
                <dt>Registrado</dt>
                <dd>{formatDateTime(employee.created_at)}</dd>
              </div>
            </dl>
          </PanelSection>

          <FaceSection employee={employee} />

          <QrCodePanel employeeId={employee.id} />

          <PanelSection title="Bitácora de verificaciones" icon={<Activity size={20} />}>
            <VerificationHistory employeeId={employee.id} />
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
                confirm: statusConfirm(employee),
                errorTitle: 'No se pudo completar la acción',
                success: [employee.active ? 'Empleado desactivado' : 'Empleado activado'],
                onSuccess: load, // el expediente se vuelve a pedir: el backend decide su estado
              })
            }
          >
            {employee.active ? 'Desactivar empleado' : 'Activar empleado'}
          </Button>
          <Button
            variant="danger-outline"
            icon={<Trash2 size={18} />}
            loading={action.busy === 'delete'}
            disabled={busy}
            onClick={() =>
              void action.run(() => employeeService.remove(employee.id), {
                busy: 'delete',
                confirm: deleteConfirm(employee),
                errorTitle: 'No se pudo eliminar',
                success: ['Empleado eliminado'],
                onSuccess: () => void navigate(paths.company.employees, { replace: true }),
                keepBusy: true,
              })
            }
          >
            Eliminar definitivamente
          </Button>
        </PanelFooter>
      </Panel>
    </div>
  );
}
