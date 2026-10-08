import { Camera, CameraOff, RefreshCw, SwitchCamera } from 'lucide-react';
import { useEffect, useRef, type ReactNode, type SyntheticEvent } from 'react';
import type { CameraController, CameraFacing } from '../hooks/useCamera';
import { useFeedback } from '../hooks/useFeedback';
import { useT, type MessageKey } from '../i18n';
import { cameraProblemKey, cameraProblemMessage } from './cameraMessages';
import { Spinner } from './Spinner';
import { Button } from './ui/Button';
import { Select } from './ui/Select';

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
/** Qué se hace con la cámara, para el mensaje mientras el navegador pide el permiso. */
const REQUEST_TEXT = { user: 'face.camera.request.user', environment: 'face.camera.request.environment' } as const satisfies Record<CameraFacing, MessageKey>;

export function CameraCapture({ camera, children, className = '' }: CameraCaptureProps) {
  const t = useT();
  const { videoRef, status, devices, activeDeviceId, isMirrored, facing } = camera;
  const hasMultiple = devices.length > 1;
  const boxRef = useRef<HTMLDivElement>(null);

  // Al aparecer, el visor queda completo a la vista (si se pulsó "Comenzar" con la página
  // desplazada, la parte superior quedaría oculta bajo el encabezado fijo).
  useEffect(() => {
    boxRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, []);
  useCameraMessages(camera);

  // La relación de aspecto REAL del flujo (16:9 de una computadora portátil, 3:4 o 9:16 de un teléfono, 4:3 de una
  // cámara web) va al visor como variable de CSS (`--video-ar`): con ella el CSS dimensiona el video respecto al
  // círculo de la guía y no al visor (decisión del dueño, 2026-10-07: el campo visual es el mismo en todo dispositivo).
  // Se escribe directo en el elemento (una medida calculada, no un estilo): no vuelve a dibujar nada en React, y solo
  // cambia al abrir el flujo o si el teléfono gira (`resize` del video).
  const readAspect = (event: SyntheticEvent<HTMLVideoElement>) => {
    const { videoWidth, videoHeight } = event.currentTarget;
    if (videoWidth && videoHeight) boxRef.current?.style.setProperty('--video-ar', (videoWidth / videoHeight).toFixed(4));
  };

  return (
    <div ref={boxRef} className={`camera ${className}`}>
      <video
        ref={videoRef}
        className={`camera__video ${isMirrored ? 'camera__video--mirrored' : ''}`}
        autoPlay
        playsInline
        muted
        aria-label={t('face.camera.preview')}
        onLoadedMetadata={readAspect}
        onResize={readAspect}
      />

      {status === 'active' && <div className="camera__overlay">{children}</div>}

      {/* Mientras el navegador muestra su aviso nativo de permiso, el visor explica qué hacer. */}
      {status === 'requesting' && (
        <div className="camera__state camera__state--request" role="status">
          <span className="camera__state-icon camera__state-icon--pulse">
            <Camera size={34} />
          </span>
          <strong>{t('face.camera.requesting')}</strong>
          <p>{t(REQUEST_TEXT[facing])}</p>
          <small>{t('face.camera.permissionHint')}</small>
        </div>
      )}

      {status === 'idle' && (
        <div className="camera__state">
          <Spinner light size={36} />
          <p>{t('face.camera.paused')}</p>
          <Button variant="light" onClick={() => void camera.start(activeDeviceId ?? undefined)}>
            {t('face.camera.activate')}
          </Button>
        </div>
      )}

      {status === 'error' && (
        <div className="camera__state camera__state--error">
          <span className="camera__state-icon">
            <CameraOff size={34} />
          </span>
          <Button variant="light" icon={<RefreshCw size={18} />} onClick={() => void camera.start()}>
            {t('common.actions.retry')}
          </Button>
        </div>
      )}

      {status === 'active' && hasMultiple && (
        <div className="camera__controls">
          <Button className="camera__switch" icon={<SwitchCamera size={20} />} onClick={camera.switchCamera} aria-label={t('face.camera.switch')}>
            <span className="camera__switch-text">{t('face.camera.switch')}</span>
          </Button>
          <Select
            className="camera__select"
            tone="dark"
            menuWidth="content"
            value={activeDeviceId ?? ''}
            onChange={camera.selectCamera}
            aria-label={t('face.camera.select')}
            options={devices.map((d) => ({ value: d.deviceId, label: d.label, title: d.label }))}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Fallas de la cámara (permiso bloqueado, en uso, sin conexión segura...) en el popup de la
 * aplicación. El popup se arma al dibujarse: abierto, sigue al idioma activo.
 */
function useCameraMessages({ status, problem, start }: CameraController) {
  const feedback = useFeedback();

  useEffect(() => {
    if (status !== 'error' || !problem) return;
    void feedback.show(() => cameraProblemMessage(problem)).then((choice) => {
      if (choice === 'retry') void start();
      if (choice === 'secure' && problem.secureUrl) window.location.assign(problem.secureUrl);
    });
    return () => feedback.dismiss(cameraProblemKey(problem));
  }, [status, problem, feedback, start]);
}
