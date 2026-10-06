import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useCamera, type CameraFacing } from '../hooks/useCamera';
import { useCaptureTelemetry } from '../hooks/useCaptureTelemetry';
import { useCatalogs } from '../hooks/useCatalogs';
import { useFaceAutoCapture, useFaceDetector } from '../hooks/useFaceDetection';
import { useFaceBurst } from '../hooks/useFaceBurst';
import { useFrontalCapture, type FrontalPhoto } from '../hooks/useFrontalCapture';
import { useMountedRef } from '../hooks/useMountedRef';
import { useScreenFlash } from '../hooks/useScreenFlash';
import { t, useLocale } from '../i18n';
import { resolveLazy, type LazyText } from '../i18n/lazy';
import { ApiError, errorMessage } from '../services/apiClient';
import type { FaceCaptures } from '../services/http/faceUpload';
import { faceService } from '../services/verificationService';
import type { FaceChallenge, VerificationRules } from '../types';
import { isVirtualCamera } from '../utils/cameraDevices';
import { config } from '../utils/config';
import type { FaceBaseline } from '../utils/facePose';
import { detectedAccessories, faceErrorOutcome, faceResumeDelayMs, stepUpChallenge } from '../utils/faceErrors';
import { sleep, whenOnline } from '../utils/waits';
import { CameraCapture } from './CameraCapture';
import { FaceGuide } from './FaceGuide';
import { ScanCard, scanStages, stageFill, type Phase } from './FaceScan';
import { FlashOverlay } from './FlashOverlay';
import { challengeActions, detectionMode, livenessProgress, scannerView, scanProgress, type ScannerViewInput } from './liveFaceView';
import { FlowActions, FlowExtras, type FlowAlternative } from './LiveFaceParts';
import { ScannerHints } from './LivenessCues';

export type { FlowAlternative } from './LiveFaceParts';

export interface CapturedFace extends FaceCaptures {
  /** El empleado indicó que no usa el accesorio detectado: el registro va marcado a revisión. */
  accessoryReview: boolean;
}

interface LiveFaceFlowProps {
  title: string;
  /** Cámara a abrir: frontal (la persona se captura a sí misma) o trasera (la empresa la apunta). */
  facing?: CameraFacing;
  /** La persona capturada está exenta de retirar la prenda de cabeza (validación previa). */
  allowHeadwear?: boolean;
  /** Fotos de frente a tomar (3 en una verificación; las 36 del registro con `enrollmentCapture()`). */
  frontalFrames: number;
  /** Fotos completas del registro facial (`enrollmentCapture()`); sin él, las capturas frontales de siempre. */
  frontalPhoto?: FrontalPhoto;
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
 *  3. Escaneo        → las fotos de frente (3 en una verificación, 36 completas en el registro facial)
 *                      y la validación previa en el backend (calidad, pose y accesorios de las 3
 *                      primeras). El reto se pide al empezar el escaneo, junto con las fotos: así se
 *                      sabe desde el principio cuántas fotos serán en total (anillo de 36 marcas).
 *  4. Prueba de vida → (si la empresa la exige) reto aleatorio del servidor:
 *                      a) destello: la pantalla se pinta de cada color del reto y se captura un
 *                         cuadro con cada uno (el rostro real refleja la luz; un video inyectado no).
 *                         Dictado por el servidor (antifraude 2a), cada color llega por el canal en vivo
 *                         al capturar el anterior; sin canal, los colores de siempre;
 *                      b) de uno a tres movimientos (girar, mirar arriba o abajo, acercarse); entre
 *                         uno y otro la persona vuelve al frente.
 *                      Si no se logra a tiempo (cada movimiento y el reto completo, `expires_in`)
 *                      se pide otro reto SIN repetir el escaneo.
 *  5. Confirmación   → el backend valida todo de nuevo (fuente de verdad).
 *
 * Antifraude 2a: desde que el rostro queda estable de frente se toma la ráfaga de recortes (`useFaceBurst`: tramo
 * quieto hasta el destello y tramo de movimiento en el primer paso); viaja con las capturas si el reto la pide. Son las
 * 36 fotos LIGERAS de una verificación: el servidor mide con ellas la continuidad y el consenso de la identidad.
 *
 * UN solo anillo (decisión del dueño, 2026-10-06): las fotos tomadas contra las del plan (`scanProgress`), por todo
 * el proceso —fotos de frente, destello y movimientos— hasta completarse con la marca ✓. El anillo es continuo y fluye
 * hacia su valor con CSS (una ráfaga de fotos no lo hace saltar) y la indicación cambia con un fundido cruzado.
 */

