import { Activity, BrainCircuit, Camera, ClipboardCheck, Eraser, Pause, Pencil, Play, RotateCcw, ScanFace, ShieldCheck, Trash2, UserCheck, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '../../components/Modal';
import { VerificationHistory } from '../../components/VerificationHistory';
import { Panel, PanelFooter, PanelGrid, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { QrCodePanel } from '../../components/QrCodePanel';
import { FaceStatusBadge, StatusBadge } from '../../components/StatusBadge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useAction } from '../../hooks/useAction';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useResource } from '../../hooks/useResource';
import { RetryState } from '../../components/ui/RetryState';
import { paths } from '../../routes/paths';
import { employeeService } from '../../services/employeeService';
import type { Employee } from '../../types';
import { formatDate, formatDateTime, initials, timeAgo } from '../../utils/format';
import { formatPhone } from '../../utils/phone';

type Confirm = 'status' | 'delete' | 'forget' | null;

/** Dato del empleado o "Sin capturar" (empleados registrados antes de existir el campo). */
const orMissing = (value: string | null | undefined) => value || <span className="muted">Sin capturar</span>;

/** Lo que el reconocimiento aprendió del uso del empleado (galería evolutiva del backend). */
function LearningNote({ employee, onForget }: { employee: Employee; onForget: () => void }) {
  const learned = employee.face_learned_samples;
  return (
    <div className="learning-note">
      <p className="small muted inline-note">
        <BrainCircuit size={16} color="var(--primary)" />
        <span>
          {learned > 0
            ? `Aprendizaje continuo: ${learned} ${learned === 1 ? 'muestra aprendida' : 'muestras aprendidas'} de sus identificaciones seguras (la última ${timeAgo(employee.face_last_learned_at)}).`
            : 'Aprendizaje continuo: aprenderá de sus identificaciones seguras para reconocerle mejor con el tiempo.'}
        </span>
      </p>
      {learned > 0 && (
        <Button variant="ghost" size="sm" icon={<Eraser size={16} />} onClick={onForget}>
          Olvidar lo aprendido
        </Button>
      )}
    </div>
  );
}

/** Registro facial del empleado: estado, validación y acciones en persona (registrar o verificar). */
function FaceSection({ employee, onForget }: { employee: Employee; onForget: () => void }) {
  const { byCode } = useCatalogs();
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
      {employee.face_status === 'APPROVED' && <LearningNote employee={employee} onForget={onForget} />}
      <div className="button-row">
        {/* En persona, con la cámara de la empresa: registrar (aprobado al momento) o verificar. */}
        {employee.active && employee.face_status === 'APPROVED' && (
          <ButtonLink to={paths.company.employeeFace(employee.id, 'verify')} variant="primary" icon={<UserCheck size={18} />}>
            Verificar identidad
          </ButtonLink>
        )}
        {employee.active && (
          <ButtonLink
            to={paths.company.employeeFace(employee.id, 'enroll')}
            variant={employee.face_status === 'APPROVED' ? 'ghost' : 'primary'}
            icon={<Camera size={18} />}
          >
            {employee.face_status === 'APPROVED' ? 'Registrar de nuevo en persona' : 'Registrar rostro en persona'}
          </ButtonLink>
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
  const [confirm, setConfirm] = useState<Confirm>(null);
  const action = useAction();
  const busy = action.busy !== null;
  const close = () => setConfirm(null);

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
            <ButtonLink to={paths.company.editEmployee(employee.id)} variant="primary" icon={<Pencil size={18} />}>
              Editar
            </ButtonLink>
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

          <FaceSection employee={employee} onForget={() => setConfirm('forget')} />

          <QrCodePanel employeeId={employee.id} />

          <PanelSection title="Bitácora de verificaciones" icon={<Activity size={20} />}>
            <VerificationHistory employeeId={employee.id} />
          </PanelSection>
        </PanelGrid>

        <PanelFooter align="between">
          <Button
            variant={employee.active ? 'warning' : 'success'}
            icon={employee.active ? <Pause size={18} /> : <Play size={18} />}
            onClick={() => setConfirm('status')}
          >
            {employee.active ? 'Desactivar empleado' : 'Activar empleado'}
          </Button>
          <Button variant="danger-outline" icon={<Trash2 size={18} />} onClick={() => setConfirm('delete')}>
            Eliminar definitivamente
          </Button>
        </PanelFooter>
      </Panel>

      <ConfirmDialog
        open={confirm === 'status'}
        title={employee.active ? 'Desactivar empleado' : 'Activar empleado'}
        message={
          employee.active
            ? 'El empleado no podrá iniciar sesión ni verificarse hasta que se reactive. Su sesión actual se cerrará.'
            : 'El empleado podrá volver a iniciar sesión y verificarse.'
        }
        confirmLabel={employee.active ? 'Desactivar' : 'Activar'}
        tone={employee.active ? 'danger' : 'success'}
        loading={busy}
        onCancel={close}
        onConfirm={() =>
          action.run(() => employeeService.setStatus(employee.id, !employee.active), {
            errorTitle: 'No se pudo completar la acción',
            success: [employee.active ? 'Empleado desactivado' : 'Empleado activado'],
            onSuccess: load, // el expediente se vuelve a pedir: el backend decide su estado
            onSettled: close,
          })
        }
      />

      <ConfirmDialog
        open={confirm === 'forget'}
        title="Olvidar lo aprendido"
        message={
          <>
            Se borrarán las muestras que el reconocimiento aprendió de las identificaciones de <strong>{employee.full_name}</strong>.
            Volverá a compararse solo con su registro aprobado: no tendrá que registrarse de nuevo. Úsalo si dudas de alguna
            identificación.
          </>
        }
        confirmLabel="Olvidar lo aprendido"
        tone="danger"
        loading={busy}
        onCancel={close}
        onConfirm={() =>
          action.run(() => employeeService.forgetLearnedFace(employee.id), {
            errorTitle: 'No se pudo olvidar lo aprendido',
            success: ['Aprendizaje reiniciado', 'Se compara solo con su registro aprobado; volverá a aprender de sus identificaciones seguras.'],
            onSuccess: load,
            onSettled: close,
          })
        }
      />

      <ConfirmDialog
        open={confirm === 'delete'}
        title="Eliminar empleado"
        message={
          <>
            Se eliminará definitivamente a <strong>{employee.full_name}</strong>, su usuario, datos faciales, QR e
            historial. Esta acción no se puede deshacer. Si solo deseas bloquear su acceso, usa <em>Desactivar</em>.
          </>
        }
        confirmLabel="Eliminar definitivamente"
        tone="danger"
        loading={busy}
        onCancel={close}
        onConfirm={() =>
          action.run(() => employeeService.remove(employee.id), {
            errorTitle: 'No se pudo eliminar',
            success: ['Empleado eliminado'],
            onSuccess: () => void navigate(paths.company.employees, { replace: true }),
            onError: close,
            keepBusy: true,
          })
        }
      />
    </div>
  );
}
