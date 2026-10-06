import { QrCode } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LiveFaceFlow } from '../../components/LiveFaceFlow';
import { VerificationAttempt } from '../../components/VerificationAttempt';
import { useVerificationPolicy } from '../../hooks/useVerificationPolicy';
import { t, useLocale } from '../../i18n';
import { paths } from '../../routes/paths';
import { errorMessage } from '../../services/apiClient';
import { verificationService } from '../../services/verificationService';
import { config } from '../../utils/config';

export function FaceVerificationPage() {
  useLocale(); // textos con `t` al dibujarse: un cambio de idioma los traduce sin reiniciar el escaneo
  const navigate = useNavigate();
  const { policy } = useVerificationPolicy();

  return (
    <VerificationAttempt failureTitle={() => t('employee.verify.failed')}>
      {(finish) => (
        <LiveFaceFlow
          title={t('employee.verify.title')}
          frontalFrames={config.verificationFrames}
          submittingMessage={t('employee.verify.submitting')}
          policy={policy}
          alternative={
            policy.qr_enabled
              ? { label: t('employee.verify.showQr'), icon: <QrCode size={18} />, onSelect: () => void navigate(paths.employee.myQr) }
              : undefined
          }
          onSubmit={async (captured) => {
            const result = await verificationService.verifyFace(captured);
            finish({ result, error: null });
          }}
          onFatal={(error) => finish({ result: null, error: () => errorMessage(error) })}
          onCancel={() => void navigate(paths.employee.dashboard)}
        />
      )}
    </VerificationAttempt>
  );
}
