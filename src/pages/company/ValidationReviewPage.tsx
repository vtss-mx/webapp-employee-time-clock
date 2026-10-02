import { AlertTriangle, Camera, Check, CheckCircle2, ImageOff, ShieldCheck, UserCheck, UserX, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog, Modal } from '../../components/Modal';
import { FieldLabel } from '../../components/FormField';
import { ReasonChips } from '../../components/ReasonChips';
import { Panel, PanelFooter, PanelGrid, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { EnrollmentBadge } from '../../components/StatusBadge';
import { Button } from '../../components/ui/Button';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { useCatalogs } from '../../hooks/useCatalogs';
import { notifyEnrollmentsChanged } from '../../hooks/usePendingEnrollments';
import { useErrorPopup, useFeedback } from '../../hooks/useFeedback';
import { RetryState } from '../../components/ui/RetryState';
import { paths } from '../../routes/paths';
import { enrollmentService } from '../../services/enrollmentService';
import type { FaceEnrollmentDetail } from '../../types';
import type { CatalogApi } from '../../utils/catalogs';
import { ageFrom, formatDate, formatDateTime, formatPercent } from '../../utils/format';

/** Marcas del análisis automático (catálogo enrollment_flags): nombre corto y explicación para el revisor. */
function describeFlags(flags: string[], { byCode }: CatalogApi): Array<{ code: string; name: string; detail: string }> {
  return flags.map((code) => {
    const flag = byCode('enrollment_flags', code);
    const name = flag?.name ?? code;
    return { code, name, detail: flag?.description ?? name };
  });
}

/** Revisión de identidad: foto de referencia vs. datos del empleado → Aceptar / Rechazar. */
export function ValidationReviewPage() {
  const { id } = useParams();
  const enrollmentId = Number(id);
  const navigate = useNavigate();
  const feedback = useFeedback();
  const catalogs = useCatalogs();
  const [item, setItem] = useState<FaceEnrollmentDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reload, setReload] = useState(0);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);

  useEffect(() => {
    setError(null);
    enrollmentService.get(enrollmentId).then(setItem).catch(setError);
  }, [enrollmentId, reload]);
  useErrorPopup(error, { title: 'No se pudo cargar la solicitud', retry: () => setReload((n) => n + 1) });

  const flags = item?.flagged_accessories ?? [];
  const flagged = describeFlags(flags, catalogs);
  const accessoryFlagged = flags.some((code) => catalogs.byCode('accessories', code));
  const spoofFlag = flags.includes('SPOOF');

  // Alertas del análisis automático: se avisan en un popup al abrir una solicitud pendiente.
  useEffect(() => {
    if (item?.status !== 'PENDING') return;
    const reasons = describeFlags(item.flagged_accessories ?? [], catalogs).map((flag) => flag.detail);
    if (reasons.length === 0) return;
    void feedback.warning('Revisa la fotografía con atención', 'Acepta solo si la foto muestra claramente el rostro descubierto de la persona.', {
      details: reasons,
      key: `review-flags-${item.id}`,
    });
  }, [item, feedback, catalogs]);

  const approve = async () => {
    setBusy('approve');
    try {
      const res = await enrollmentService.approve(enrollmentId);
      notifyEnrollmentsChanged();
      feedback.success('Usuario aceptado', `${res.full_name} ya puede identificarse.`);
      void navigate(paths.company.validations);
    } catch (e) {
      void feedback.fromError(e, { title: 'No se pudo aceptar' });
      setConfirmApprove(false);
    } finally {
      setBusy(null);
    }
  };

  const reject = async () => {
    if (reason.trim().length < 3) return;
    setBusy('reject');
    try {
      const res = await enrollmentService.reject(enrollmentId, reason.trim());
      notifyEnrollmentsChanged();
      void feedback.info('Usuario rechazado', `${res.full_name} deberá registrar su rostro nuevamente.`);
      void navigate(paths.company.validations);
    } catch (e) {
      void feedback.fromError(e, { title: 'No se pudo rechazar' });
    } finally {
      setBusy(null);
    }
  };

  if (error) {
    return (
      <div className="page">
        <Panel>
          <PanelHeader title="Validación de identidad" backTo={paths.company.validations} backLabel="Validaciones" />
          <PanelSection>
            <RetryState onRetry={() => setReload((n) => n + 1)} />
          </PanelSection>
        </Panel>
      </div>
    );
  }
  if (!item) {
    return (
      <div className="page">
        <Panel>
          <PanelGrid>
            <PanelSection>
              <SkeletonRows rows={6} />
            </PanelSection>
            <PanelSection>
              <SkeletonRows rows={6} />
            </PanelSection>
          </PanelGrid>
        </Panel>
      </div>
    );
  }

  const pending = item.status === 'PENDING';
  const checks = [
    'Un solo rostro detectado',
    accessoryFlagged ? null : 'Sin accesorios que oculten el rostro (según la política vigente)',
    spoofFlag ? null : 'Rostro real frente a la cámara (anti-spoofing)',
    `${item.samples} muestras consistentes entre sí`,
    item.liveness_passed ? 'Prueba de vida superada (giro de cabeza)' : null,
    `Calidad de captura ${formatPercent(item.quality_score)}`,
  ].filter(Boolean) as string[];

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title="Validación de identidad"
          backTo={paths.company.validations}
          backLabel="Validaciones"
          subtitle={
            <>
              <EnrollmentBadge status={item.status} /> Enviado el {formatDateTime(item.submitted_at)}
            </>
          }
        />

        <PanelGrid>
          <PanelSection title="Fotografía de referencia" icon={<Camera size={20} />}>
            <div className="review__photo">
              {item.photo ? (
                <img src={item.photo} alt={`Registro facial de ${item.full_name}`} />
              ) : (
                <div className="camera__state">
                  <span className="camera__state-icon">
                    <ImageOff size={32} />
                  </span>
                  <p>La fotografía se eliminó porque el registro fue rechazado.</p>
                </div>
              )}
              <span className="review__photo-tag">
                <Camera size={14} /> Captura en vivo del empleado
              </span>
            </div>
            <p className="small muted inline-note">
              <ShieldCheck size={16} color="var(--success)" /> Imagen cifrada en reposo. Solo visible para administradores.
            </p>
          </PanelSection>

          <PanelSection
            title="Datos del empleado"
            icon={<UserCheck size={20} />}
            aside={
              <Link to={paths.company.employee(item.employee_id)} className="btn btn--link btn--sm">
                Ver expediente
              </Link>
            }
          >
            <dl className="details">
              <div>
                <dt>Nombre completo</dt>
                <dd>{item.full_name}</dd>
              </div>
              <div>
                <dt>Número de empleado</dt>
                <dd>{item.employee_number}</dd>
              </div>
              <div>
                <dt>Fecha de nacimiento</dt>
                <dd>
                  {formatDate(item.birth_date)} · {ageFrom(item.birth_date)} años
                </dd>
              </div>
              <div>
                <dt>Correo</dt>
                <dd>{item.email}</dd>
              </div>
            </dl>

            <h3 className="panel__section-title">
              <CheckCircle2 size={20} /> Verificaciones automáticas
            </h3>
            <ul className="checklist stagger">
              {/* Lo que el análisis marcó para revisar (dato de la solicitud, no un aviso). */}
              {flagged.map((flag) => (
                <li key={flag.code} className="checklist__warn" title={flag.detail}>
                  <AlertTriangle size={18} /> {flag.name}
                </li>
              ))}
              {checks.map((c) => (
                <li key={c}>
                  <Check size={18} /> {c}
                </li>
              ))}
            </ul>

            {!pending && (
              <dl className="details">
                <div>
                  <dt>Resolución</dt>
                  <dd>
                    {catalogs.nameOf('enrollment_statuses', item.status)} por {item.reviewed_by ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt>Fecha de revisión</dt>
                  <dd>{formatDateTime(item.reviewed_at)}</dd>
                </div>
                {item.rejection_reason && (
                  <div>
                    <dt>Motivo</dt>
                    <dd>“{item.rejection_reason}”</dd>
                  </div>
                )}
              </dl>
            )}
          </PanelSection>
        </PanelGrid>

        {pending && (
          <PanelFooter>
            <Button variant="danger-outline" size="lg" icon={<UserX size={20} />} onClick={() => setRejectOpen(true)}>
              Rechazar usuario
            </Button>
            <Button variant="success" size="lg" icon={<UserCheck size={20} />} onClick={() => setConfirmApprove(true)}>
              Aceptar usuario
            </Button>
          </PanelFooter>
        )}
      </Panel>

      <ConfirmDialog
        open={confirmApprove}
        title="Aceptar usuario"
        tone="success"
        message={
          <>
            Confirmas que la persona de la fotografía es <strong>{item.full_name}</strong>. Podrá identificarse con su
            rostro o su código QR.
          </>
        }
        confirmLabel="Sí, aceptar"
        loading={busy === 'approve'}
        onConfirm={approve}
        onCancel={() => setConfirmApprove(false)}
      />

      <Modal
        open={rejectOpen}
        title="Rechazar usuario"
        variant="error"
        icon={<UserX size={30} />}
        eyebrow="Validación de identidad"
        onClose={() => busy === null && setRejectOpen(false)}
        footer={
          <>
            <Button variant="ghost" icon={<X size={18} />} onClick={() => setRejectOpen(false)} disabled={busy !== null}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              icon={<UserX size={18} />}
              loading={busy === 'reject'}
              disabled={reason.trim().length < 3}
              onClick={reject}
            >
              Rechazar
            </Button>
          </>
        }
      >
        <div className="stack">
          <p className="muted">
            Se eliminarán la fotografía y los datos biométricos de este registro. El empleado verá el motivo y deberá
            registrarse de nuevo.
          </p>
          <ReasonChips catalog="enrollment_rejection_reasons" value={reason} onPick={setReason} />
          <div className="field">
            <FieldLabel htmlFor="reject-reason" label="Motivo (visible para el empleado)" required />
            <textarea
              id="reject-reason"
              className="textarea"
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe por qué se rechaza el registro"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
