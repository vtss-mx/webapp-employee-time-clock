import { QrCode } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LiveFaceFlow } from '../../components/LiveFaceFlow';
import { VerificationAttempt } from '../../components/VerificationAttempt';
import { useVerificationPolicy } from '../../hooks/useVerificationPolicy';
import { paths } from '../../routes/paths';
import { errorMessage } from '../../services/apiClient';
import { verificationService } from '../../services/verificationService';
import { config } from '../../utils/config';

export function FaceVerificationPage() {
  const navigate = useNavigate();
  const { policy } = useVerificationPolicy();

  return (
    <VerificationAttempt failureTitle={() => 'No fue posible verificar tu identidad'}>
      {(finish) => (
        <LiveFaceFlow
          title="Verificación facial"
          frontalFrames={config.verificationFrames}
          submittingMessage="Verificando identidad..."
          policy={policy}
          alternative={
            policy.qr_enabled
              ? { label: 'Mostrar mi código QR', icon: <QrCode size={18} />, onSelect: () => void navigate(paths.employee.myQr) }
              : undefined
          }
          onSubmit={async (captured) => {
            const result = await verificationService.verifyFace(captured);
            finish({ result, error: null });
          }}
          onFatal={(error) => finish({ result: null, error: errorMessage(error) })}
          onCancel={() => void navigate(paths.employee.dashboard)}
        />
      )}
    </VerificationAttempt>
  );
}
