import { Camera, UserCheck } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useCamera, type CameraFacing } from '../hooks/useCamera';
import { useCatalogs } from '../hooks/useCatalogs';
import { useFaceAutoCapture, useFaceDetector } from '../hooks/useFaceDetection';
import { useMountedRef } from '../hooks/useMountedRef';
import { useScreenFlash } from '../hooks/useScreenFlash';
import { ApiError, errorMessage } from '../services/apiClient';
import type { FaceCaptures } from '../services/http/faceUpload';
import { faceService } from '../services/verificationService';
import type { FaceChallenge, VerificationRules } from '../types';
import { isVirtualCamera } from '../utils/cameraDevices';
import { config } from '../utils/config';
import type { FaceBaseline } from '../utils/facePose';
import { detectedAccessories, faceErrorOutcome, faceResumeDelayMs } from '../utils/faceErrors';
import { sleep, whenOnline } from '../utils/waits';
import { CameraCapture } from './CameraCapture';
import { FaceGuide } from './FaceGuide';
import { ScanCard, scanStages, stageFill, type Phase } from './FaceScan';
import { FlashOverlay } from './FlashOverlay';
import { challengeActions, detectionMode, FLASH_HINT, livenessProgress, scannerView } from './liveFaceView';
import { ScannerHints } from './LivenessCues';
import { Button } from './ui/Button';

export interface CapturedFace extends FaceCaptures {
  /** El empleado indicó que no usa el accesorio detectado: el registro va marcado a revisión. */
  accessoryReview: boolean;
}

export interface FlowAlternative {
  label: string;
  icon: ReactNode;
  onSelect: () => void;
}

interface LiveFaceFlowProps {
  title: string;
  /** Cámara a abrir: frontal (la persona se captura a sí misma) o trasera (la empresa la apunta). */
  facing?: CameraFacing;
  /** La persona capturada está exenta de retirar la prenda de cabeza (validación previa). */
  allowHeadwear?: boolean;
  /** Capturas frontales a tomar (3 en verificación, 5 en registro). */
  frontalFrames: number;
  submittingMessage: string;
  /** Política de la empresa: accesorios exigidos y prueba de vida. */
  policy: VerificationRules;
  /** Registro: si el sistema insiste en un accesorio que el empleado no usa, puede enviarlo a revisión. */
  allowAccessoryReview?: boolean;
  /** Otra forma de identificarse si el rostro no se puede validar (p. ej. código QR). */
  alternative?: FlowAlternative;
  /** Envía las capturas. Si lanza un error corregible (accesorios, calidad, prueba de vida)
   *  se muestra el motivo y se reinicia el flujo automáticamente. */
  onSubmit: (captured: CapturedFace) => Promise<void>;
  /** Errores no corregibles (permisos, servicio caído) o la red que sigue fallando tras reintentar
   *  solo (MAX_TRANSIENT_FACE_FAILURES); se recibe el error original. */
  onFatal: (error: unknown) => void;
  onCancel: () => void;
}

/**
 * Flujo facial guiado y automático, en cinco etapas visibles (FaceScan.tsx):
 *  1. Preparación    → rostro frente a la cámara, a buena distancia y con luz.
 *  2. Alineación     → centrado y de frente hasta quedar estable (se guarda el rostro "en reposo").
 *  3. Escaneo        → N capturas y validación previa en el backend (calidad, pose y accesorios
 *                      por consenso entre 3 capturas).
 *  4. Prueba de vida → (si la empresa la exige) reto aleatorio del servidor:
 *                      a) destello: la pantalla se pinta de cada color del reto y se captura un
 *                         cuadro con cada uno (el rostro real refleja la luz; un video inyectado no);
 *                      b) de uno a tres movimientos (girar, mirar arriba o abajo, acercarse); entre
 *                         uno y otro la persona vuelve al frente.
 *                      Si no se logra a tiempo (cada movimiento y el reto completo, `expires_in`)
 *                      se pide otro reto SIN repetir el escaneo.
 *  5. Confirmación   → el backend valida todo de nuevo (fuente de verdad).
 */

/** Reto vigente (con prueba de vida): siempre trae su id. */
type ActiveChallenge = FaceChallenge & { challenge_id: string };