/** Reto vigente (con prueba de vida): siempre trae su id. */
type ActiveChallenge = FaceChallenge & { challenge_id: string };

interface Blocked {
  /**
   * Por qué se detuvo: se escribe al dibujarse (el estado no guarda el texto ya traducido), así un
   * cambio de idioma con el aviso en pantalla lo traduce. El del servidor llega ya en su idioma.
   */
  reason: LazyText;
  /** Códigos del catálogo de accesorios detectados. */
  accessories: string[];
}

const REVIEW_AFTER_ATTEMPTS = 2;
/** Retos pedidos de nuevo (conservando el escaneo) antes de reiniciar todo el flujo. */
const CHALLENGE_RETRIES = 2;
const timeoutReason = () => t('face.flow.timeout');
const flashFailedReason = () => t('face.flow.flashFailed');

/**
 * Los retos se agotaron: se trata como si el servidor lo rechazara (mismo código), con el texto de
 * la app en el idioma activo al leerse (popup o resultado abiertos lo traducen si cambia el idioma).
 */
function challengeExhausted(): ApiError {
  const error = new ApiError({ statusCode: 422, code: 'CHALLENGE_INVALID', message: '' });
  Object.defineProperty(error, 'message', { get: () => t('face.flow.challengeRestart'), configurable: true, enumerable: false });
  return error;
}
const vibrate = (ms: number) => {
  try {
    navigator.vibrate?.(ms); // Android; iOS lo ignora
  } catch {
    /* sin soporte */
  }
};

/**
 * Hasta cuándo se puede responder el reto: su vida (`expires_in`, contada desde que llegó: se pide al empezar el
 * escaneo) menos lo que tarda el envío.
 */
