import { useNavigate, useParams } from 'react-router-dom';
import { LiveFaceFlow } from '../../components/LiveFaceFlow';
import { VerificationAttempt } from '../../components/VerificationAttempt';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useFeedback } from '../../hooks/useFeedback';
import { useResource } from '../../hooks/useResource';
import { useVerificationPolicy } from '../../hooks/useVerificationPolicy';
import { paths } from '../../routes/paths';
import { errorMessage } from '../../services/apiClient';
import { employeeService } from '../../services/employeeService';
import { config } from '../../utils/config';

/**
 * La empresa, con el empleado presente y su propia cámara:
 * - /face/enroll: registra su rostro (con prueba de vida) y queda aprobado al momento.
 * - /face/verify: verifica su identidad (rostro 1:1 contra su registro aprobado).
 * La cámara trasera se abre por omisión (en teléfono o tableta se apunta al empleado).
 */
export function EmployeeFacePage() {
  const params = useParams();
  const employeeId = Number(params.id);
  const verify = params.mode === 'verify';
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { policy } = useVerificationPolicy();
  const { data: employee, error, retry: load } = useResource((signal) => employeeService.get(employeeId, signal), employeeId, 'No se pudo cargar el empleado');

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
      <VerificationAttempt failureTitle={() => `No se pudo verificar a ${employee.first_name}`} onBack={back}>
        {(finish) => (
          <LiveFaceFlow
            {...shared}
            title={`Verificar a ${employee.full_name}`}
            frontalFrames={config.verificationFrames}
            submittingMessage="Verificando identidad..."
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
      title={`Registrar el rostro de ${employee.full_name}`}
      frontalFrames={config.enrollmentFrames}
      submittingMessage="Registrando rostro..."
      onSubmit={async (captured) => {
        await employeeService.enrollFaceInPerson(employee.id, captured);
        void feedback.success('Rostro registrado', `${employee.full_name} ya puede identificarse con su rostro.`, {
          details: ['Su identidad quedó aprobada porque la registraste en persona.', 'Queda constancia de quién lo registró.'],
          detailsStyle: 'checks',
        });
        back();
      }}
      onFatal={(err) => {
        void feedback.fromError(err, { title: 'No se pudo registrar el rostro' });
        back();
      }}
    />
  );
}