interface Blocked {
  message: string;
  /** Códigos del catálogo de accesorios detectados. */
  accessories: string[];
}

const REVIEW_AFTER_ATTEMPTS = 2;
/** Retos pedidos de nuevo (conservando el escaneo) antes de reiniciar todo el flujo. */
const CHALLENGE_RETRIES = 2;
const TIMEOUT_MESSAGE = 'No se completó el movimiento a tiempo. Hazlo despacio, hasta que el anillo se llene.';
const FLASH_FAILED_MESSAGE = 'No se pudo completar el destello de colores. Mantén la pantalla encendida y tu rostro frente a ella.';
const vibrate = (ms: number) => {
  try {
    navigator.vibrate?.(ms); // Android; iOS lo ignora
  } catch {
    /* sin soporte */
  }
};

/** Hasta cuándo se puede responder el reto: su vida (`expires_in`) menos lo que tarda el envío. */
function challengeDeadline(challenge: ActiveChallenge): number {
  if (!challenge.expires_in) return Infinity;
  return Date.now() + Math.max(0, challenge.expires_in * 1000 - config.faceChallengeMarginMs);
}

interface StableHandlers {
  frontal: (sample?: FaceBaseline) => Promise<void>;
  step: (active: ActiveChallenge) => Promise<void>;
  recenter: () => void;
}

/** Lo que dispara el rostro estable en cada fase (en un movimiento siempre hay un reto vigente). */
function stableHandler(phase: Phase, challenge: ActiveChallenge | null, handlers: StableHandlers): (sample?: FaceBaseline) => void | Promise<void> {
  if (phase === 'recenter') return handlers.recenter;
  if (phase === 'challenge' && challenge) return () => handlers.step(challenge);
  return handlers.frontal;
}

/** Propuesta de revisión humana cuando el detector insiste en un accesorio que el empleado no usa. */
export function AccessoryReviewPrompt({ accessories, onConfirm }: { accessories: string[]; onConfirm: () => void }) {
  const { byCode } = useCatalogs();
  const names = accessories.map((code) => byCode('accessories', code)?.phrase ?? code).join(' ni ');
  return (
    <div className="review-prompt" role="note">
      <strong>¿No estás usando {names}?</strong>
      <span className="muted small">
        Puede deberse a la iluminación o al encuadre. Si estás seguro, envía tu registro marcado: tu empresa lo revisará
        con tu fotografía.
      </span>
      <Button variant="secondary" block icon={<UserCheck size={18} />} onClick={onConfirm}>
        No uso {names} · enviar a revisión
      </Button>
    </div>
  );
}

/** Fases en que la cámara busca el rostro (frontal, movimiento o regreso al frente). */
const SCANNING_PHASES = new Set<Phase>(['frontal', 'challenge', 'recenter']);

interface FlowExtrasProps {
  /** Accesorios a proponer para revisión humana (null = no se ofrece). */
  reviewAccessories: string[] | null;
  reviewRequested: boolean;
  onReview: () => void;
}

/** Bajo el visor, solo cuando aplica: enviar el registro a revisión si el sistema insiste en un accesorio. */
function FlowExtras({ reviewAccessories, reviewRequested, onReview }: FlowExtrasProps) {
  if (!reviewAccessories && !reviewRequested) return null;
  return (
    <>
      {reviewAccessories && <AccessoryReviewPrompt accessories={reviewAccessories} onConfirm={onReview} />}
      {reviewRequested && (
        <p className="review-prompt review-prompt--sent small" role="status">
          <UserCheck size={16} /> Tu registro se enviará marcado para revisión de tu empresa.
        </p>
      )}
    </>
  );
}

/** Captura manual (si la detección automática no está disponible) y otra forma de identificarse. */
function FlowActions({ manualCapture, alternative }: { manualCapture: { disabled: boolean; onCapture: () => void } | null; alternative?: FlowAlternative }) {
  if (!manualCapture && !alternative) return null;
  return (
    <>
      {manualCapture && (
        <Button variant="primary" size="lg" icon={<Camera size={20} />} disabled={manualCapture.disabled} onClick={manualCapture.onCapture}>
          Capturar
        </Button>
      )}
      {alternative && (
        <Button variant="secondary" size="lg" icon={alternative.icon} onClick={alternative.onSelect}>
          {alternative.label}
        </Button>
      )}
    </>
  );
}

