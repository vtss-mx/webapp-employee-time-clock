import { QrCode } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LiveFaceFlow } from '../../components/LiveFaceFlow';
import { VerificationAttempt } from '../../components/VerificationAttempt';
import { useAuth } from '../../hooks/useAuth';
import { useVerificationPolicy } from '../../hooks/useVerificationPolicy';
import { paths } from '../../routes/paths';
import { errorMessage } from '../../services/apiClient';
import { verificationService } from '../../services/verificationService';
import { config } from '../../utils/config';

export function FaceVerificationPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { policy } = useVerificationPolicy();

  return (
    <VerificationAttempt failureTitle={() => 'No fue posible verificar tu identidad'}>
      {(finish) => (
        <LiveFaceFlow
          title="Verificación facial"
          description={`Hola ${user?.employee?.first_name ?? ''}. Mira de frente a la cámara; después se te pedirá girar la cabeza para confirmar que eres una persona real.`}
          frontalFrames={config.verificationFrames}
          finalStep="Verificación"
          submittingMessage="Verificando identidad..."
          policy={policy}
          headwearExempt={user?.employee?.headwear_exempt}
          alternative={
            policy.qr_enabled
              ? { label: 'Identificarme con QR', icon: <QrCode size={18} />, onSelect: () => void navigate(paths.employee.verifyQr) }
              : undefined
          }
          onSubmit={async ({ frontal, challenge }) => {
            const result = await verificationService.verifyFace(frontal, challenge);
            finish({ result, error: null });
          }}
          onFatal={(error) => finish({ result: null, error: errorMessage(error) })}
          onCancel={() => void navigate(paths.employee.dashboard)}
        />
      )}
    </VerificationAttempt>
  );
}
