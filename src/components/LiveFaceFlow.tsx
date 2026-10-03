import { ArrowLeft, ArrowRight, Camera, UserCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useCamera, type CameraFacing } from '../hooks/useCamera';
import { useCatalogs } from '../hooks/useCatalogs';
import { FACE_GUIDANCE_MESSAGES, useFaceAutoCapture, useFaceDetector, type DetectionMode, type FaceGuidance } from '../hooks/useFaceDetection';
import { useMountedRef } from '../hooks/useMountedRef';
import { ApiError, errorMessage } from '../services/apiClient';
import type { FaceCaptures } from '../services/http/faceUpload';
import { faceService } from '../services/verificationService';
import type { FaceChallenge, TurnAction, VerificationRules } from '../types';
import { isVirtualCamera } from '../utils/cameraDevices';
import { config } from '../utils/config';
import { detectedAccessories, isRetryableFaceError } from '../utils/faceErrors';
import { CameraCapture } from './CameraCapture';
import { currentStage, ScanCard, scanStages, STAGE_INFO, stageFill, type Phase, type ScanStage } from './FaceScan';
import { AccessoryAlert, FaceGuide, guidanceTone, type Tone } from './FaceGuide';
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
  /** Errores no corregibles (red, permisos, servicio caído); se recibe el error original. */
  onFatal: (error: unknown) => void;
  onCancel: () => void;
}

/**
 * Flujo facial guiado y automático, en cinco etapas visibles (FaceScan.tsx):
 *  1. Preparación    → rostro frente a la cámara, a buena distancia y con luz.
 *  2. Alineación     → centrado y de frente hasta quedar estable.
 *  3. Escaneo        → N capturas y validación previa en el backend (calidad, pose y accesorios
 *                      por consenso entre 3 capturas).
 *  4. Prueba de vida → (si la empresa la exige) reto aleatorio: uno o dos giros de cabeza; entre
 *                      giros la persona vuelve al frente. Si no se logra a tiempo se pide otro reto
 *                      SIN repetir el escaneo.
 *  5. Confirmación   → el backend valida todo de nuevo (fuente de verdad).
 */

interface Blocked {
  message: string;
  /** Códigos del catálogo de accesorios detectados. */
  accessories: string[];
}

const REVIEW_AFTER_ATTEMPTS = 2;
/** Retos de giro que se piden de nuevo (conservando el escaneo) antes de reiniciar todo el flujo. */
const CHALLENGE_RETRIES = 2;
const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const vibrate = (ms: number) => {
  try {
    navigator.vibrate?.(ms); // Android; iOS lo ignora
  } catch {
    /* sin soporte */
  }
};

interface FlowStatusInput {
  phase: Phase;
  guidance: FaceGuidance;
  blockedMessage?: string;
  instruction?: string | null;
  submittingMessage: string;
  detectorReady: boolean;
  detectorFailed: boolean;
  capture?: { current: number; total: number } | null;
  /** 0..1: cuánto ha girado la cabeza en la prueba de vida. */
  turnProgress?: number;
}

function detectionMode(phase: Phase, challenge: FaceChallenge | null, action: TurnAction | null): DetectionMode {
  if (phase !== 'challenge' || !action) return { kind: 'frontal' };
  return { kind: 'turn', direction: action, minYawRatio: challenge?.min_yaw_ratio ?? 0.2 };
}

/** Giros del reto en orden (los retos de una versión anterior traen solo `action`). */
export function challengeActions(challenge: FaceChallenge | null): TurnAction[] {
  if (!challenge) return [];
  if (challenge.actions?.length) return challenge.actions;
  return challenge.action ? [challenge.action] : [];
}

/** Flecha lateral que indica hacia dónde girar (fuera del rostro). */
function TurnArrow({ pointsLeft }: { pointsLeft: boolean }) {
  const style = { ['--nudge' as string]: pointsLeft ? '-16px' : '16px', ['--side' as string]: pointsLeft ? '-1' : '1' };
  return (
    <div className="turn-arrow" style={style} aria-hidden>
      {pointsLeft ? <ArrowLeft size={44} /> : <ArrowRight size={44} />}
    </div>
  );
}

