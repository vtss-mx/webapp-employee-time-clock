import { useCallback, useEffect, useRef, useState } from 'react';
import { preferenceStore } from '../utils/storage';
import { describeCameraProblem, errorKind, type CameraProblem, type CameraProblemKind } from '../utils/cameraDiagnostics';

export type CameraFacing = 'user' | 'environment';
/** consent: aún no hay permiso; se muestra la explicación previa antes del aviso del navegador. */
export type CameraStatus = 'idle' | 'consent' | 'requesting' | 'active' | 'error';

export interface CameraDevice {
  deviceId: string;
  label: string;
  rawLabel: string;
  kind: 'front' | 'back' | 'unknown';
}

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
  isMirrored: boolean;
  start: (deviceId?: string) => Promise<void>;
  /** El usuario aceptó la explicación previa: se pide el permiso al navegador. */
  requestAccess: () => void;
  stop: () => void;
  switchCamera: () => void;
  selectCamera: (deviceId: string) => void;
  captureFrame: (options?: CaptureOptions) => Promise<Blob>;
}

/** Ya se concedió el permiso en este navegador (respaldo donde no existe la Permissions API). */
const GRANTED_KEY = 'tc.camera.granted';

/** Estado del permiso sin mostrar ningún aviso. 'unknown' si el navegador no lo informa (Firefox). */
export async function cameraPermission(): Promise<PermissionState | 'unknown'> {
  try {
    const result = await navigator.permissions?.query({ name: 'camera' as PermissionName });
    return result?.state ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

const FRONT_RE = /front|frontal|user|selfie|delantera|facing front|facetime/i;
const BACK_RE = /back|rear|trasera|posterior|environment|facing back/i;

function detectKind(label: string): CameraDevice['kind'] {
  if (FRONT_RE.test(label)) return 'front';
  if (BACK_RE.test(label)) return 'back';
  return 'unknown';
}

/** Etiquetas legibles: "Cámara frontal", "Cámara trasera 2", "Cámara 1"... */
function toCameraDevices(inputs: MediaDeviceInfo[]): CameraDevice[] {
  const counters = { front: 0, back: 0, unknown: 0 };
  const totals = { front: 0, back: 0, unknown: 0 };
  inputs.forEach((d) => totals[detectKind(d.label)]++);
  return inputs.map((d) => {
    const kind = detectKind(d.label);
    const n = ++counters[kind];
    const base = kind === 'front' ? 'Cámara frontal' : kind === 'back' ? 'Cámara trasera' : 'Cámara';
    const label = kind === 'unknown' ? `${base} ${n}` : totals[kind] > 1 ? `${base} ${n}` : base;
    return { deviceId: d.deviceId, label, rawLabel: d.label, kind };
  });
}

function cameraConstraints(facing: string, deviceId?: string): MediaStreamConstraints {
  const size = { width: { ideal: 1280 }, height: { ideal: 720 } };
  return {
    audio: false,
    video: deviceId ? { ...size, deviceId: { exact: deviceId } } : { ...size, facingMode: { ideal: facing } },
  };
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

/** Espejo solo para cámara frontal (o webcam única de laptop/PC). */
export function shouldMirror(facingMode: string | undefined, label: string, facing: string, deviceCount: number): boolean {
  const kind = facingMode ? (facingMode === 'user' ? 'front' : 'back') : detectKind(label);
  return kind === 'front' || (kind === 'unknown' && facing === 'user' && deviceCount <= 1);
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

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const fail = useCallback((kind: CameraProblemKind) => {
    if (kind === 'denied') preferenceStore.remove(GRANTED_KEY); // ya no está concedido
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

  const start = useCallback(
    async (deviceId?: string) => {
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
        stream = await navigator.mediaDevices.getUserMedia(cameraConstraints(facing, deviceId));
      } catch (err) {
        // Si la cámara recordada ya no existe, reintentar con la preferencia de orientación.
        if (deviceId && isMissingDeviceError(err)) {
          if (requestId === requestIdRef.current) return start(undefined);
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
      preferenceStore.set(GRANTED_KEY, '1');
      if (videoRef.current) await attachStream(videoRef.current, stream);

      const track = stream.getVideoTracks()[0];
      const settings = track?.getSettings() ?? {};
      const currentId = settings.deviceId ?? deviceId ?? null;
      activeDeviceRef.current = currentId;
      setActiveDeviceId(currentId);
      if (currentId) preferenceStore.set(prefKey, currentId);

      // Tras conceder permiso, enumerateDevices ya devuelve etiquetas reales.
      const list = await refreshDevices().catch(() => [] as CameraDevice[]);
      if (requestId !== requestIdRef.current) return;

      setIsMirrored(shouldMirror(settings.facingMode, track?.label ?? '', facing, list.length));
      setStatus('active');
    },
    [facing, fail, prefKey, refreshDevices, releaseStream],
  );

  const stop = useCallback(() => {
    requestIdRef.current++;
    releaseStream();
    setStatus('idle');
  }, [releaseStream]);

  const selectCamera = useCallback((deviceId: string) => void start(deviceId), [start]);
  const requestAccess = useCallback(() => void start(preferenceStore.get(prefKey) ?? undefined), [prefKey, start]);

  /**
   * Primer inicio: si el permiso ya está concedido (o denegado, para mostrar cómo resolverlo) se
   * abre la cámara directamente; si el navegador lo va a preguntar, antes se explica para qué se
   * usa (status "consent") y el aviso del sistema aparece solo cuando el usuario pulsa "Permitir".
   */
  const begin = useCallback(async () => {
    const requestId = requestIdRef.current;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return requestAccess();
    const permission = await cameraPermission();
    if (requestId !== requestIdRef.current) return; // desmontado o iniciado por otra vía
    const known = permission === 'granted' || permission === 'denied';
    if (known || (permission === 'unknown' && preferenceStore.get(GRANTED_KEY) === '1')) return requestAccess();
    setStatus('consent');
  }, [requestAccess]);

  const switchCamera = useCallback(() => {
    if (devices.length < 2) return;
    const index = devices.findIndex((d) => d.deviceId === activeDeviceRef.current);
    const next = devices[(index + 1) % devices.length];
    void start(next.deviceId);
  }, [devices, start]);

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
    if (autoStart) void begin();
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
    isMirrored,
    start,
    requestAccess,
    stop,
    switchCamera,
    selectCamera,
    captureFrame,
  };
}