export function LiveFaceFlow({
  title,
  facing = 'user',
  allowHeadwear = false,
  frontalFrames,
  submittingMessage,
  policy,
  allowAccessoryReview = false,
  alternative,
  onSubmit,
  onFatal,
  onCancel,
}: LiveFaceFlowProps) {
  const camera = useCamera({ facing });
  const catalogs = useCatalogs();
  const { detector, error: detectorError } = useFaceDetector();
  const { run: runFlash, ...flash } = useScreenFlash();
  const [phase, setPhase] = useState<Phase>('frontal');
  const [blocked, setBlocked] = useState<Blocked | null>(null);
  const [challenge, setChallenge] = useState<ActiveChallenge | null>(null);
  const [capture, setCapture] = useState<{ current: number; total: number } | null>(null);
  const [accessoryStreak, setAccessoryStreak] = useState<{ count: number; accessories: string[] }>({ count: 0, accessories: [] });
  const [reviewRequested, setReviewRequested] = useState(false);
  const frontalRef = useRef<Blob[]>([]);
  /** Rostro en reposo al quedar estable de frente: base para mirar arriba/abajo y acercarse. */
  const [baseline, setBaseline] = useState<FaceBaseline | null>(null);
  /** Movimiento del reto en curso, las capturas de los ya hechos y las del destello (en orden). */
  const [step, setStep] = useState(0);
  const stepsRef = useRef<Blob[]>([]);
  const flashRef = useRef<Blob[]>([]);
  /** Hasta cuándo se puede responder el reto vigente (Date.now()). */
  const deadlineRef = useRef(Infinity);
  /** Retos pedidos de nuevo con el mismo escaneo (se reinicia con cada escaneo). */
  const challengeRetries = useRef(0);
  /** Fallas de red o servidor seguidas: cada reintento vuelve a subir las capturas. */
  const transientStreak = useRef(0);
  const mounted = useMountedRef();

  const clearChallenge = useCallback(() => {
    setChallenge(null);
    setStep(0);
    stepsRef.current = [];
    flashRef.current = [];
  }, []);

  const block = useCallback(
    async (error: unknown) => {
      if (!mounted.current) return;
      const outcome = faceErrorOutcome(error, catalogs, transientStreak.current);
      transientStreak.current = outcome.streak;
      if (outcome.fatal) {
        onFatal(error);
        return;
      }
      const accessories = detectedAccessories(error);
      setAccessoryStreak((prev) => (accessories.length ? { count: prev.count + 1, accessories } : prev));
      setBlocked({ message: errorMessage(error), accessories });
      clearChallenge();
      setCapture(null);
      setPhase('blocked');
      vibrate(80);
      // Se reanuda tras la pausa (o la que pidió el servidor) y, sin red, hasta recuperar la conexión.
      await Promise.all([sleep(faceResumeDelayMs(error)), whenOnline()]);
      if (mounted.current) {
        setBlocked(null);
        setPhase('frontal');
      }
    },
    [catalogs, clearChallenge, mounted, onFatal],
  );

  const submit = useCallback(
    async (captured: Omit<CapturedFace, 'accessoryReview' | 'camera'>) => {
      setPhase('submitting');
      try {
        await onSubmit({ ...captured, camera: camera.trackLabel || undefined, accessoryReview: reviewRequested });
        transientStreak.current = 0;
      } catch (error) {
        await block(error);
      }
    },
    [block, camera.trackLabel, onSubmit, reviewRequested],
  );

  const captureFrames = useCallback(async (): Promise<Blob[]> => {
    const frames: Blob[] = [];
    for (let i = 0; i < frontalFrames; i++) {
      setCapture({ current: i + 1, total: frontalFrames });
      frames.push(await camera.captureFrame());
      if (i < frontalFrames - 1) await sleep(config.faceFrameGapMs);
    }
    setCapture(null);
    return frames;
  }, [camera, frontalFrames]);

  // Validación previa: si el empleado pidió revisión, los accesorios no detienen el flujo.
  const precheck = useCallback(
    async (frames: Blob[]) => {
      try {
        await faceService.check(frames.slice(0, 3), allowHeadwear);
      } catch (error) {
        if (!(reviewRequested && error instanceof ApiError && error.code === 'ACCESSORIES_DETECTED')) throw error;
      }
    },
    [allowHeadwear, reviewRequested],
  );

  // Reto recibido: destello (si la empresa lo usa) y después el primer movimiento. Si el destello
  // falla (cámara sin imagen, pantalla oculta) y solo se mide, se sigue sin él: el servidor no lo exige.
  // Devuelve true si falló siendo obligatorio (hay que pedir otro reto).
  const beginChallenge = useCallback(
    async (next: ActiveChallenge): Promise<boolean> => {
      clearChallenge();
      setChallenge(next);
      deadlineRef.current = challengeDeadline(next);
      if (next.flash.length) {
        setPhase('flash');
        const frames = await runFlash(next.flash, () => camera.captureFrame()).catch(() => null);
        if (!mounted.current) return false;
        if (!frames && next.flash_required) return true;
        flashRef.current = frames ?? [];
      }
      setPhase('challenge');
      return false;
    },
    [camera, clearChallenge, mounted, runFlash],
  );

  // Sin prueba de vida se envían las frontales; con ella, empieza el reto. true = pedir otro reto.
  const proceed = useCallback(
    async (next: FaceChallenge): Promise<boolean> => {
      if (next.liveness_required && next.challenge_id) return beginChallenge({ ...next, challenge_id: next.challenge_id });
      await submit({ frontal: frontalRef.current });
      return false;
    },
    [beginChallenge, submit],
  );

  // Otro reto conservando el escaneo (hasta CHALLENGE_RETRIES); después se reinicia todo el flujo.
  const retryChallenge = useCallback(
    async (message: string) => {
      for (let reason = message; ; reason = FLASH_FAILED_MESSAGE) {
        if (challengeRetries.current >= CHALLENGE_RETRIES) {
          await block(new ApiError({ statusCode: 422, code: 'CHALLENGE_INVALID', message: 'No se completó la prueba de vida. Intentemos de nuevo desde el inicio.' }));
          return;
        }
        challengeRetries.current += 1;
        setBlocked({ message: reason, accessories: [] });
        clearChallenge();
        setPhase('blocked');
        vibrate(80);
        await sleep(config.faceResumeAfterBlockMs);
        try {
          const next = await faceService.getChallenge();
          if (!mounted.current) return;
          setBlocked(null);
          if (!(await proceed(next))) return;
        } catch (error) {
          await block(error);
          return;
        }
      }
    },
    [block, clearChallenge, mounted, proceed],
  );

  // Fase 1: rostro frontal estable → capturas → validación previa → reto (si aplica).
  const onFrontalStable = useCallback(
    async (sample?: FaceBaseline) => {
      setPhase('checking');
      setBaseline(sample ?? null);
      challengeRetries.current = 0;
      clearChallenge();
      vibrate(25);
      try {
        const frames = await captureFrames();
        frontalRef.current = frames;
        await precheck(frames);
        const next = await faceService.getChallenge();
        if (!mounted.current) return;
        if (await proceed(next)) await retryChallenge(FLASH_FAILED_MESSAGE);
      } catch (error) {
        await block(error);
      }
    },
    [block, captureFrames, clearChallenge, mounted, precheck, proceed, retryChallenge],
  );

  // Fase 2: movimiento hecho → captura; con otro pendiente se vuelve al frente; tras el último, envío
  // con una captura por movimiento y una por color del destello (en orden).
  const action = challengeActions(challenge)[step] ?? null;
  const onStepStable = useCallback(
    async (active: ActiveChallenge) => {
      vibrate(25);
      try {
        stepsRef.current = [...stepsRef.current.slice(0, step), await camera.captureFrame()];
        if (step + 1 < active.actions.length) {
          setStep(step + 1);
          setPhase('recenter');
          return;
        }
        const flashFrames = flashRef.current.length ? { flash: flashRef.current } : {};
        await submit({ frontal: frontalRef.current, challenge: { id: active.challenge_id, images: stepsRef.current }, ...flashFrames });
      } catch (error) {
        await block(error);
      }
    },
    [block, camera, step, submit],
  );

  // Entre movimientos: de vuelta al frente, se pide el siguiente.
  const onRecentered = useCallback(() => {
    vibrate(15);
    setPhase('challenge');
  }, []);

  // Tiempo límite de cada movimiento (y del regreso al frente), sin pasar del vencimiento del reto
  // completo. Corre desde que cambia la fase: otro render de la pantalla no lo reinicia.
  const retryRef = useRef(retryChallenge);
  useLayoutEffect(() => {
    retryRef.current = retryChallenge;
  });
  useEffect(() => {
    if (phase !== 'challenge' && phase !== 'recenter') return;
    const wait = Math.min(config.faceChallengeTimeoutMs, Math.max(0, deadlineRef.current - Date.now()));
    const timer = window.setTimeout(() => void retryRef.current(TIMEOUT_MESSAGE), wait);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const cameraReady = camera.status === 'active';
  // Cámara virtual (programa que inyecta video): no se captura; el backend también la rechaza.
  const virtualCamera = cameraReady && isVirtualCamera(camera.trackLabel, policy.blocked_cameras);
  const scanning = SCANNING_PHASES.has(phase);
  const onStable = stableHandler(phase, challenge, { frontal: onFrontalStable, step: onStepStable, recenter: onRecentered });
  const mode = detectionMode(phase, challenge, action, baseline);
  const { guidance, progress, moveProgress } = useFaceAutoCapture({
    detector,
    videoRef: camera.videoRef,
    enabled: cameraReady && scanning && !virtualCamera,
    mode,
    stableFrames: phase === 'frontal' ? 6 : 3,
    onStable,
  });
  const livenessFill = livenessProgress(phase, flash, moveProgress);
  const { videoRef } = camera;
  // El óvalo de la guía, junto al video: por ahí se sigue viendo la cámara durante el destello.
  const locateOval = useCallback(() => videoRef.current?.parentElement?.querySelector('.face-scan')?.getBoundingClientRect(), [videoRef]);

  const { message, tone, stage, ringProgress, intro } = scannerView({
    phase,
    guidance,
    progress,
    challenge,
    step,
    virtualCamera,
    blockedMessage: blocked?.message,
    submittingMessage,
    detectorReady: Boolean(detector),
    detectorFailed: Boolean(detectorError),
    capture,
    moveProgress: livenessFill,
  });
  const stages = scanStages(policy.liveness_challenge);
  const offerReview = allowAccessoryReview && !reviewRequested && accessoryStreak.count >= REVIEW_AFTER_ATTEMPTS;

  return (
    <ScanCard
      title={title}
      stages={stages}
      stage={stage}
      fill={stageFill(stage, { progress, moveProgress: livenessFill, capture })}
      intro={intro}
      onCancel={onCancel}
      viewport={
        <CameraCapture camera={camera} className="camera--fill">
          <span className="faceid__label">{camera.activeLabel}</span>
          <FaceGuide tone={tone} message={message} progress={ringProgress} stage={stage} />
          <ScannerHints
            phase={phase}
            guidance={guidance}
            mode={mode.kind === 'action' ? mode : null}
            mirrored={camera.isMirrored}
            accessories={blocked?.accessories ?? []}
          />
          <FlashOverlay color={flash.color} index={flash.index} total={flash.total} locate={locateOval} hint={FLASH_HINT} />
        </CameraCapture>
      }
      extras={
        <FlowExtras
          reviewAccessories={offerReview ? accessoryStreak.accessories : null}
          reviewRequested={reviewRequested}
          onReview={() => {
            setReviewRequested(true);
            vibrate(25);
          }}
        />
      }
      actions={
        <FlowActions
          manualCapture={
            detectorError
              ? { disabled: !cameraReady || !scanning || virtualCamera, onCapture: () => void onStable() }
              : null
          }
          alternative={alternative}
        />
      }
    />
  );
}
