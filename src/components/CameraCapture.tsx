import { Camera, CameraOff, RefreshCw, SwitchCamera } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import type { CameraController } from '../hooks/useCamera';
import { useFeedback } from '../hooks/useFeedback';
import { CAMERA_CONSENT_KEY, cameraConsentMessage, cameraProblemMessage } from './cameraMessages';
import { Spinner } from './Spinner';
import { Button } from './ui/Button';

interface CameraCaptureProps {
  camera: CameraController;
  /** Capa superpuesta (guía facial, visor QR, mensajes de estado). */
  children?: ReactNode;
  className?: string;
}

/**
 * Vista de cámara reutilizable: video en vivo, estados de permisos/errores y
 * controles para cambiar o seleccionar entre las cámaras disponibles.
 * La lógica (permisos, enumeración, MediaStream) vive en el hook useCamera.
 */
export function CameraCapture({ camera, children, className = '' }: CameraCaptureProps) {
  const { videoRef, status, devices, activeDeviceId, isMirrored } = camera;
  const hasMultiple = devices.length > 1;
  const boxRef = useRef<HTMLDivElement>(null);

  // Al aparecer, el visor queda completo a la vista (si se pulsó "Comenzar" con la página
  // desplazada, la parte superior quedaría oculta bajo el encabezado fijo).
  useEffect(() => {
    boxRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, []);
  useCameraMessages(camera);

  return (
    <div ref={boxRef} className={`camera ${className}`}>
      <video
        ref={videoRef}
        className={`camera__video ${isMirrored ? 'camera__video--mirrored' : ''}`}
        autoPlay
        playsInline
        muted
        aria-label="Vista previa de la cámara"
      />

      {status === 'active' && <div className="camera__overlay">{children}</div>}

      {(status === 'requesting' || status === 'idle') && (
        <div className="camera__state">
          <Spinner light size={36} />
          <p>{status === 'requesting' ? 'Solicitando acceso a la cámara...' : 'Cámara en pausa'}</p>
          {status === 'idle' && (
            <Button variant="light" onClick={() => void camera.start(activeDeviceId ?? undefined)}>
              Activar cámara
            </Button>
          )}
        </div>
      )}

      {/* Explicación y fallas van en el popup; aquí solo queda la acción. */}
      {status === 'consent' && (
        <div className="camera__state">
          <span className="camera__state-icon">
            <Camera size={34} />
          </span>
          <Button variant="light" icon={<Camera size={18} />} onClick={camera.requestAccess}>
            Permitir acceso a la cámara
          </Button>
        </div>
      )}

      {status === 'error' && (
        <div className="camera__state camera__state--error">
          <span className="camera__state-icon">
            <CameraOff size={34} />
          </span>
          <Button variant="light" icon={<RefreshCw size={18} />} onClick={() => void camera.start()}>
            Reintentar
          </Button>
        </div>
      )}

      {status === 'active' && hasMultiple && (
        <div className="camera__controls">
          <Button className="camera__switch" icon={<SwitchCamera size={20} />} onClick={camera.switchCamera} aria-label="Cambiar cámara">
            <span className="camera__switch-text">Cambiar cámara</span>
          </Button>
          <select
            className="camera__select"
            value={activeDeviceId ?? ''}
            onChange={(e) => camera.selectCamera(e.target.value)}
            aria-label="Seleccionar cámara"
          >
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId} title={d.rawLabel}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}


/** Permiso previo y fallas de la cámara, presentados en el popup de mensajes de la aplicación. */
function useCameraMessages({ status, problem, facing, requestAccess, start }: CameraController) {
  const feedback = useFeedback();

  useEffect(() => {
    if (status !== 'consent') return;
    void feedback.show(cameraConsentMessage(facing)).then((choice) => choice === 'allow' && requestAccess());
    return () => feedback.dismiss(CAMERA_CONSENT_KEY); // al salir de la pantalla
  }, [status, facing, feedback, requestAccess]);

  useEffect(() => {
    if (status !== 'error' || !problem) return;
    const message = cameraProblemMessage(problem);
    void feedback.show(message).then((choice) => {
      if (choice === 'retry') void start();
      if (choice === 'secure' && problem.secureUrl) window.location.assign(problem.secureUrl);
    });
    return () => feedback.dismiss(message.key ?? '');
  }, [status, problem, feedback, start]);
}
