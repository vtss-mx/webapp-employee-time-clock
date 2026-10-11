import { Camera, FileText, X } from 'lucide-react';
import { useCallback, useRef, useState, type CSSProperties } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useDocumentScan } from '../hooks/useDocumentScan';
import { useFeedback } from '../hooks/useFeedback';
import { useMountedRef } from '../hooks/useMountedRef';
import { useT, type MessageKey } from '../i18n';
import type { LazyText } from '../i18n/lazy';
import { CameraNotReadyError } from '../utils/cameraDiagnostics';
import { config } from '../utils/config';
import type { DocGuidance } from '../utils/docQuality';
import { CameraCapture } from './CameraCapture';
import { Button } from './ui/Button';
import { CrossfadeText } from './ui/CrossfadeText';

type Tone = 'idle' | 'warn' | 'ok' | 'busy';

/** Tono (color del aviso y de la guía) de cada indicación; `holdStill` lo decide si el cuadro ya sirve. */
const TONE: Record<Exclude<DocGuidance, 'holdStill'>, Tone> = {
  searching: 'idle',
  tooFar: 'warn',
  tooDark: 'warn',
  tooBright: 'warn',
  glare: 'warn',
  straighten: 'warn',
  capturing: 'busy',
};

/** Texto de cada indicación (el estado guarda el código; el texto se pide al dibujarse, en el idioma activo). */
const GUIDE_KEYS = {
  searching: 'docScan.guide.searching',
  tooFar: 'docScan.guide.tooFar',
  tooDark: 'docScan.guide.tooDark',
  tooBright: 'docScan.guide.tooBright',
  glare: 'docScan.guide.glare',
  straighten: 'docScan.guide.straighten',
  holdStill: 'docScan.guide.holdStill',
  capturing: 'docScan.guide.capturing',
} as const satisfies Record<DocGuidance, MessageKey>;

interface DocumentScannerProps {
  /** La foto tomada como `File` (JPEG), para el mismo estado del formulario que «Elegir archivo». */
  onCapture: (file: File) => void;
  onCancel: () => void;
}

/**
 * Captura con cámara del documento de identidad del empleado (decisión del dueño, 2026-10-07): un escáner en vivo con
 * guía que detecta el documento y toma la foto SOLA cuando llena la guía, está enfocado, con luz, sin reflejos, derecho
 * y quieto (como el escaneo facial, pero para documentos); con un obturador manual «Tomar foto» de respaldo. La foto
 * alimenta la MISMA subida + OCR del servidor que un archivo elegido; la cámara trasera es mejor para un documento.
 *
 * Resiliencia (AGENTS §3): si la cámara no abre (permiso, navegador integrado, lienzo bloqueado…), `CameraCapture`
 * muestra el diagnóstico traducido en un popup y «Cancelar» vuelve a «Elegir archivo» (nunca una cámara colgada ni un
 * callejón sin salida). Un fallo al tomar la foto abre el popup de la app y deja reintentar. Estados fijos y respeto a
 * «reducir movimiento»: la guía no se anima; el aviso usa `CrossfadeText` (inmediato con «reducir movimiento»).
 */
export function DocumentScanner({ onCapture, onCancel }: DocumentScannerProps) {
  const t = useT();
  const camera = useCamera({ facing: 'environment' });
  const feedback = useFeedback();
  const mounted = useMountedRef();
  const [capturing, setCapturing] = useState(false);
  const onCaptureRef = useRef(onCapture);
  onCaptureRef.current = onCapture;

  const take = useCallback(async () => {
    if (capturing) return;
    setCapturing(true);
    try {
      const blob = await camera.captureFrame({ maxSide: config.docScanCapturePx, quality: config.docScanJpegQuality });
      if (!mounted.current) return;
      onCaptureRef.current(new File([blob], `${t('docScan.fileName')}-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    } catch (error) {
      if (!mounted.current) return;
      setCapturing(false);
      // "La cámara aún no da imagen" es pasajero: el escaneo sigue y la persona reintenta (automático o manual).
      if (error instanceof CameraNotReadyError) return;
      void feedback.error(() => t('docScan.captureError'));
    }
  }, [camera, capturing, feedback, mounted, t]);

  const { guidance, acceptable, stalled } = useDocumentScan({
    videoRef: camera.videoRef,
    enabled: camera.status === 'active' && !capturing,
    onAutoCapture: () => void take(),
  });

  const tone: Tone = guidance === 'holdStill' ? (acceptable ? 'ok' : 'warn') : TONE[guidance];
  const message: LazyText = () => t(GUIDE_KEYS[guidance]);
  const shutterReady = (acceptable || stalled) && !capturing && camera.status === 'active';

  return (
    <div className="verify-screen">
      <div className="verify-screen__camera">
        <CameraCapture camera={camera} className="camera--fill">
          <DocGuide tone={tone} message={message} />
        </CameraCapture>
      </div>
      <aside className="verify-screen__panel">
        <h1>{t('docScan.title')}</h1>
        <p className="muted">{t('docScan.subtitle')}</p>
        <p className="inline-note small muted">
          <FileText size={16} /> {t('docScan.cameraFallback')}
        </p>
        <Button variant="primary" size="lg" block icon={<Camera size={20} />} disabled={!shutterReady} loading={capturing} onClick={() => void take()}>
          {t('docScan.take')}
        </Button>
        <Button variant="ghost" size="lg" block icon={<X size={20} />} onClick={onCancel}>
          {t('common.actions.cancel')}
        </Button>
      </aside>
    </div>
  );
}

/**
 * Guía con forma de documento (rectángulo redondeado) sobre el video y la indicación grande debajo. Estados fijos: el
 * color cambia con el tono, sin animación (respeta «reducir movimiento» por construcción). El lado de la guía sale del
 * visor (`--doc-inset`, la misma parte del video que mide `useDocumentScan`) con la relación de aspecto configurada.
 */
function DocGuide({ tone, message }: { tone: Tone; message: LazyText }) {
  return (
    <>
      <div className={`doc-scan doc-scan--${tone}`} style={{ '--doc-aspect': config.docScanGuideAspect } as CSSProperties} aria-hidden>
        <div className="doc-scan__frame" />
      </div>
      <div className={`camera__message camera__message--${tone}`} role="status" aria-live="polite">
        <CrossfadeText className="camera__text" text={message} />
      </div>
    </>
  );
}
