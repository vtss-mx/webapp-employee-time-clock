import { useCallback, useEffect, useRef, useState } from 'react';
import { preferenceStore } from '../utils/storage';
import { describeCameraProblem, errorKind, type CameraProblem, type CameraProblemKind } from '../utils/cameraDiagnostics';
import {
  activeKind,
  cameraConstraints,
  kindLabel,
  parseRemembered,
  rememberedFor,
  shouldMirror,
  switchTarget,
  toCameraDevices,
  type CameraDevice,
  type CameraFacing,
  type CameraKind,
  type CameraTarget,
} from '../utils/cameraDevices';

export type { CameraDevice, CameraFacing } from '../utils/cameraDevices';
/** requesting: abriendo la cámara (incluye el aviso nativo de permiso del navegador, si aplica). */
export type CameraStatus = 'idle' | 'requesting' | 'active' | 'error';

export interface UseCameraOptions {
  /** Cámara preferida al iniciar: frontal para rostro, trasera para QR. */
  facing: CameraFacing;
  autoStart?: boolean;
}

export interface CaptureOptions {
  maxSide?: number;
  quality?: number;
}

export interface CameraController {
  videoRef: React.RefObject<HTMLVideoElement>;
  facing: CameraFacing;
  status: CameraStatus;
  error: string | null;
  /** Causa del error con los pasos para resolverla según sistema operativo y navegador. */
  problem: CameraProblem | null;
  devices: CameraDevice[];
  activeDeviceId: string | null;
  /** Nombre de la cámara abierta ("Cámara frontal", "Cámara trasera"...), para el visor. */
  activeLabel: string;
  /** Nombre real que da el sistema a la cámara abierta (detecta cámaras virtuales; viaja con las capturas). */
  trackLabel: string;
  isMirrored: boolean;
  start: (deviceId?: string) => Promise<void>;
  /** Abre la cámara del propósito (la recordada si le sirve); el navegador pide el permiso. */
  requestAccess: () => void;
  stop: () => void;
  switchCamera: () => void;
  selectCamera: (deviceId: string) => void;
  captureFrame: (options?: CaptureOptions) => Promise<Blob>;
}

/** Cámara que realmente abrió el navegador: su id (para recordarla o volver a ella) y su lado. */
function openedCamera(stream: MediaStream, requestedId?: string): { id: string | null; kind: CameraKind; label: string } {
  const track = stream.getVideoTracks()[0];
  const settings = track?.getSettings() ?? {};
  const label = track?.label ?? '';
  return { id: settings.deviceId ?? requestedId ?? null, kind: activeKind(settings.facingMode, label), label };
}

function isMissingDeviceError(err: unknown): boolean {
  return err instanceof Error && ['OverconstrainedError', 'NotFoundError'].includes(err.name);
}

async function attachStream(video: HTMLVideoElement, stream: MediaStream): Promise<void> {
  video.srcObject = stream;
  video.muted = true;
  video.setAttribute('playsinline', 'true'); // iOS: evita pantalla completa
  await video.play().catch(() => undefined);
}

/**
 * Manejo completo de cámara con MediaDevices/getUserMedia:
 * permisos, enumeración, selección/cambio de cámara, captura de frames y liberación
 * del MediaStream (MediaStreamTrack.stop()) al salir o al ocultar la página.
 */
