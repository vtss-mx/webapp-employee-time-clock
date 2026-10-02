import { ShieldCheck, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useQrScanner } from '../hooks/useQrScanner';
import { config } from '../utils/config';
import { CameraCapture } from './CameraCapture';
import { QrGuide } from './FaceGuide';
import { Button } from './ui/Button';

type Phase = 'scanning' | 'invalid' | 'busy';

interface QrScanPanelProps {
  title: string;
  description: ReactNode;
  /** Mensaje mientras se procesa el código leído. */
  busyMessage?: string;
  invalidMessage?: string;
  /** Qué hacer con el código leído; mientras se resuelve, la lectura se pausa. */
  onScan: (content: string) => Promise<void>;
  onCancel: () => void;
  cancelLabel?: string;
}

/**
 * Lectura de un código QR con la cámara (trasera por omisión): credencial impresa o mostrada en
 * otro teléfono. La lectura es automática; el formato se valida localmente y el backend decide.
 */
export function QrScanPanel({
  title,
  description,
  busyMessage = 'QR detectado. Verificando...',
  invalidMessage = 'QR inválido. Usa el código generado para tu cuenta',
  onScan,
  onCancel,
  cancelLabel = 'Cancelar',
}: QrScanPanelProps) {
  const camera = useCamera({ facing: 'environment' });
  const [phase, setPhase] = useState<Phase>('scanning');
  const mounted = useRef(true);
  useEffect(() => () => void (mounted.current = false), []);

  const onDetect = useCallback(
    async (content: string) => {
      if (!content.startsWith(config.qrPrefix) || content.length > 512) {
        setPhase('invalid');
        window.setTimeout(() => mounted.current && setPhase('scanning'), 2000);
        return;
      }
      setPhase('busy');
      await onScan(content);
      if (mounted.current) setPhase('scanning');
    },
    [onScan],
  );

  useQrScanner({ videoRef: camera.videoRef, enabled: camera.status === 'active' && phase === 'scanning', onDetect });

  const message = phase === 'busy' ? busyMessage : phase === 'invalid' ? invalidMessage : 'Apunta la cámara al código QR';
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
          <ShieldCheck size={16} color="var(--success)" /> El código no contiene datos personales.
        </p>
        <Button variant="ghost" size="lg" block icon={<X size={20} />} onClick={onCancel}>
          {cancelLabel}
        </Button>
      </aside>
    </div>
  );
}