function challengeDeadline(challenge: ActiveChallenge, arrivedAt: number): number {
  if (!challenge.expires_in) return Infinity;
  return arrivedAt + Math.max(0, challenge.expires_in * 1000 - config.faceChallengeMarginMs);
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

/** Fases en que la cámara busca el rostro (frontal, movimiento o regreso al frente). */
const SCANNING_PHASES = new Set<Phase>(['frontal', 'challenge', 'recenter']);

export function LiveFaceFlow({
  title,
  facing = 'user',
  allowHeadwear = false,
  frontalFrames,
  frontalPhoto,
  submittingMessage,
  policy,
  allowAccessoryReview = false,
  alternative,
  onSubmit,
  onFatal,
  onCancel,
}: LiveFaceFlowProps) {
  // Los textos del visor se escriben en cada dibujo a partir de la fase, la guía y el paso: un cambio
  // de idioma los traduce al instante sin tocar la cámara ni el avance del escaneo.
  useLocale();
  const camera = useCamera({ facing });
  // Antifraude: lo que el navegador dice de sí mismo y de su cámara viaja con las capturas (solo números).
  const telemetry = useCaptureTelemetry(camera, policy.blocked_cameras);
  const catalogs = useCatalogs();
  const { detector, failed: detectorFailed } = useFaceDetector();
  const { play: playFlash, ...flash } = useScreenFlash();
  const burst = useFaceBurst(camera.videoRef);
  const [phase, setPhase] = useState<Phase>('frontal');
  const [blocked, setBlocked] = useState<Blocked | null>(null);
  const [challenge, setChallenge] = useState<ActiveChallenge | null>(null);
  /** Las fotos de frente (cuántas se llevan: el anillo) y el reto que ya llegó (de él sale cuántas serán en total). */
  const frontal = useFrontalCapture(camera, frontalFrames, frontalPhoto);
  const { take: takePhotos, clear: clearPhotos } = frontal;
  const [upcoming, setUpcoming] = useState<FaceChallenge | null>(null);
  /**
   * Las fotos ligeras del tramo quieto que lleva la ráfaga (cada recorte avisa). En el registro no se cuentan (van a la
   * par de las 36 completas): su valor no cambia y la pantalla no se vuelve a dibujar por cada recorte.
   */
  const lightPhotos = useSyncExternalStore(burst.subscribe, () => (frontalPhoto ? 0 : burst.held()));
  const [accessoryStreak, setAccessoryStreak] = useState<{ count: number; accessories: string[] }>({ count: 0, accessories: [] });
  const [reviewRequested, setReviewRequested] = useState(false);
  const frontalRef = useRef<Blob[]>([]);
  /** Rostro en reposo al quedar estable de frente: base para mirar arriba/abajo y acercarse. */
  const [baseline, setBaseline] = useState<FaceBaseline | null>(null);
  /** Movimiento del reto en curso, las capturas de los ya hechos y las del destello (en orden). */
  const [step, setStep] = useState(0);
  const stepsRef = useRef<Blob[]>([]);
  const flashRef = useRef<Blob[]>([]);
  /** Comprobante del destello dictado por el servidor (va con las capturas). */
  const receiptRef = useRef<string | undefined>(undefined);
  /** Hasta cuándo se puede responder el reto vigente (Date.now()) y cuándo llegó el último reto. */
  const deadlineRef = useRef(Infinity);
  const arrivedRef = useRef(0);
  /** Escaneo en curso: el reto de uno que ya terminó (bloqueado) no cambia el anillo del siguiente. */
  const scanRef = useRef(0);
  /** Retos pedidos de nuevo con el mismo escaneo (se reinicia con cada escaneo). */
  const challengeRetries = useRef(0);
  /** Fallas de red o servidor seguidas: cada reintento vuelve a subir las capturas. */
  const transientStreak = useRef(0);
  /**
   * Reto de "un paso más" que pidió el motor de riesgo (riesgo medio): el siguiente escaneo lo responde en lugar de
   * pedir otro. Las capturas ya enviadas no se reutilizan (cada una sirve una sola vez): se toman nuevas.
   */
  const stepUpRef = useRef<FaceChallenge | null>(null);
  /** Reto que firma la llave de este dispositivo (lo trae el reto del servidor solo para el propio empleado). */
  const deviceNonceRef = useRef<string | null>(null);
  const mounted = useMountedRef();

  const clearChallenge = useCallback(() => {
    setChallenge(null);
    setStep(0);
    stepsRef.current = [];
    flashRef.current = [];
    receiptRef.current = undefined;
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
      setBlocked({ reason: () => errorMessage(error), accessories });
      clearChallenge();
      burst.reset();
      clearPhotos();
      setUpcoming(null);
      scanRef.current += 1;
      setPhase('blocked');
      vibrate(80);
      // Se reanuda tras la pausa (o la que pidió el servidor) y, sin red, hasta recuperar la conexión.
      await Promise.all([sleep(faceResumeDelayMs(error)), whenOnline()]);
      if (mounted.current) {
        setBlocked(null);
        setPhase('frontal');
      }
    },
    [burst, catalogs, clearChallenge, clearPhotos, mounted, onFatal],
  );

  const submit = useCallback(
    async (captured: Omit<CapturedFace, 'accessoryReview' | 'camera'>) => {
      burst.pause();
      setPhase('submitting');
      try {
        const device = deviceNonceRef.current ? { deviceNonce: deviceNonceRef.current } : {};
        await onSubmit({ ...captured, ...device, camera: camera.trackLabel || undefined, telemetry: telemetry(), accessoryReview: reviewRequested });
        transientStreak.current = 0;
      } catch (error) {
        stepUpRef.current = stepUpChallenge(error);
        await block(error);
      }
    },
    [block, burst, camera.trackLabel, onSubmit, reviewRequested, telemetry],
  );

  /** Un reto recibido: cuándo llegó (su vida corre desde ahí) y, para el anillo, cuántas fotos pide. */
  const arrived = useCallback(
    (next: FaceChallenge) => {
      arrivedRef.current = Date.now();
      if (mounted.current) setUpcoming(next);
      return next;
    },
    [mounted],
  );

  /**
   * El reto del escaneo, pedido al EMPEZAR (en paralelo a las fotos): el anillo sabe desde el principio cuántas fotos
   * serán. Su falla se atiende al esperarlo, después de las fotos (nunca queda una promesa rechazada sin atender).
   */
  const requestChallenge = useCallback(() => {
    const scan = ++scanRef.current;
    const pending = (stepUpRef.current ? Promise.resolve(stepUpRef.current) : faceService.getChallenge()).then((next) =>
      scan === scanRef.current ? arrived(next) : next,
    );
    stepUpRef.current = null;
    pending.catch(() => undefined); // se atiende al esperarlo (onFrontalStable)
    return pending;
  }, [arrived]);

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
      deadlineRef.current = challengeDeadline(next, arrivedRef.current);
      // El tramo quieto de la ráfaga se completa (con tope) y se detiene: los colores del destello cambian la piel.
      await burst.settle(next.burst);
      burst.pause();
      if (next.flash.length || next.flash_pace) {
        setPhase('flash');
        const take = await playFlash(next, () => camera.captureFrame());
        if (!mounted.current) return false;
        if (!take && next.flash_required) return true;
        flashRef.current = take?.frames ?? [];
        receiptRef.current = take?.receipt;
      }
      setPhase('challenge');
      burst.move();
      return false;
    },
    [burst, camera, clearChallenge, mounted, playFlash],
  );

  // Sin prueba de vida se envían las frontales; con ella, empieza el reto. true = pedir otro reto.
  const proceed = useCallback(
    async (next: FaceChallenge): Promise<boolean> => {
      deviceNonceRef.current = next.device_nonce ?? null;
      if (next.liveness_required && next.challenge_id) return beginChallenge({ ...next, challenge_id: next.challenge_id });
      await submit({ frontal: frontalRef.current });
      return false;
    },
    [beginChallenge, submit],
  );

  // Otro reto conservando el escaneo (hasta CHALLENGE_RETRIES); después se reinicia todo el flujo.
  const retryChallenge = useCallback(
    async (first: LazyText) => {
      for (let reason = first; ; reason = flashFailedReason) {
        if (challengeRetries.current >= CHALLENGE_RETRIES) {
          await block(challengeExhausted());
          return;
        }
        challengeRetries.current += 1;
        setBlocked({ reason, accessories: [] });
        clearChallenge();
        setPhase('blocked');
        vibrate(80);
        await sleep(config.faceResumeAfterBlockMs);
        try {
          const next = arrived(await faceService.getChallenge());
          if (!mounted.current) return;
          setBlocked(null);
          if (!(await proceed(next))) return;
        } catch (error) {
          await block(error);
          return;
        }
      }
    },
    [arrived, block, clearChallenge, mounted, proceed],
  );

  // Fase 1: rostro frontal estable → reto (pedido ya) + fotos → validación previa → reto (si aplica).
  const onFrontalStable = useCallback(
    async (sample?: FaceBaseline) => {
      setPhase('checking');
      setBaseline(sample ?? null);
      challengeRetries.current = 0;
      clearChallenge();
      clearPhotos();
      setUpcoming(null);
      burst.start(sample?.box);
      vibrate(25);
      const pending = requestChallenge();
      try {
        const frames = await takePhotos();
        frontalRef.current = frames;
        await precheck(frames);
        const next = await pending;
        if (!mounted.current) return;
        if (await proceed(next)) await retryChallenge(flashFailedReason);
      } catch (error) {
        await block(error);
      }
    },
    [block, burst, clearChallenge, clearPhotos, mounted, precheck, proceed, requestChallenge, retryChallenge, takePhotos],
  );

  // Fase 2: movimiento hecho → captura; con otro pendiente se vuelve al frente; tras el último, envío
  // con una captura por movimiento y una por color del destello (en orden).
  const action = challengeActions(challenge)[step] ?? null;
  const onStepStable = useCallback(
    async (active: ActiveChallenge) => {
      vibrate(25);
      try {
        stepsRef.current = [...stepsRef.current.slice(0, step), await camera.captureFrame()];
        burst.pause(); // el tramo de movimiento es el del primer paso
        if (step + 1 < active.actions.length) {
          setStep(step + 1);
          setPhase('recenter');
          return;
        }
        const flashFrames = flashRef.current.length ? { flash: flashRef.current, flashReceipt: receiptRef.current } : {};
        const sheet = await burst.take(active.burst);
        await submit({
          frontal: frontalRef.current,
          challenge: { id: active.challenge_id, images: stepsRef.current },
          ...flashFrames,
          ...(sheet ? { burst: sheet } : {}),
        });
      } catch (error) {
        await block(error);
      }
    },
    [block, burst, camera, step, submit],
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
    const timer = window.setTimeout(() => void retryRef.current(timeoutReason), wait);
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
  // El círculo de la guía con su anillo, junto al video: por ahí se siguen viendo la cámara y el avance de las fotos
  // durante el destello.
  const locateCircle = useCallback(() => videoRef.current?.parentElement?.querySelector('.face-scan__ring')?.getBoundingClientRect(), [videoRef]);
  const ring = scanProgress({
    phase,
    challenge: challenge ?? upcoming,
    frontalFrames,
    fullStill: Boolean(frontalPhoto),
    photos: frontal.photos,
    light: lightPhotos,
    flash,
    step,
    moveProgress,
  });

  const viewInput: ScannerViewInput = {
    phase,
    guidance,
    challenge,
    step,
    virtualCamera,
    blockedMessage: blocked ? resolveLazy(blocked.reason) : undefined,
    submittingMessage,
    detectorReady: Boolean(detector),
    detectorFailed,
    capture: frontal.capture,
    moveProgress: livenessFill,
  };
  const { tone, detail, stage, intro } = scannerView(viewInput);
  // La indicación se entrega como función (se escribe al dibujarse, también la que se desvanece en el fundido cruzado).
  const message = () => scannerView(viewInput).message;
  const stages = scanStages(policy.liveness_challenge);
  const offerReview = allowAccessoryReview && !reviewRequested && accessoryStreak.count >= REVIEW_AFTER_ATTEMPTS;

  return (
    <ScanCard
      title={title}
      stages={stages}
      stage={stage}
      fill={stageFill(stage, { progress, moveProgress: livenessFill, capture: frontal.capture })}
      intro={intro}
      onCancel={onCancel}
      viewport={
        <CameraCapture camera={camera} className="camera--fill">
          <span className="faceid__label">{camera.activeLabel}</span>
          <FaceGuide
            tone={tone}
            message={message}
            detail={detail}
            progress={ring}
            stage={stage}
            capturing={phase === 'checking'}
            flash={phase === 'flash'}
            complete={phase === 'submitting'}
          />
          <ScannerHints
            phase={phase}
            guidance={guidance}
            mode={mode.kind === 'action' ? mode : null}
            mirrored={camera.isMirrored}
            accessories={blocked?.accessories ?? []}
          />
          <FlashOverlay color={flash.color} index={flash.index} total={flash.total} locate={locateCircle} />
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
            detectorFailed
              ? { disabled: !cameraReady || !scanning || virtualCamera, onCapture: () => void onStable() }
              : null
          }
          alternative={alternative}
        />
      }
    />
  );
}
