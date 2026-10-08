import { XCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { ReasonFormPanel } from '../../../components/ReasonFormPanel';
import { RetryState } from '../../../components/ui/RetryState';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { useFeedback } from '../../../hooks/useFeedback';
import { notifyAttendanceReviewsChanged } from '../../../hooks/usePendingAttendanceReviews';
import { useResource } from '../../../hooks/useResource';
import { t, useT } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { attendanceService } from '../../../services/attendanceService';
import type { CompanySessionDetail } from '../../../types';
import type { ConfirmInput } from '../../../types/confirm';
import { employeeLabel } from '../../../utils/employeeLabel';
import { formatDate } from '../../../utils/format';

const MIN_NOTE = 3;
/** El empleado verá la nota: es obligatoria (el backend también la exige). */
const validateNote = (note: string) => (note.trim().length < MIN_NOTE ? t('attendance.review.rejectPage.required') : undefined);
const loadError = () => t('attendance.detail.loadError');
const rejectError = () => t('attendance.review.rejectPage.error');

/** Antes de rechazar: de quién y qué día, la nota que verá y que la jornada no se borra. */
function rejectConfirm(session: CompanySessionDetail, note: string): ConfirmInput {
  return {
    tone: 'danger',
    icon: <XCircle size={30} />,
    eyebrow: t('attendance.review.eyebrow'),
    title: t('attendance.review.rejectPage.confirmTitle', { name: session.employee.full_name }),
    message: t('attendance.review.rejectPage.confirmMessage'),
    details: [
      { label: t('common.fields.employee'), value: employeeLabel(session.employee) },
      { label: t('common.fields.date'), value: formatDate(session.work_date) },
      { label: t('attendance.review.rejectPage.label'), value: note },
    ],
    confirmLabel: t('attendance.review.reject'),
    confirmIcon: <XCircle size={18} />,
  };
}

/**
 * Rechazar una jornada que el motor de riesgo dejó "en revisión" (COMPANY): la nota es obligatoria y la verá el
 * empleado. La jornada no se borra: queda marcada como rechazada y se corrige con el registro manual si hace falta.
 */
export function RejectAttendanceReviewPage() {
  const t = useT();
  const sessionId = Number(useParams().id);
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { data: session, error, retry } = useResource((signal) => attendanceService.session(sessionId, signal), sessionId, loadError);
  const back = paths.company.attendanceSession(sessionId);

  if (!session) return error ? <RetryState onRetry={retry} /> : <SkeletonCard lines={4} />;
  return (
    <ReasonFormPanel
      title={t('attendance.review.rejectPage.title')}
      subtitle={`${session.employee.full_name} · ${formatDate(session.work_date)}`}
      backTo={back}
      backLabel={t('attendance.nav.session')}
      icon={<XCircle size={20} />}
      intro={t('attendance.review.rejectPage.intro')}
      field={{ label: t('attendance.review.rejectPage.label'), placeholder: t('attendance.review.rejectPage.placeholder'), required: true }}
      validate={validateNote}
      submit={{
        label: t('attendance.review.reject'),
        icon: <XCircle size={18} />,
        variant: 'danger',
        disabled: session.review_status !== 'PENDING',
        disabledTitle: t('attendance.review.rejectPage.decided'),
      }}
      confirm={(note) => () => rejectConfirm(session, note)}
      errorTitle={rejectError}
      onSend={async (note) => {
        await attendanceService.review(session.id, 'REJECTED', note);
        notifyAttendanceReviewsChanged();
        void feedback.info(
          () => t('attendance.review.rejectPage.done'),
          () => t('attendance.review.rejectPage.doneText', { name: session.employee.full_name }),
        );
        void navigate(back);
      }}
      onCancel={() => void navigate(back)}
    />
  );
}