export function useCamera({ facing, autoStart = true }: UseCameraOptions): CameraController {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestIdRef = useRef(0);
  const activeDeviceRef = useRef<string | null>(null);
  const pausedByVisibilityRef = useRef(false);
  const prefKey = `tc.camera.${facing}`;

  const [status, setStatus] = useState<CameraStatus>('idle');
  const [problem, setProblem] = useState<CameraProblem | null>(null);
  const error = problem?.message ?? null;
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [isMirrored, setIsMirrored] = useState(false);
  const [kind, setKind] = useState<CameraKind>('unknown');
  const [trackLabel, setTrackLabel] = useState('');
  const kindRef = useRef<CameraKind>('unknown');

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const fail = useCallback((kind: CameraProblemKind) => {
    setStatus('error');
    setProblem(describeCameraProblem(kind));
  }, []);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const all = await navigator.mediaDevices.enumerateDevices();
    const list = toCameraDevices(all.filter((d) => d.kind === 'videoinput' && d.deviceId));
    setDevices(list);
    return list;
  }, []);

  const open = useCallback(
    async (target: CameraTarget = {}): Promise<void> => {
      const requestId = ++requestIdRef.current;
      setProblem(null);

      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        fail(window.isSecureContext ? 'unsupported' : 'insecure');
        return;
      }

      // Liberar la cámara anterior antes de abrir otra (obligatorio en iOS y muchos Android).
      releaseStream();
      setStatus('requesting');

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(cameraConstraints(facing, target));
      } catch (err) {
        // Si la cámara pedida ya no existe (o ese lado no existe), abrir la del propósito.
        if ((target.deviceId || target.facing) && isMissingDeviceError(err)) {
          if (requestId === requestIdRef.current) return open({});
          return;
        }
        if (requestId === requestIdRef.current) fail(errorKind(err));
        return;
      }

      // Una petición más reciente (cambio de cámara, desmontaje) invalida esta.
      if (requestId !== requestIdRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) await attachStream(videoRef.current, stream);

      const opened = openedCamera(stream, target.deviceId);
      activeDeviceRef.current = opened.id;
      kindRef.current = opened.kind;
      setActiveDeviceId(opened.id);
      setKind(opened.kind);
      setTrackLabel(opened.label);
      // Se recuerda con su lado: solo se reabre si sirve para este propósito (rememberedFor).
      if (opened.id) preferenceStore.set(prefKey, JSON.stringify({ deviceId: opened.id, kind: opened.kind }));

      // Tras conceder permiso, enumerateDevices ya devuelve etiquetas reales.
      const list = await refreshDevices().catch(() => [] as CameraDevice[]);
      if (requestId !== requestIdRef.current) return;

      setIsMirrored(shouldMirror(opened.kind, facing, list.length));
      setStatus('active');
    },
    [facing, fail, prefKey, refreshDevices, releaseStream],
  );

  const stop = useCallback(() => {
    requestIdRef.current++;
    releaseStream();
    setStatus('idle');
  }, [releaseStream]);

  const start = useCallback((deviceId?: string) => open({ deviceId }), [open]);
  const selectCamera = useCallback((deviceId: string) => void open({ deviceId }), [open]);
  const requestAccess = useCallback(
    () => void open({ deviceId: rememberedFor(parseRemembered(preferenceStore.get(prefKey)), facing) }),
    [facing, open, prefKey],
  );

  // Teléfono: alterna frontal ↔ trasera (lente principal). Computadora: siguiente webcam.
  const switchCamera = useCallback(() => {
    const target = switchTarget(devices, activeDeviceRef.current, kindRef.current);
    if (target) void open(target);
  }, [devices, open]);

  const captureFrame = useCallback(async ({ maxSide = 1280, quality = 0.92 }: CaptureOptions = {}) => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth) throw new Error('La cámara aún no está lista');
    const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo procesar la imagen');
    // Se captura la imagen real (sin espejo), que es la que procesa el backend.
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo capturar la imagen'))),
        'image/jpeg',
        quality,
      ),
    );
  }, []);

  // Inicio automático (con la última cámara elegida para este propósito) y limpieza al desmontar.
  useEffect(() => {
    // El permiso lo pide el navegador (aviso nativo); mientras tanto el visor explica qué hacer.
    if (autoStart) requestAccess();
    const requests = requestIdRef; // invalida un start() pendiente al desmontar
    return () => {
      requests.current++;
      releaseStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Liberar la cámara si la pestaña/app pasa a segundo plano y reanudar al volver.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && streamRef.current) {
        pausedByVisibilityRef.current = true;
        requestIdRef.current++;
        releaseStream();
        setStatus('idle');
      } else if (!document.hidden && pausedByVisibilityRef.current) {
        pausedByVisibilityRef.current = false;
        void start(activeDeviceRef.current ?? undefined);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [releaseStream, start]);

  // Cámaras conectadas/desconectadas (USB, Continuity Camera, etc.).
  useEffect(() => {
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return;
    const onChange = () => void refreshDevices().catch(() => undefined);
    md.addEventListener('devicechange', onChange);
    return () => md.removeEventListener('devicechange', onChange);
  }, [refreshDevices]);

  return {
    videoRef,
    facing,
    status,
    error,
    problem,
    devices,
    activeDeviceId,
    activeLabel: kindLabel(kind),
    trackLabel,
    isMirrored,
    start,
    requestAccess,
    stop,
    switchCamera,
    selectCamera,
    captureFrame,
  };
}
