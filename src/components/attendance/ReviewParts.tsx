import { CheckCheck, ShieldQuestion, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAction } from '../../hooks/useAction';
import { useCatalogs } from '../../hooks/useCatalogs';
import { notifyAttendanceReviewsChanged } from '../../hooks/usePendingAttendanceReviews';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { attendanceService } from '../../services/attendanceService';
import type { CompanySessionDetail, WorkSession } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import { employeeLabel } from '../../utils/employeeLabel';
import { formatDate, formatDateTime } from '../../utils/format';
import { formatList } from '../../utils/numbers';
import { CatalogStatusBadge } from '../StatusBadge';
import { Button } from '../ui/Button';

/** "En revisión", "Confirmado" o "Rechazado" (catálogo `attendance_review_statuses`); nada si no hubo revisión. */
export function ReviewBadge({ session }: { session: Pick<WorkSession, 'review_status'> }) {
  if (!session.review_status) return null;
  return <CatalogStatusBadge catalog="attendance_review_statuses" code={session.review_status} />;
}

/**
 * La revisión dentro del resumen de la jornada: su estado, por qué (los motivos de negocio del catálogo
 * `review_reasons`, solo para la empresa: el backend no se los manda al empleado) y la nota de la empresa al decidir
 * (que el empleado sí ve). Nada si el motor de riesgo no la dejó en revisión.
 */
export function ReviewFact({ session }: { session: WorkSession }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  if (!session.review_status) return null;
  const reasons = (session.review_reasons ?? []).map((code) => nameOf('review_reasons', code));
  const decided = session.reviewed_at ? t('attendance.review.decidedAt', { date: formatDateTime(session.reviewed_at) }) : null;
  return (
    <div className="att-summary__review">
      <dt>{t('attendance.review.label')}</dt>
      <dd>
        <span className="att-fact">
          <ReviewBadge session={session} />
          {session.review_status === 'PENDING' && <span className="small muted">{t('attendance.review.pendingHint')}</span>}
        </span>
        {reasons.length > 0 && <span className="att-fact__note">{t('attendance.review.reasons', { reasons: formatList(reasons) })}</span>}
        {session.review_note && <span className="att-fact__note">{t('attendance.review.note', { note: session.review_note })}</span>}
        {decided && <span className="att-fact__note">{decided}</span>}
      </dd>
    </div>
  );
}

const confirmError = () => t('attendance.review.confirmError');

/** Confirmar el registro: de quién y qué día, y que queda como válido (sin aviso al empleado). */
function confirmReview(session: CompanySessionDetail, current: string, next: string): ConfirmInput {
  return {
    kind: 'edit',
    tone: 'success',
    icon: <CheckCheck size={30} />,
    eyebrow: t('attendance.review.eyebrow'),
    title: t('attendance.review.confirmTitle', { name: session.employee.full_name }),
    message: t('attendance.review.confirmMessage'),
    changes: [{ label: t('attendance.review.label'), before: current, after: next }],
    details: [
      { label: t('common.fields.employee'), value: employeeLabel(session.employee) },
      { label: t('common.fields.date'), value: formatDate(session.work_date) },
    ],
    confirmLabel: t('attendance.review.confirm'),
    confirmIcon: <CheckCheck size={18} />,
  };
}

/**
 * Las acciones de una jornada "en revisión" (solo la empresa): confirmarla (se confirma antes) o rechazarla (un
 * formulario con la nota que verá el empleado). Rechazar no la borra: queda marcada y se corrige si hace falta.
 */
export function ReviewActions({ session, onChange }: { session: CompanySessionDetail; onChange: (session: CompanySessionDetail) => void }) {
  const t = useT();
  const navigate = useNavigate();
  const { nameOf } = useCatalogs();
  const { busy, run } = useAction();
  if (session.review_status !== 'PENDING') return null;

  const confirm = () =>
    void run(() => attendanceService.review(session.id, 'CONFIRMED', null), {
      confirm: () => confirmReview(session, nameOf('attendance_review_statuses', 'PENDING'), nameOf('attendance_review_statuses', 'CONFIRMED')),
      errorTitle: confirmError,
      // Sin aviso de éxito: la insignia ya dice "Confirmado".
      onSuccess: (saved) => {
        onChange(saved);
        notifyAttendanceReviewsChanged();
      },
    });

  return (
    <div className="att-review">
      <p className="small">
        <ShieldQuestion size={16} /> {t('attendance.review.intro')}
      </p>
      <div className="button-row">
        <Button variant="success" icon={<CheckCheck size={18} />} loading={busy !== null} onClick={confirm}>
          {t('attendance.review.confirm')}
        </Button>
        <Button variant="danger-outline" icon={<XCircle size={18} />} disabled={busy !== null} onClick={() => void navigate(paths.company.rejectAttendanceReview(session.id))}>
          {t('attendance.review.reject')}
        </Button>
      </div>
    </div>
  );
}
