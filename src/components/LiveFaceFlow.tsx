import { ArrowLeft, ArrowRight, Camera, ShieldCheck, UserCheck, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useCatalogs } from '../hooks/useCatalogs';
import { FACE_GUIDANCE_MESSAGES, useFaceAutoCapture, useFaceDetector, type DetectionMode, type FaceGuidance } from '../hooks/useFaceDetection';
import { ApiError, errorMessage } from '../services/apiClient';
import type { FaceChallengeCapture } from '../services/http/faceUpload';
import { faceService } from '../services/verificationService';
import type { FaceChallenge, VerificationRules } from '../types';
import { config } from '../utils/config';
import { detectedAccessories, isRetryableFaceError } from '../utils/faceErrors';
import { CameraCapture } from './CameraCapture';
import { AccessoryAlert, FaceGuide, guidanceTone, type Tone } from './FaceGuide';
import { FaceRequirements } from './FaceRequirements';
import { Button } from './ui/Button';

export interface CapturedFace {
  frontal: Blob[];
  challenge?: FaceChallengeCapture;
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
  description: string;
  /** Capturas frontales a tomar (3 en verificación, 5 en registro). */
  frontalFrames: number;
  /** Etiqueta del último paso ("Verificación" / "Envío"). */
  finalStep: string;
  submittingMessage: string;
  /** Política de la empresa: accesorios exigidos y prueba de vida. */
  policy: VerificationRules;
  headwearExempt?: boolean;
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
 * Flujo facial guiado y automático:
 *  1. Rostro frontal  → detección en vivo, N capturas y validación previa en el backend
 *                       (calidad, pose y accesorios por consenso entre 3 capturas).
 *  2. Prueba de vida  → (si la empresa la exige) reto aleatorio: girar la cabeza.
 *  3. Envío           → el backend valida todo de nuevo (fuente de verdad).
 */
type Phase = 'frontal' | 'checking' | 'blocked' | 'challenge' | 'submitting';

interface Blocked {
  message: string;
  /** Códigos del catálogo de accesorios detectados. */
  accessories: string[];
}

const REVIEW_AFTER_ATTEMPTS = 2;
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
}

function detectionMode(phase: Phase, challenge: FaceChallenge | null): DetectionMode {
  if (phase !== 'challenge' || !challenge?.action) return { kind: 'frontal' };
  return { kind: 'turn', direction: challenge.action, minYawRatio: challenge.min_yaw_ratio ?? 0.2 };
}

function stepIndex(phase: Phase, withLiveness: boolean): number {
  if (phase === 'submitting') return withLiveness ? 2 : 1;
  return phase === 'challenge' ? 1 : 0;
}

