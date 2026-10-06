import { ShieldCheck, X } from 'lucide-react';
import { useCallback, useState, type ReactNode } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useQrScanner } from '../hooks/useQrScanner';
import { useMountedRef } from '../hooks/useMountedRef';
import { useT } from '../i18n';
import { config } from '../utils/config';
import { CameraCapture } from './CameraCapture';
import { QrGuide } from './FaceGuide';
import { Button } from './ui/Button';

type Phase = 'scanning' | 'invalid' | 'busy';

interface QrScanPanelProps {
  title: string;
  description: ReactNode;
  /** Mensaje mientras se procesa el código leído (por omisión, "QR detectado. Verificando..."). */
  busyMessage?: string;
  /** Mensaje con un código que no es de la app (por omisión, usar el código generado para la cuenta). */
  invalidMessage?: string;
  /** Qué hacer con el código leído; mientras se resuelve, la lectura se pausa. */
  onScan: (content: string) => Promise<void>;
  onCancel: () => void;
  /** Texto del botón para salir (por omisión, "Cancelar"). */
  cancelLabel?: string;
  /** Qué códigos se aceptan (por omisión, los de la app: `config.qrPrefix`); otro se descarta al instante. */
  accept?: (content: string) => boolean;
  /** Más opciones bajo la descripción (p. ej. escribir el código a mano). */
  children?: ReactNode;
}

/** Los QR de la app: con su prefijo y de un largo razonable. */
const appQr = (content: string) => content.startsWith(config.qrPrefix) && content.length <= 512;

/**
 * Lectura de un código QR con la cámara (trasera por omisión): credencial impresa o mostrada en
 * otro teléfono. La lectura es automática; el formato se valida localmente y el backend decide.
 */
export function QrScanPanel({ title, description, busyMessage, invalidMessage, onScan, onCancel, cancelLabel, accept = appQr, children }: QrScanPanelProps) {
  const t = useT();
  const camera = useCamera({ facing: 'environment' });
  const [phase, setPhase] = useState<Phase>('scanning');
  const mounted = useMountedRef();

  const onDetect = useCallback(
    async (content: string) => {
      if (!accept(content)) {
        setPhase('invalid');
        window.setTimeout(() => mounted.current && setPhase('scanning'), 2000);
        return;
      }
      setPhase('busy');
      await onScan(content);
      if (mounted.current) setPhase('scanning');
    },
    [accept, mounted, onScan],
  );

  useQrScanner({ videoRef: camera.videoRef, enabled: camera.status === 'active' && phase === 'scanning', onDetect });

  const message =
    phase === 'busy' ? (busyMessage ?? t('qr.scan.busy')) : phase === 'invalid' ? (invalidMessage ?? t('qr.scan.invalid')) : t('qr.scan.aim');
  const tone = phase === 'busy' ? 'busy' : phase === 'invalid' ? 'warn' : 'idle';

  return (
    <div className="verify-screen">
      <div className="verify-screen__camera">
        <CameraCapture camera={camera} className="camera--fill">
          <QrGuide message={message} tone={tone} />
        </CameraCapture>
      </div>
      <aside className="verify-screen__panel">
        <h1>{title}</h1>
        <p className="muted">{description}</p>
        <p className="inline-note small muted">
          <ShieldCheck size={16} color="var(--success)" /> {t('qr.scan.noPersonalData')}
        </p>
        {children}
        <Button variant="ghost" size="lg" block icon={<X size={20} />} onClick={onCancel}>
          {cancelLabel ?? t('common.actions.cancel')}
        </Button>
      </aside>
    </div>
  );
}
