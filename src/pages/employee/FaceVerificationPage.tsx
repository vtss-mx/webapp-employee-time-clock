import { QrCode } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LiveFaceFlow } from '../../components/LiveFaceFlow';
import { locationProblemMessage } from '../../components/location/locationMessages';
import { VerificationAttempt } from '../../components/VerificationAttempt';
import { useFeedback } from '../../hooks/useFeedback';
import { useVerificationPolicy } from '../../hooks/useVerificationPolicy';
import { useWarmLocation } from '../../hooks/useWarmLocation';
import { t, useLocale } from '../../i18n';
import { paths } from '../../routes/paths';
import { errorMessage } from '../../services/apiClient';
import { verificationService } from '../../services/verificationService';
import { config } from '../../utils/config';

export function FaceVerificationPage() {
  useLocale(); // textos con `t` al dibujarse: un cambio de idioma los traduce sin reiniciar el escaneo
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { policy } = useVerificationPolicy();
  // La empresa decide la ubicación de la verificación (decisión del dueño, 2026-10-07): OBSERVE la registra (la empresa
  // ve dónde se hizo en el mapa) y ENFORCE la exige. En ambos modos la app la mantiene "caliente" mientras la pantalla
  // está abierta (aviso NATIVO del navegador al abrir) y la envía con las capturas, igual que el registro de asistencia;
  // nunca bloquea en el cliente: en ENFORCE sin ubicación el servidor responde `LOCATION_REQUIRED` y se muestra como
  // falla (sin reintentar a ciegas). En OFF no se pide ni se envía.
  const mode = policy.verification_location;
  const needLocation = mode === 'OBSERVE' || mode === 'ENFORCE';
  // Solo en ENFORCE se avisa una vez que el permiso está bloqueado (ayuda a resolverlo); en OBSERVE la verificación
  // sigue en silencio sin ubicación (decisión del dueño). Nunca impide verificar: decide el servidor.
  const location = useWarmLocation(needLocation, (problem) => {
    if (mode === 'ENFORCE') void feedback.show(() => locationProblemMessage(problem, 'verification'));
  });

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
            const result = await verificationService.verifyFace(captured, needLocation ? await location.take() : null);
            finish({ result, error: null });
          }}
          onFatal={(error) => finish({ result: null, error: () => errorMessage(error) })}
          onCancel={() => void navigate(paths.employee.dashboard)}
        />
      )}
    </VerificationAttempt>
  );
}
