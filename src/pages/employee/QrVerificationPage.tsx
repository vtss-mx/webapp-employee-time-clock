import { useNavigate } from 'react-router-dom';
import { QrScanPanel } from '../../components/QrScanPanel';
import { VerificationAttempt } from '../../components/VerificationAttempt';
import { paths } from '../../routes/paths';
import { errorMessage } from '../../services/apiClient';
import { verificationService } from '../../services/verificationService';

export function QrVerificationPage() {
  const navigate = useNavigate();
  return (
    <VerificationAttempt failureTitle={(outcome) => outcome.result?.message ?? 'QR no reconocido'}>
      {(finish) => (
        <QrScanPanel
          title="Verificación por QR"
          description={
            <>
              Coloca el código QR de tu credencial dentro del recuadro. La lectura es automática. Si tu dispositivo tiene
              varias cámaras, usa <strong>Cambiar cámara</strong>.
            </>
          }
          onScan={async (content) => {
            try {
              finish({ result: await verificationService.verifyQr(content), error: null });
            } catch (error) {
              finish({ result: null, error: errorMessage(error) });
            }
          }}
          onCancel={() => void navigate(paths.employee.dashboard)}
        />
      )}
    </VerificationAttempt>
  );
}
