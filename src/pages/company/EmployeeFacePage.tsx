import { useNavigate, useParams } from 'react-router-dom';
import { LiveFaceFlow } from '../../components/LiveFaceFlow';
import { enrollmentCapture } from '../../components/liveFaceView';
import type { MessageInput } from '../../components/MessageDialog';
import { VerificationAttempt } from '../../components/VerificationAttempt';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useFeedback } from '../../hooks/useFeedback';
import { useResource } from '../../hooks/useResource';
import { useVerificationPolicy } from '../../hooks/useVerificationPolicy';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { errorMessage } from '../../services/apiClient';
import { employeeService } from '../../services/employeeService';
import type { Employee } from '../../types';
import { config } from '../../utils/config';

const loadError = () => t('employees.loadError');
const verifyFailed = (employee: Employee) => () => t('employees.face.verifyFailed', { name: employee.first_name });
const enrollError = () => t('employees.face.enrollError');

/** Aviso al registrar en persona: queda aprobado al momento y con constancia de quién lo hizo. */
const enrolledMessage = (employee: Employee): MessageInput => ({
  variant: 'success',
  title: t('employees.face.enrolled'),
  text: t('employees.face.enrolledText', { name: employee.full_name }),
  details: [t('employees.face.approved'), t('employees.face.loggedBy')],
  detailsStyle: 'checks',
});

/**
 * La empresa, con el empleado presente y su propia cámara:
 * - /face/enroll: registra su rostro (con prueba de vida) y queda aprobado al momento.
 * - /face/verify: verifica su identidad (rostro 1:1 contra su registro aprobado).
 * La cámara trasera se abre por omisión (en teléfono o tableta se apunta al empleado).
 */
export function EmployeeFacePage() {
  const t = useT();
  const params = useParams();
  const employeeId = Number(params.id);
  const verify = params.mode === 'verify';
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { policy } = useVerificationPolicy();
  const { data: employee, error, retry: load } = useResource((signal) => employeeService.get(employeeId, signal), employeeId, loadError);

  const back = () => void navigate(paths.company.employee(employeeId));
  if (!employee) return error ? <RetryState onRetry={load} /> : <SkeletonCard lines={6} />;

  const shared = {
    facing: 'environment' as const,
    allowHeadwear: employee.headwear_exempt,
    policy,
    onCancel: back,
  };

  if (verify) {
    return (
      <VerificationAttempt failureTitle={verifyFailed(employee)} onBack={back}>
        {(finish) => (
          <LiveFaceFlow
            {...shared}
            title={t('employees.face.verifyTitle', { name: employee.full_name })}
            frontalFrames={config.verificationFrames}
            submittingMessage={t('employees.face.verifying')}
            onSubmit={async (captured) => finish({ result: await employeeService.verifyFaceInPerson(employee.id, captured), error: null })}
            onFatal={(err) => finish({ result: null, error: errorMessage(err) })}
          />
        )}
      </VerificationAttempt>
    );
  }

  return (
    <LiveFaceFlow
      {...shared}
      title={t('employees.face.enrollTitle', { name: employee.full_name })}
      {...enrollmentCapture()}
      submittingMessage={t('employees.face.enrolling')}
      onSubmit={async (captured) => {
        await employeeService.enrollFaceInPerson(employee.id, captured);
        void feedback.show(() => enrolledMessage(employee));
        back();
      }}
      onFatal={(err) => {
        void feedback.fromError(err, { title: enrollError });
        back();
      }}
    />
  );
}