/** Mensaje y tono del visor según la fase del flujo y la guía de detección en vivo. */
export function flowStatus(input: FlowStatusInput): { message: string; tone: Tone } {
  const { phase, guidance } = input;
  if (phase === 'checking') {
    const capture = input.capture;
    return { message: capture ? `Capturando ${capture.current} de ${capture.total}...` : 'Analizando...', tone: 'busy' };
  }
  if (phase === 'submitting') return { message: input.submittingMessage, tone: 'busy' };
  if (phase === 'blocked') return { message: input.blockedMessage ?? 'Intentemos de nuevo', tone: 'warn' };
  if (phase === 'recenter') {
    if (guidance === 'hold_still' || guidance === 'ready') return { message: '¡Bien! Prepárate para el siguiente giro...', tone: 'ok' };
    return { message: 'Vuelve a mirar al frente', tone: 'idle' };
  }
  if (phase === 'challenge') {
    if (guidance === 'hold_still' || guidance === 'ready') return { message: '¡Bien! Mantén la posición...', tone: 'ok' };
    if (guidance !== 'turn') return { message: FACE_GUIDANCE_MESSAGES[guidance], tone: 'idle' };
    // A medio giro se anima a terminarlo (el avance también se ve en la barra y en el anillo).
    if ((input.turnProgress ?? 0) >= 0.4) return { message: 'Un poco más...', tone: 'idle' };
    return { message: input.instruction ?? 'Gira la cabeza', tone: 'idle' };
  }
  if (input.detectorFailed) return { message: 'Detección automática no disponible. Usa "Capturar".', tone: guidanceTone(guidance) };
  return { message: FACE_GUIDANCE_MESSAGES[input.detectorReady ? guidance : 'loading'], tone: guidanceTone(guidance) };
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

/** Indicaciones sobre el rostro: flecha de giro (reto) o accesorios a retirar (bloqueo). */
function ScannerHints({ phase, guidance, pointsLeft, accessories }: { phase: Phase; guidance: FaceGuidance; pointsLeft: boolean; accessories: string[] }) {
  if (phase === 'blocked') return <AccessoryAlert items={accessories} />;
  if (phase === 'challenge' && guidance !== 'hold_still' && guidance !== 'ready') return <TurnArrow pointsLeft={pointsLeft} />;
  return null;
}

/** Título e indicación de la etapa: el reto dice hacia dónde girar; un bloqueo, que se reintenta. */
export function introFor(input: { phase: Phase; stage: ScanStage; instruction?: string | null; submittingMessage: string; step?: { current: number; total: number } }): {
  title: string;
  text: string;
} {
  if (input.phase === 'blocked') return { title: 'Intentemos de nuevo', text: 'Corrige lo que se indica en la cámara; el escaneo se reanuda solo.' };
  if (input.stage === 'liveness') {
    const { step } = input;
    const title = step && step.total > 1 ? `${STAGE_INFO.liveness.title} · giro ${step.current} de ${step.total}` : STAGE_INFO.liveness.title;
    if (input.phase === 'recenter') return { title, text: 'Vuelve a mirar al frente para el siguiente giro.' };
    return { title, text: input.instruction ?? STAGE_INFO.liveness.text };
  }
  if (input.stage === 'confirm') return { title: input.submittingMessage.replace(/\.+$/, ''), text: STAGE_INFO.confirm.text };
  return STAGE_INFO[input.stage];
}

/** Fases en que la cámara busca el rostro (frontal, giro o regreso al frente). */
const SCANNING_PHASES = new Set<Phase>(['frontal', 'challenge', 'recenter']);
const VIRTUAL_CAMERA_STATUS = { message: 'Cámara virtual no permitida: elige la cámara del dispositivo', tone: 'warn' as const };

interface ScannerViewInput extends Omit<FlowStatusInput, 'instruction'> {
  /** 0..1: avance de la detección frontal (el giro usa `turnProgress`). */
  progress: number;
  challenge: FaceChallenge | null;
  /** Giro del reto en curso (0 = el primero). */
  step: number;
  virtualCamera: boolean;
  /** Cámara frontal con espejo: la izquierda de la persona se ve a la izquierda de la pantalla. */
  mirrored: boolean;
}

/** Lo que muestra el visor según la fase, el reto y la cámara: mensaje, tono, etapa, flecha y título. */
export function scannerView(input: ScannerViewInput) {
  const actions = challengeActions(input.challenge);
  const instruction = input.challenge?.instructions?.[input.step] ?? input.challenge?.instruction;
  const stage = currentStage(input.phase, input.guidance);
  return {
    ...(input.virtualCamera ? VIRTUAL_CAMERA_STATUS : flowStatus({ ...input, instruction })),
    stage,
    ringProgress: stage === 'liveness' ? (input.turnProgress ?? 0) : input.progress,
    pointsLeft: (actions[input.step] === 'TURN_LEFT') === input.mirrored,
    intro: introFor({ phase: input.phase, stage, instruction, submittingMessage: input.submittingMessage, step: { current: input.step + 1, total: Math.max(actions.length, 1) } }),
  };
}

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
  const [phase, setPhase] = useState<Phase>('frontal');
  const [blocked, setBlocked] = useState<Blocked | null>(null);
  const [challenge, setChallenge] = useState<FaceChallenge | null>(null);
  const [capture, setCapture] = useState<{ current: number; total: number } | null>(null);
  const [accessoryStreak, setAccessoryStreak] = useState<{ count: number; accessories: string[] }>({ count: 0, accessories: [] });
  const [reviewRequested, setReviewRequested] = useState(false);
  const frontalRef = useRef<Blob[]>([]);
  /** Giro del reto en curso y las capturas de los giros ya hechos (en orden). */
  const [step, setStep] = useState(0);
  const turnsRef = useRef<Blob[]>([]);
  /** Retos de giro pedidos de nuevo con el mismo escaneo (se reinicia con cada escaneo). */
  const challengeRetries = useRef(0);
  const mounted = useMountedRef();

  const block = useCallback(
    async (error: unknown) => {
      if (!mounted.current) return;
      if (!isRetryableFaceError(error, catalogs)) {
        onFatal(error);
        return;
      }
      const accessories = detectedAccessories(error);
      setAccessoryStreak((prev) => (accessories.length ? { count: prev.count + 1, accessories } : prev));
      setBlocked({ message: errorMessage(error), accessories });
      setChallenge(null);
      setStep(0);
      turnsRef.current = [];
      setCapture(null);
      setPhase('blocked');
      vibrate(80);
      await sleep(config.faceResumeAfterBlockMs);
      if (mounted.current) {
        setBlocked(null);
        setPhase('frontal');
      }
    },
    [catalogs, mounted, onFatal],
  );

  const submit = useCallback(
    async (captured: Omit<CapturedFace, 'accessoryReview' | 'camera'>) => {
      setPhase('submitting');
      try {
        await onSubmit({ ...captured, camera: camera.trackLabel || undefined, accessoryReview: reviewRequested });
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

  // Fase 1: rostro frontal estable → capturas → validación previa → reto (si aplica).
  const onFrontalStable = useCallback(async () => {
    setPhase('checking');
    challengeRetries.current = 0;
    setStep(0);
    turnsRef.current = [];
    vibrate(25);
    try {
      const frames = await captureFrames();
      frontalRef.current = frames;
      await precheck(frames);
      const next = await faceService.getChallenge();
      if (!mounted.current) return;
      if (next.liveness_required && next.challenge_id) {
        setChallenge(next);
        setPhase('challenge');
      } else {
        await submit({ frontal: frames });
      }
    } catch (error) {
      await block(error);
    }
  }, [block, captureFrames, mounted, precheck, submit]);

  // Fase 2: cabeza girada en la dirección solicitada → captura; con otro giro pendiente se vuelve al
  // frente; tras el último, envío con una captura por giro (en orden).
  const action = challengeActions(challenge)[step] ?? null;
  const onTurnStable = useCallback(async () => {
    if (!challenge?.challenge_id) return;
    vibrate(25);
    try {
      turnsRef.current = [...turnsRef.current.slice(0, step), await camera.captureFrame()];
      if (step + 1 < challengeActions(challenge).length) {
        setStep(step + 1);
        setPhase('recenter');
        return;
      }
      await submit({ frontal: frontalRef.current, challenge: { id: challenge.challenge_id, images: turnsRef.current } });
    } catch (error) {
      await block(error);
    }
  }, [block, camera, challenge, step, submit]);

  // Entre giros: de vuelta al frente, se pide el siguiente giro.
  const onRecentered = useCallback(() => {
    vibrate(15);
    setPhase('challenge');
  }, []);

  // Tiempo límite del reto: se pide otro reto conservando el escaneo (hasta CHALLENGE_RETRIES);
  // después se reinicia todo el flujo.
  const retryChallenge = useCallback(async () => {
    if (challengeRetries.current >= CHALLENGE_RETRIES) {
      await block(new ApiError({ statusCode: 422, code: 'CHALLENGE_INVALID', message: 'No se detectó el giro de cabeza. Intentemos de nuevo.' }));
      return;
    }
    challengeRetries.current += 1;
    setBlocked({ message: 'No se detectó el giro. Gira despacio hasta que la barra se llene.', accessories: [] });
    setChallenge(null);
    setStep(0);
    turnsRef.current = [];
    setPhase('blocked');
    vibrate(80);
    await sleep(config.faceResumeAfterBlockMs);
    try {
      const next = await faceService.getChallenge();
      if (!mounted.current) return;
      setBlocked(null);
      setChallenge(next);
      setPhase('challenge');
    } catch (error) {
      await block(error);
    }
  }, [block, mounted]);

  useEffect(() => {
    if (phase !== 'challenge' && phase !== 'recenter') return;
    const timer = window.setTimeout(() => void retryChallenge(), config.faceChallengeTimeoutMs);
    return () => window.clearTimeout(timer);
  }, [phase, retryChallenge]);

  const cameraReady = camera.status === 'active';
  // Cámara virtual (programa que inyecta video): no se captura; el backend también la rechaza.
  const virtualCamera = cameraReady && isVirtualCamera(camera.trackLabel, policy.blocked_cameras);
  const scanning = SCANNING_PHASES.has(phase);
  const onStable = { challenge: onTurnStable, recenter: onRecentered }[phase as 'challenge' | 'recenter'] ?? onFrontalStable;
  const { guidance, progress, turnProgress } = useFaceAutoCapture({
    detector,
    videoRef: camera.videoRef,
    enabled: cameraReady && scanning && !virtualCamera,
    mode: detectionMode(phase, challenge, action),
    stableFrames: phase === 'frontal' ? 6 : 3,
    onStable,
  });

  const { message, tone, stage, ringProgress, pointsLeft, intro } = scannerView({
    phase,
    guidance,
    progress,
    challenge,
    step,
    virtualCamera,
    mirrored: camera.isMirrored,
    blockedMessage: blocked?.message,
    submittingMessage,
    detectorReady: Boolean(detector),
    detectorFailed: Boolean(detectorError),
    capture,
    turnProgress,
  });
  const stages = scanStages(policy.liveness_challenge);
  const offerReview = allowAccessoryReview && !reviewRequested && accessoryStreak.count >= REVIEW_AFTER_ATTEMPTS;

  return (
    <ScanCard
      title={title}
      stages={stages}
      stage={stage}
      fill={stageFill(stage, { progress, turnProgress, capture })}
      intro={intro}
      onCancel={onCancel}
      viewport={
        <CameraCapture camera={camera} className="camera--fill">
          <span className="faceid__label">{camera.activeLabel}</span>
          <FaceGuide tone={tone} message={message} progress={ringProgress} stage={stage} />
          <ScannerHints phase={phase} guidance={guidance} pointsLeft={pointsLeft} accessories={blocked?.accessories ?? []} />
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