/** Indicador de pasos: completados, actual y pendientes. */
export function FlowSteps({ labels, current }: { labels: string[]; current: number }) {
  return (
    <ol className="steps" aria-label="Progreso">
      {labels.map((label, i) => (
        <li key={label} className={i < current ? 'is-done' : i === current ? 'is-current' : ''}>
          {label}
        </li>
      ))}
    </ol>
  );
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
  if (phase === 'challenge') {
    if (guidance === 'hold_still' || guidance === 'ready') return { message: '¡Bien! Mantén la posición...', tone: 'ok' };
    const message = guidance === 'turn' ? (input.instruction ?? 'Gira la cabeza') : FACE_GUIDANCE_MESSAGES[guidance];
    return { message, tone: 'idle' };
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

interface FlowPanelProps {
  title: string;
  description: string;
  steps: string[];
  currentStep: number;
  policy: VerificationRules;
  headwearExempt: boolean;
  /** Accesorios a proponer para revisión humana (null = no se ofrece). */
  reviewAccessories: string[] | null;
  reviewRequested: boolean;
  onReview: () => void;
  /** Captura manual cuando la detección automática no está disponible. */
  manualCapture: { disabled: boolean; onCapture: () => void } | null;
  alternative?: FlowAlternative;
  onCancel: () => void;
}

/** Panel del escáner: pasos, requisitos, acciones alternativas y cancelación. */
function FlowPanel(props: FlowPanelProps) {
  const { reviewAccessories, manualCapture, alternative } = props;
  return (
    <aside className="verify-screen__panel">
      <div className="verify-screen__heading">
        <h1>{props.title}</h1>
        <Button variant="ghost" iconOnly icon={<X size={20} />} onClick={props.onCancel} aria-label="Cancelar" title="Cancelar" />
      </div>
      <FlowSteps labels={props.steps} current={props.currentStep} />
      {reviewAccessories && <AccessoryReviewPrompt accessories={reviewAccessories} onConfirm={props.onReview} />}
      {props.reviewRequested && (
        <p className="review-prompt review-prompt--sent small" role="status">
          <UserCheck size={16} /> Tu registro se enviará marcado para revisión de tu empresa.
        </p>
      )}
      <FaceRequirements policy={props.policy} headwearExempt={props.headwearExempt} />
      <p className="muted small verify-screen__description">{props.description}</p>
      {manualCapture && (
        <Button variant="primary" size="lg" block icon={<Camera size={20} />} disabled={manualCapture.disabled} onClick={manualCapture.onCapture}>
          Capturar
        </Button>
      )}
      {alternative && (
        <Button variant="secondary" block icon={alternative.icon} onClick={alternative.onSelect}>
          {alternative.label}
        </Button>
      )}
      <p className="inline-note small muted">
        <ShieldCheck size={16} color="var(--success)" /> Tus datos biométricos se cifran y nunca se comparten.
      </p>
    </aside>
  );
}

export function LiveFaceFlow({
  title,
  description,
  frontalFrames,
  finalStep,
  submittingMessage,
  policy,
  headwearExempt = false,
  allowAccessoryReview = false,
  alternative,
  onSubmit,
  onFatal,
  onCancel,
}: LiveFaceFlowProps) {
  const camera = useCamera({ facing: 'user' });
  const catalogs = useCatalogs();
  const { detector, error: detectorError } = useFaceDetector();
  const [phase, setPhase] = useState<Phase>('frontal');
  const [blocked, setBlocked] = useState<Blocked | null>(null);
  const [challenge, setChallenge] = useState<FaceChallenge | null>(null);
  const [capture, setCapture] = useState<{ current: number; total: number } | null>(null);
  const [accessoryStreak, setAccessoryStreak] = useState<{ count: number; accessories: string[] }>({ count: 0, accessories: [] });
  const [reviewRequested, setReviewRequested] = useState(false);
  const frontalRef = useRef<Blob[]>([]);
  const mounted = useRef(true);
  useEffect(() => () => void (mounted.current = false), []);

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
      setCapture(null);
      setPhase('blocked');
      vibrate(80);
      await sleep(config.faceResumeAfterBlockMs);
      if (mounted.current) {
        setBlocked(null);
        setPhase('frontal');
      }
    },
    [catalogs, onFatal],
  );

  const submit = useCallback(
    async (captured: Omit<CapturedFace, 'accessoryReview'>) => {
      setPhase('submitting');
      try {
        await onSubmit({ ...captured, accessoryReview: reviewRequested });
      } catch (error) {
        await block(error);
      }
    },
    [block, onSubmit, reviewRequested],
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
        await faceService.check(frames.slice(0, 3));
      } catch (error) {
        if (!(reviewRequested && error instanceof ApiError && error.code === 'ACCESSORIES_DETECTED')) throw error;
      }
    },
    [reviewRequested],
  );

  // Fase 1: rostro frontal estable → capturas → validación previa → reto (si aplica).
  const onFrontalStable = useCallback(async () => {
    setPhase('checking');
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
  }, [block, captureFrames, precheck, submit]);

  // Fase 2: cabeza girada en la dirección solicitada → captura → envío.
  const onTurnStable = useCallback(async () => {
    if (!challenge?.challenge_id) return;
    vibrate(25);
    try {
      const image = await camera.captureFrame();
      await submit({ frontal: frontalRef.current, challenge: { id: challenge.challenge_id, image } });
    } catch (error) {
      await block(error);
    }
  }, [block, camera, challenge, submit]);

  // Tiempo límite para completar el reto: se reinicia con un reto nuevo.
  useEffect(() => {
    if (phase !== 'challenge') return;
    const timer = window.setTimeout(() => {
      void block(new ApiError({ statusCode: 422, code: 'CHALLENGE_INVALID', message: 'No se detectó el giro de cabeza. Intentemos de nuevo.' }));
    }, config.faceChallengeTimeoutMs);
    return () => window.clearTimeout(timer);
  }, [phase, block]);

  const cameraReady = camera.status === 'active';
  const scanning = phase === 'frontal' || phase === 'challenge';
  const { guidance, progress } = useFaceAutoCapture({
    detector,
    videoRef: camera.videoRef,
    enabled: cameraReady && scanning,
    mode: detectionMode(phase, challenge),
    stableFrames: phase === 'challenge' ? 3 : 6,
    onStable: phase === 'challenge' ? onTurnStable : onFrontalStable,
  });

  // Con espejo (cámara frontal) la izquierda de la persona se ve a la izquierda de la pantalla.
  const pointsLeft = (challenge?.action === 'TURN_LEFT') === camera.isMirrored;
  const { message, tone } = flowStatus({
    phase,
    guidance,
    blockedMessage: blocked?.message,
    instruction: challenge?.instruction,
    submittingMessage,
    detectorReady: Boolean(detector),
    detectorFailed: Boolean(detectorError),
    capture,
  });

  const withLiveness = policy.liveness_challenge;
  const steps = withLiveness ? ['Rostro', 'Prueba de vida', finalStep] : ['Rostro', finalStep];
  const offerReview = allowAccessoryReview && !reviewRequested && accessoryStreak.count >= REVIEW_AFTER_ATTEMPTS;

  return (
    <div className="verify-screen">
      <div className="verify-screen__camera">
        <CameraCapture camera={camera} className="camera--fill">
          <FaceGuide tone={tone} message={message} progress={progress} />
          <ScannerHints phase={phase} guidance={guidance} pointsLeft={pointsLeft} accessories={blocked?.accessories ?? []} />
        </CameraCapture>
      </div>

      <FlowPanel
        title={title}
        description={description}
        steps={steps}
        currentStep={stepIndex(phase, withLiveness)}
        policy={policy}
        headwearExempt={headwearExempt}
        reviewAccessories={offerReview ? accessoryStreak.accessories : null}
        reviewRequested={reviewRequested}
        onReview={() => {
          setReviewRequested(true);
          vibrate(25);
        }}
        manualCapture={
          detectorError
            ? { disabled: !cameraReady || !scanning, onCapture: () => void (phase === 'challenge' ? onTurnStable() : onFrontalStable()) }
            : null
        }
        alternative={alternative}
        onCancel={onCancel}
      />
    </div>
  );
}
