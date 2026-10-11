import { QrCode } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LiveFaceFlow } from '../../components/LiveFaceFlow';
import { locationProblemMessage, verificationLocationMessage } from '../../components/location/locationMessages';
import { VerificationAttempt, type VerificationOutcome } from '../../components/VerificationAttempt';
import { useAuth } from '../../hooks/useAuth';
import { useFeedback } from '../../hooks/useFeedback';
import { useMountedRef } from '../../hooks/useMountedRef';
import { useVerificationPolicy } from '../../hooks/useVerificationPolicy';
import { useWarmLocation } from '../../hooks/useWarmLocation';
import { t, useLocale } from '../../i18n';
import { paths } from '../../routes/paths';
import { ApiError } from '../../services/apiClient';
import { verificationService } from '../../services/verificationService';
import { verificationFailure } from '../../utils/verificationOutcome';
import { config } from '../../utils/config';

/** El registro facial del empleado ya no sirve para verificar: no está aprobado o no existe. */
const FACE_NOT_READY: ReadonlySet<string> = new Set(['FACE_NOT_APPROVED', 'FACE_NOT_REGISTERED']);

export function FaceVerificationPage() {
  useLocale(); // textos con `t` al dibujarse: un cambio de idioma los traduce sin reiniciar el escaneo
  const navigate = useNavigate();
  const feedback = useFeedback();
  const mounted = useMountedRef();
  const { refreshUser } = useAuth();
  const { policy } = useVerificationPolicy();
  // La empresa decide la ubicación de la verificación (decisión del dueño, 2026-10-07): OBSERVE la registra (la empresa
  // ve dónde se hizo en el mapa) y ENFORCE la exige. En ambos modos la app la mantiene "caliente" mientras la pantalla
  // está abierta (aviso NATIVO del navegador al abrir) y la envía con las capturas, igual que el registro de asistencia;
  // nunca bloquea en el cliente: en ENFORCE sin ubicación válida el servidor responde `LOCATION_REQUIRED`/`LOCATION_INVALID`
  // y se ofrece reintentar con una lectura nueva (como el registro de asistencia). En OFF no se pide ni se envía.
  const mode = policy.verification_location;
  const needLocation = mode === 'OBSERVE' || mode === 'ENFORCE';
  // Solo en ENFORCE se avisa una vez que el permiso está bloqueado (ayuda a resolverlo); en OBSERVE la verificación
  // sigue en silencio sin ubicación (decisión del dueño). Nunca impide verificar: decide el servidor.
  const location = useWarmLocation(needLocation, (problem) => {
    if (mode === 'ENFORCE') void feedback.show(() => locationProblemMessage(problem, 'verification'));
  });
  // Cada reintento por ubicación vuelve a montar el escaneo (toma una lectura nueva y libera la cámara anterior).
  const [scan, setScan] = useState(0);

  /**
   * Error no corregible del flujo facial. Antes de darlo por fallido:
   * - Ubicación obligatoria (ENFORCE): se ofrece reintentar con una lectura nueva (`verificationLocationMessage`).
   * - Registro facial no aprobado o inexistente: se refresca al usuario (el backend recalcula sus pantallas) y se va
   *   al registro, en lugar de un reintento que nunca pasaría.
   */
  const onFatal = async (error: unknown, finish: (outcome: VerificationOutcome) => void) => {
    const retry = verificationLocationMessage(error);
    if (retry) {
      const choice = await feedback.show(retry);
      if (choice === 'retry' && mounted.current) setScan((n) => n + 1);
      return;
    }
    if (error instanceof ApiError && FACE_NOT_READY.has(error.code)) {
      await refreshUser().catch(() => undefined);
      if (mounted.current) void navigate(paths.employee.enroll, { replace: true });
      return;
    }
    finish(verificationFailure(error));
  };

  return (
    <VerificationAttempt failureTitle={() => t('employee.verify.failed')}>
      {(finish) => (
        <LiveFaceFlow
          key={scan}
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
          onFatal={(error) => void onFatal(error, finish)}
          onCancel={() => void navigate(paths.employee.dashboard)}
        />
      )}
    </VerificationAttempt>
  );
}
