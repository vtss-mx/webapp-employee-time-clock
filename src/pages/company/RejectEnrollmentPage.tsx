import { UserX } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ReasonFormPanel } from '../../components/ReasonFormPanel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useFeedback } from '../../hooks/useFeedback';
import { notifyEnrollmentsChanged } from '../../hooks/usePendingEnrollments';
import { useResource } from '../../hooks/useResource';
import { paths } from '../../routes/paths';
import { enrollmentService } from '../../services/enrollmentService';

const MIN_REASON = 3;

/** Rechazar un registro facial: el empleado verá el motivo y deberá registrarse de nuevo. */
export function RejectEnrollmentPage() {
  const enrollmentId = Number(useParams().id);
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { data: item, error, retry } = useResource(() => enrollmentService.get(enrollmentId), enrollmentId, 'No se pudo cargar la solicitud');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const invalid = reason.trim().length < MIN_REASON;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (invalid) return;
    setSaving(true);
    try {
      const res = await enrollmentService.reject(enrollmentId, reason.trim());
      notifyEnrollmentsChanged();
      void feedback.info('Usuario rechazado', `${res.full_name} deberá registrar su rostro nuevamente.`);
      void navigate(paths.company.validations);
    } catch (err) {
      setSaving(false);
      void feedback.fromError(err, { title: 'No se pudo rechazar' });
    }
  };

  if (!item) return error ? <RetryState onRetry={retry} /> : <SkeletonCard lines={4} />;
  return (
    <ReasonFormPanel
      title="Rechazar usuario"
      subtitle={`${item.full_name} · ${item.employee_number}`}
      backTo={paths.company.validation(enrollmentId)}
      backLabel="Solicitud"
      icon={<UserX size={20} />}
      intro="Se eliminarán la fotografía y los datos biométricos de este registro. El empleado verá el motivo y deberá registrarse de nuevo."
      field={{
        catalog: 'enrollment_rejection_reasons',
        label: 'Motivo (visible para el empleado)',
        placeholder: 'Describe por qué se rechaza el registro',
        required: true,
        error: touched && invalid ? 'Escribe o elige el motivo del rechazo' : undefined,
      }}
      reason={reason}
      onReason={setReason}
      submit={{ label: 'Rechazar', icon: <UserX size={18} />, variant: 'danger', disabled: item.status !== 'PENDING', disabledTitle: 'Este registro ya fue revisado' }}
      saving={saving}
      onSubmit={(e) => void submit(e)}
      onCancel={() => void navigate(paths.company.validation(enrollmentId))}
    />
  );
}
