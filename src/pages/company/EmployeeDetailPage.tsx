import { Activity, ClipboardCheck, Pause, Pencil, Play, RotateCcw, ScanFace, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '../../components/Modal';
import { ReverifyIdentityModal } from '../../components/ReverifyIdentityModal';
import { Panel, PanelFooter, PanelGrid, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { QrCodePanel } from '../../components/QrCodePanel';
import { FaceStatusBadge, StatusBadge } from '../../components/StatusBadge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useErrorPopup, useFeedback } from '../../hooks/useFeedback';
import { RetryState } from '../../components/ui/RetryState';
import { paths } from '../../routes/paths';
import { employeeService } from '../../services/employeeService';
import type { Employee, VerificationLog } from '../../types';
import { formatConfidence, formatDate, formatDateTime, initials } from '../../utils/format';
import { formatPhone } from '../../utils/phone';

type Confirm = 'status' | 'delete' | 'resetFace' | null;

/** Dato del empleado o "Sin capturar" (empleados registrados antes de existir el campo). */
const orMissing = (value: string | null | undefined) => value || <span className="muted">Sin capturar</span>;

/** Bitácora del empleado: método y motivo de cada intento con sus nombres del catálogo. */
function VerificationHistory({ history }: { history: VerificationLog[] }) {
  const { nameOf } = useCatalogs();
  if (history.length === 0) return <p className="muted">Sin registros todavía.</p>;
  return (
    <ul className="log-list">
      {history.map((log) => (
        <li key={log.id}>
          <span className={`icon-tile ${log.success ? 'icon-tile--success' : 'icon-tile--danger'}`} style={{ width: 36, height: 36 }}>
            {log.method === 'FACE' ? <ScanFace size={18} /> : <ShieldCheck size={18} />}
          </span>
          <div style={{ flex: 1 }}>
            <strong>{nameOf('verification_methods', log.method)}</strong> ·{' '}
            {log.success ? 'Exitosa' : nameOf('verification_reasons', log.reason, 'Fallida')}
            {log.score != null && <span className="muted"> · Confianza {formatConfidence(log.score)}</span>}
            <div className="muted small">{formatDateTime(log.created_at)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function EmployeeDetailPage() {
  const { id } = useParams();
  const employeeId = Number(id);
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { byCode } = useCatalogs();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [history, setHistory] = useState<VerificationLog[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [emp, logs] = await Promise.all([employeeService.get(employeeId), employeeService.history(employeeId, 10)]);
      setEmployee(emp);
      setHistory(logs);
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, [employeeId]);
  useErrorPopup(error, { title: 'No se pudo cargar el empleado', retry: () => void load() });

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async (action: () => Promise<unknown>, success: string, detail?: string) => {
    setBusy(true);
    try {
      await action();
      feedback.success(success, detail);
      setConfirm(null);
      await load();
    } catch (e) {
      void feedback.fromError(e, { title: 'No se pudo completar la acción' });
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  if (!employee) {
    return error ? (
      <div className="page">
        <Panel>
          <PanelHeader title="Empleado" backTo={paths.company.employees} backLabel="Empleados" />
          <PanelSection>
            <RetryState onRetry={() => void load()} />
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
                <dt>Registrado</dt>
                <dd>{formatDateTime(employee.created_at)}</dd>
              </div>
            </dl>
          </PanelSection>

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
                <Button variant="ghost" icon={<RotateCcw size={18} />} onClick={() => setConfirm('resetFace')}>
                  Solicitar nueva verificación
                </Button>
              )}
            </div>
          </PanelSection>

          <QrCodePanel
            employeeId={employee.id}
            employeeName={employee.full_name}
            hasActiveQr={employee.has_active_qr}
            onChanged={load}
          />

          <PanelSection title="Últimas verificaciones" icon={<Activity size={20} />}>
            <VerificationHistory history={history} />
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
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          runAction(
            () => employeeService.setStatus(employee.id, !employee.active),
            employee.active ? 'Empleado desactivado' : 'Empleado activado',
          )
        }
      />

      <ReverifyIdentityModal
        open={confirm === 'resetFace'}
        firstName={employee.first_name}
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={(reason) =>
          runAction(
            () => employeeService.resetFace(employee.id, reason),
            'Verificación solicitada',
            `${employee.full_name} deberá registrar su rostro de nuevo en su próximo acceso.`,
          )
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
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await employeeService.remove(employee.id);
            feedback.success('Empleado eliminado');
            void navigate(paths.company.employees, { replace: true });
          } catch (e) {
            void feedback.fromError(e, { title: 'No se pudo eliminar' });
            setConfirm(null);
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
