import { UserX } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { ReasonFormPanel } from '../../components/ReasonFormPanel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useFeedback } from '../../hooks/useFeedback';
import { notifyEnrollmentsChanged } from '../../hooks/usePendingEnrollments';
import { useResource } from '../../hooks/useResource';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { enrollmentService } from '../../services/enrollmentService';
import type { FaceEnrollmentDetail } from '../../types';
import type { ConfirmInput } from '../../types/confirm';

const MIN_REASON = 3;

/** El empleado verá el motivo: es obligatorio. */
const validateReason = (reason: string) => (reason.trim().length < MIN_REASON ? t('enrollments.reject.reasonRequired') : undefined);

/** Antes de rechazar: de quién es el registro, el motivo que verá y que no se puede recuperar. */
function rejectConfirm(item: FaceEnrollmentDetail, reason: string): ConfirmInput {
  return {
    tone: 'danger',
    icon: <UserX size={30} />,
    eyebrow: t('enrollments.reject.confirm.eyebrow'),
    title: t('enrollments.reject.confirm.title', { name: item.full_name }),
    message: t('enrollments.reject.confirm.message'),
    details: [
      { label: t('common.fields.employee'), value: `${item.full_name} · ${item.employee_number}` },
      { label: t('enrollments.reject.confirm.reason'), value: reason },
    ],
    note: t('enrollments.reject.confirm.note'),
    confirmLabel: t('common.actions.reject'),
    confirmIcon: <UserX size={18} />,
  };
}

const loadError = () => t('enrollments.loadError');
const rejectError = () => t('enrollments.reject.error');
/** El aviso al terminar (se arma al dibujarse: sigue al idioma activo). */
const rejected = () => t('enrollments.reject.done');
const rejectedText = (name: string) => () => t('enrollments.reject.doneText', { name });

/** Rechazar un registro facial: el empleado verá el motivo y deberá registrarse de nuevo. */
export function RejectEnrollmentPage() {
  const t = useT();
  const enrollmentId = Number(useParams().id);
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { data: item, error, retry } = useResource((signal) => enrollmentService.get(enrollmentId, signal), enrollmentId, loadError);

  if (!item) return error ? <RetryState onRetry={retry} /> : <SkeletonCard lines={4} />;
  return (
    <ReasonFormPanel
      title={t('enrollments.reject.title')}
      subtitle={`${item.full_name} · ${item.employee_number}`}
      backTo={paths.company.validation(enrollmentId)}
      backLabel={t('enrollments.reject.back')}
      icon={<UserX size={20} />}
      intro={t('enrollments.reject.intro')}
      field={{
        catalog: 'enrollment_rejection_reasons',
        label: t('enrollments.reject.reasonLabel'),
        placeholder: t('enrollments.reject.reasonPlaceholder'),
        required: true,
      }}
      validate={validateReason}
      submit={{ label: t('common.actions.reject'), icon: <UserX size={18} />, variant: 'danger', disabled: item.status !== 'PENDING', disabledTitle: t('enrollments.reject.reviewed') }}
      confirm={(reason) => rejectConfirm(item, reason)}
      errorTitle={rejectError}
      onSend={async (reason) => {
        const res = await enrollmentService.reject(enrollmentId, reason);
        notifyEnrollmentsChanged();
        void feedback.info(rejected, rejectedText(res.full_name));
        void navigate(paths.company.validations);
      }}
      onCancel={() => void navigate(paths.company.validation(enrollmentId))}
    />
  );
}
