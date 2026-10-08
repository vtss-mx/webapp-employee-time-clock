import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useAccessoryWatch } from '../hooks/useAccessoryWatch';
import { useFaceSpeech } from '../hooks/useFaceSpeech';
import { useCamera, type CameraFacing } from '../hooks/useCamera';
import { useCaptureTelemetry } from '../hooks/useCaptureTelemetry';
import { useCatalogs } from '../hooks/useCatalogs';
import { useFaceAutoCapture, useFaceDetector, type FaceGuidance } from '../hooks/useFaceDetection';
import { useFaceBurst } from '../hooks/useFaceBurst';
import { isSteadyGuidance, useEnrollmentPhotoPlan, useFrontalCapture, type FrontalPhoto } from '../hooks/useFrontalCapture';
import { useMountedRef } from '../hooks/useMountedRef';
import { t, useLocale } from '../i18n';
import { resolveLazy, type LazyText } from '../i18n/lazy';
import { ApiError, errorMessage } from '../services/apiClient';
import type { FaceCaptures } from '../services/http/faceUpload';
import { faceService } from '../services/verificationService';
import type { ChallengePurpose, FaceChallenge, VerificationRules } from '../types';
import { isVirtualCamera } from '../utils/cameraDevices';
import { config } from '../utils/config';
import type { FaceBaseline } from '../utils/facePose';
import { detectedAccessories, faceErrorOutcome, faceResumeDelayMs, reportedAccessories, stepUpChallenge } from '../utils/faceErrors';
import { faceFrameSharpness } from '../utils/frameQuality';
import { sleep, whenOnline } from '../utils/waits';
import { CameraCapture } from './CameraCapture';
import { AccessoryBadges, FaceGuide } from './FaceGuide';
import { ScanCard, scanStages, stageFill, type Phase } from './FaceScan';
import { accessoryWatchEnabled, autoCaptureFlags, challengeActions, detectionMode, detectorActive, manualCaptureDisabled, SCANNING_PHASES, scannerView, scanProgress, shutterEnabled, type ScannerViewInput } from './liveFaceView';
import { FlowActions, VoiceMuteButton, type FlowAlternative } from './LiveFaceParts';
import { ScannerHints } from './LivenessCues';

export type { FlowAlternative } from './LiveFaceParts';

/** Lo que el flujo entrega a la pantalla: las capturas de la toma (frontales, movimientos, ráfaga, cámara, telemetría). */
export type CapturedFace = FaceCaptures;

/**
 * Un paso del registro facial del propio empleado (decisión del dueño, 2026-10-07: tres pasos independientes): `photo`,
 * solo la foto inicial (una foto de frente y se envía: sin reto ni más fotos); `captures`, las fotos válidas con la
 * prueba de vida completa, SIN la foto inicial (ya se guardó en el paso 1). Sin él, el registro de un solo flujo (en
 * persona): foto inicial validada y, en la misma toma, las capturas y los movimientos.
 */
export type EnrollmentFlowStep = 'photo' | 'captures';

interface LiveFaceFlowProps {
  title: string;
  /** Cámara a abrir: frontal (la persona se captura a sí misma) o trasera (la empresa la apunta). */
  facing?: CameraFacing;
  /** La persona capturada está exenta de retirar la prenda de cabeza (validación previa). */
  allowHeadwear?: boolean;
  /** Fotos de frente a tomar (3 en una verificación; las 32 válidas del registro con `enrollmentCapture()`). */
  frontalFrames: number;
  /** Fotos completas del registro facial (`enrollmentCapture()`); sin él, las capturas frontales de siempre. */
  frontalPhoto?: FrontalPhoto;
  submittingMessage: string;
  /** Política de la empresa: prueba de vida y cámaras bloqueadas. */
  policy: VerificationRules;
  /** Otra forma de identificarse si el rostro no se puede validar (p. ej. código QR). */
  alternative?: FlowAlternative;
  /** Envía las capturas. Si lanza un error corregible (calidad, cubrebocas, prueba de vida)
   *  se muestra el motivo y se reinicia el flujo automáticamente. */
  onSubmit: (captured: CapturedFace) => Promise<void>;
  /** Errores no corregibles (permisos, servicio caído) o la red que sigue fallando tras reintentar
   *  solo (MAX_TRANSIENT_FACE_FAILURES); se recibe el error original. */
  onFatal: (error: unknown) => void;
  onCancel: () => void;
  /** El paso del registro propio que hace esta pantalla (`EnrollmentFlowStep`); sin él, el flujo completo. */
  enrollmentStep?: EnrollmentFlowStep;
  /** El indicador de los pasos del registro, dentro de la tarjeta (bajo el título). */
  steps?: ReactNode;
}

/**
 * Flujo facial guiado y automático, en cinco etapas visibles (FaceScan.tsx; cuatro en la foto inicial del registro, que no
 * lleva prueba de vida):
 *  1. Preparación    → rostro frente a la cámara, a buena distancia y con luz.
 *  2. Alineación     → dentro de la guía, centrado, de frente y quieto hasta quedar estable (se guarda el rostro "en
 *                      reposo").
 *  3. Escaneo        → en el registro facial (decisión del dueño, 2026-10-06, orden que no se altera): UNA foto
 *                      inicial que el servidor valida (`/face/check`: nítida, con luz, rostro completo) y, solo si
 *                      pasa, las 32 fotos VÁLIDAS (decisión del dueño, 2026-10-07: cada cuadro cuenta solo si el
 *                      detector sigue viendo el rostro dentro de la guía, centrado, de frente —sin mirar arriba ni
 *                      abajo— y quieto, y la medición de nitidez y luz lo acepta; «Capturas válidas: 24/32»; un cuadro
 *                      inválido no cuenta, no toma foto y no reinicia nada: la indicación dice qué corregir y el escaneo
 *                      espera lo que haga falta). En una verificación, las 3 capturas de siempre con su validación
 *                      previa. El reto se pide al empezar el escaneo, junto con las fotos: así se sabe desde el principio
 *                      cuántas fotos serán en total; si vence antes de terminarlas, se pide otro conservando las fotos.
 *  4. Prueba de vida → (si la empresa la exige) reto del servidor. Registro: SIEMPRE los cuatro movimientos de la cabeza
 *                      (derecha, izquierda, arriba, abajo; orden al azar) y, después de CADA uno, la vuelta al frente
 *                      (con detección real de que volvió); termina centrado. Verificación: de uno a tres movimientos de
 *                      la política. Si no se logra a tiempo (cada movimiento y el reto completo, `expires_in`) se pide
 *                      otro reto SIN repetir el escaneo. La pantalla nunca se pinta de colores (decisión del dueño,
 *                      2026-10-06): un reto que aún traiga colores se responde sin ellos.
 *  5. Confirmación   → el backend valida todo de nuevo (fuente de verdad).
 *
 * Antifraude 2a: desde que el rostro queda estable de frente se toma la ráfaga de recortes (`useFaceBurst`: tramo
 * quieto hasta el reto y tramo de movimiento en el primer paso); viaja con las capturas si el reto la pide. Son las
 * 36 fotos LIGERAS de una verificación: el servidor mide con ellas la continuidad y el consenso de la identidad.
 *
 * UN solo anillo (decisión del dueño, 2026-10-06): las fotos tomadas contra las del plan (`scanProgress`), por todo
 * el proceso —fotos de frente y movimientos— hasta completarse al enviar. Estados fijos: sin transiciones ni animaciones.
 *
 * Accesorios (decisión del dueño, 2026-10-07): cada vez que el servidor los reporta (la validación previa, aceptada o
 * rechazada, y el 422 de un envío) se muestran como INSIGNIAS sobre el rostro (`AccessoryBadges`: una por accesorio, de
 * cualquier tipo) y permanecen hasta la siguiente validación del servidor que ya no los reporte. La insignia es el único
 * aviso: la indicación grande nunca pide retirar nada; si la política de la empresa bloquea el accesorio, el servidor
 * rechaza la captura y el escaneo se reanuda con la insignia a la vista.
 */

/** Reto vigente (con prueba de vida): siempre trae su id. */
type ActiveChallenge = FaceChallenge & { challenge_id: string };

interface Blocked {
  /**
   * Por qué se detuvo: se escribe al dibujarse (el estado no guarda el texto ya traducido), así un
   * cambio de idioma con el aviso en pantalla lo traduce. El del servidor llega ya en su idioma. Null: lo detuvo un
   * accesorio bloqueado y el aviso es la insignia (la indicación grande sigue siendo de colocación).
   */
  reason: LazyText | null;
}

/** Retos pedidos de nuevo (conservando el escaneo) antes de reiniciar todo el flujo. */
const CHALLENGE_RETRIES = 2;
const timeoutReason = () => t('face.flow.timeout');

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
function challengeDeadline(challenge: FaceChallenge, arrivedAt: number): number {
  if (!challenge.expires_in) return Infinity;
  return arrivedAt + Math.max(0, challenge.expires_in * 1000 - config.faceChallengeMarginMs);
}

/** El reto venció mientras se reunían las fotos (el registro espera a la persona lo que haga falta). */
function challengeExpired(challenge: FaceChallenge, arrivedAt: number): boolean {
  return challenge.liveness_required && Date.now() >= challengeDeadline(challenge, arrivedAt);
}

interface StableHandlers {
  frontal: (sample?: FaceBaseline) => Promise<void>;
  step: (active: ActiveChallenge) => Promise<void>;
  recenter: (active: ActiveChallenge) => Promise<void>;
}

/** Lo que dispara el rostro estable en cada fase (en un movimiento y en la vuelta al frente siempre hay un reto vigente). */
function stableHandler(phase: Phase, challenge: ActiveChallenge | null, handlers: StableHandlers): (sample?: FaceBaseline) => void | Promise<void> {
  if (phase === 'recenter' && challenge) return () => handlers.recenter(challenge);
  if (phase === 'challenge' && challenge) return () => handlers.step(challenge);
  return handlers.frontal;
}

export function LiveFaceFlow({
  title,
  facing = 'user',
  allowHeadwear = false,
  frontalFrames,
  frontalPhoto,
  submittingMessage,
  policy,
  alternative,
  onSubmit,
  onFatal,
  onCancel,
  enrollmentStep,
  steps,
}: LiveFaceFlowProps) {
  // Los textos del visor se escriben en cada dibujo a partir de la fase, la guía y el paso: un cambio
  // de idioma los traduce al instante sin tocar la cámara ni el avance del escaneo.
  useLocale();
  const camera = useCamera({ facing });
  // Antifraude: lo que el navegador dice de sí mismo y de su cámara viaja con las capturas (solo números).
  const telemetry = useCaptureTelemetry(camera, policy.blocked_cameras);
  const catalogs = useCatalogs();
  const { detector, failed: detectorFailed } = useFaceDetector();
  const burst = useFaceBurst(camera.videoRef);
  const [phase, setPhase] = useState<Phase>('frontal');
  const [blocked, setBlocked] = useState<Blocked | null>(null);
  /** Accesorios que el servidor reportó en su última validación (códigos del catálogo): las insignias sobre el rostro. */
  const [accessories, setAccessories] = useState<string[]>([]);
  const [challenge, setChallenge] = useState<ActiveChallenge | null>(null);
  /**
   * Lo que el detector ve y el rostro en reposo, para la revisión en vivo de cada foto del registro (se leen al tomar
   * cada cuadro, nunca al dibujar).
   */
  const guidanceRef = useRef<FaceGuidance>('loading');
  /** El círculo de la guía: la detección mide el encuadre contra lo que se dibuja. */
  const guideRef = useRef<HTMLDivElement>(null);
  const enrollment = Boolean(frontalPhoto);
  /** La foto inicial del empleado (paso 1 independiente) se toma a MANO (decisión del dueño, 2026-10-07); el resto, solo. */
  const manualPhoto = enrollmentStep === 'photo';
  const purpose: ChallengePurpose = enrollment ? 'ENROLLMENT' : 'VERIFICATION';
  const photoPlan = useEnrollmentPhotoPlan(frontalPhoto, guidanceRef);
  /** Las fotos de frente (cuántas válidas se llevan: el anillo) y el reto que ya llegó (de él sale cuántas serán). */
  const frontal = useFrontalCapture(camera, frontalFrames, photoPlan);
  // Los movimientos se capturan con `shot`: del mismo tamaño que las fotos de frente (misma toma).
  const { take: takePhotos, clear: clearPhotos, shot } = frontal;
  const [upcoming, setUpcoming] = useState<FaceChallenge | null>(null);
  /**
   * Las fotos ligeras del tramo quieto que lleva la ráfaga (cada recorte avisa). En el registro no se cuentan (van a la
   * par de las 36 completas): su valor no cambia y la pantalla no se vuelve a dibujar por cada recorte.
   */
  const lightPhotos = useSyncExternalStore(burst.subscribe, () => (frontalPhoto ? 0 : burst.held()));
  const frontalRef = useRef<Blob[]>([]);
  /** Rostro en reposo al quedar estable de frente: base para mirar arriba/abajo y acercarse. */
  const [baseline, setBaseline] = useState<FaceBaseline | null>(null);
  /** Movimiento del reto en curso (igual al total en la vuelta final al frente) y las capturas de los ya hechos (en orden). */
  const [step, setStep] = useState(0);
  const stepsRef = useRef<Blob[]>([]);
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
      // Lo que el servidor reportó decide las insignias: un rechazo por otro motivo las retira.
      const found = detectedAccessories(error);
      setAccessories(found);
      setBlocked({ reason: found.length ? null : () => errorMessage(error) });
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
    async (captured: Omit<CapturedFace, 'camera'>) => {
      burst.pause();
      setPhase('submitting');
      try {
        const device = deviceNonceRef.current ? { deviceNonce: deviceNonceRef.current } : {};
        await onSubmit({ ...captured, ...device, camera: camera.trackLabel || undefined, telemetry: telemetry() });
        transientStreak.current = 0;
      } catch (error) {
        stepUpRef.current = stepUpChallenge(error);
        await block(error);
      }
    },
    [block, burst, camera.trackLabel, onSubmit, telemetry],
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
   * serán. Su falla se atiende al esperarlo, después de las fotos (nunca queda una promesa rechazada sin atender). El
   * del registro es el de los cuatro movimientos (`purpose`).
   */
  const requestChallenge = useCallback(() => {
    const scan = ++scanRef.current;
    const pending = (stepUpRef.current ? Promise.resolve(stepUpRef.current) : faceService.getChallenge(purpose)).then((next) =>
      scan === scanRef.current ? arrived(next) : next,
    );
    stepUpRef.current = null;
    pending.catch(() => undefined); // se atiende al esperarlo (onFrontalStable)
    return pending;
  }, [arrived, purpose]);

  // Validación previa en el servidor (nitidez, luz, rostro completo y los accesorios que la empresa bloquea). Los
  // accesorios que informa, bloqueados o no, son las insignias; una validación sin ellos las retira.
  const precheck = useCallback(
    async (frames: Blob[]) => {
      const result = await faceService.check(frames.slice(0, 3), allowHeadwear);
      if (mounted.current) setAccessories(reportedAccessories(result));
    },
    [allowHeadwear, mounted],
  );

  /**
   * Las fotos del escaneo. Registro: primero UNA foto inicial que valida el servidor (no se avanza sin ella) y después
   * las fotos válidas; verificación: las capturas de siempre y la validación previa de las primeras.
   */
  const photographs = useCallback(async (): Promise<Blob[]> => {
    if (enrollment) {
      // El paso de las capturas ya tiene su foto inicial guardada (paso 1): empieza directo con las fotos válidas.
      if (enrollmentStep !== 'captures') await precheck([await shot()]);
      return takePhotos();
    }
    const frames = await takePhotos();
    await precheck(frames);
    return frames;
  }, [enrollment, enrollmentStep, precheck, shot, takePhotos]);

  // Reto recibido: el tramo quieto de la ráfaga se completa (con tope) y empieza el primer movimiento. Los colores que
  // un reto aún pudiera traer se ignoran: la pantalla nunca se pinta (decisión del dueño, 2026-10-06).
  const beginChallenge = useCallback(
    async (next: ActiveChallenge) => {
      clearChallenge();
      setChallenge(next);
      deadlineRef.current = challengeDeadline(next, arrivedRef.current);
      await burst.settle(next.burst);
      if (!mounted.current) return;
      setPhase('challenge');
      burst.move();
    },
    [burst, clearChallenge, mounted],
  );

  // Sin prueba de vida se envían las frontales; con ella, empieza el reto.
  const proceed = useCallback(
    async (next: FaceChallenge) => {
      deviceNonceRef.current = next.device_nonce ?? null;
      if (next.liveness_required && next.challenge_id) await beginChallenge({ ...next, challenge_id: next.challenge_id });
      else await submit({ frontal: frontalRef.current });
    },
    [beginChallenge, submit],
  );

  // Otro reto conservando el escaneo (hasta CHALLENGE_RETRIES); después se reinicia todo el flujo.
  const retryChallenge = useCallback(
    async (reason: LazyText) => {
      if (challengeRetries.current >= CHALLENGE_RETRIES) {
        await block(challengeExhausted());
        return;
      }
      challengeRetries.current += 1;
      setBlocked({ reason });
      clearChallenge();
      setPhase('blocked');
      vibrate(80);
      await sleep(config.faceResumeAfterBlockMs);
      try {
        const next = arrived(await faceService.getChallenge(purpose));
        if (!mounted.current) return;
        setBlocked(null);
        await proceed(next);
      } catch (error) {
        await block(error);
      }
    },
    [arrived, block, clearChallenge, mounted, proceed, purpose],
  );

  // Fase 1: rostro frontal estable → reto (pedido ya) + fotos → validación previa → reto (si aplica). Si el reto venció
  // mientras se reunían las fotos válidas, se pide otro conservándolas (sin contar como reintento ni avisar).
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
        frontalRef.current = await photographs();
        let next = await pending;
        if (!mounted.current) return;
        if (challengeExpired(next, arrivedRef.current)) next = arrived(await faceService.getChallenge(purpose));
        if (!mounted.current) return;
        await proceed(next);
      } catch (error) {
        await block(error);
      }
    },
    [arrived, block, burst, clearChallenge, clearPhotos, mounted, photographs, proceed, purpose, requestChallenge],
  );

  // Paso 1 del registro (la foto inicial): con el rostro estable, UNA foto de frente y se envía (el servidor la valida y
  // la guarda); sin reto, sin más fotos. Rechazada, se explica (o la insignia) y se vuelve a intentar sola.
  const onPhotoStable = useCallback(
    async (sample?: FaceBaseline) => {
      setPhase('checking');
      setBaseline(sample ?? null);
      vibrate(25);
      try {
        frontalRef.current = [await shot()];
      } catch (error) {
        await block(error);
        return;
      }
      await submit({ frontal: frontalRef.current });
    },
    [block, shot, submit],
  );

  // Envío con una captura por movimiento (en orden) y la ráfaga, si el reto la pide.
  const finish = useCallback(
    async (active: ActiveChallenge) => {
      const sheet = await burst.take(active.burst);
      await submit({
        frontal: frontalRef.current,
        challenge: { id: active.challenge_id, images: stepsRef.current },
        ...(sheet ? { burst: sheet } : {}),
      });
    },
    [burst, submit],
  );

  // Fase 2: movimiento hecho → captura; después, de vuelta al frente (siempre en el registro, que termina centrado; en
  // una verificación solo con otro movimiento pendiente: tras el último se envía).
  const action = challengeActions(challenge)[step] ?? null;
  const onStepStable = useCallback(
    async (active: ActiveChallenge) => {
      vibrate(25);
      try {
        stepsRef.current = [...stepsRef.current.slice(0, step), await shot()];
        burst.pause(); // el tramo de movimiento es el del primer paso
        if (step + 1 < active.actions.length || enrollment) {
          setStep(step + 1);
          setPhase('recenter');
          return;
        }
        await finish(active);
      } catch (error) {
        await block(error);
      }
    },
    [block, burst, enrollment, finish, shot, step],
  );

  // De vuelta al frente: se pide el siguiente movimiento o, tras el último (registro), se envía ya centrado.
  const onRecentered = useCallback(
    async (active: ActiveChallenge) => {
      vibrate(15);
      if (step < active.actions.length) {
        setPhase('challenge');
        return;
      }
      try {
        await finish(active);
      } catch (error) {
        await block(error);
      }
    },
    [block, finish, step],
  );

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
  const detecting = detectorActive(phase, enrollment);
  const onStable = stableHandler(phase, challenge, {
    frontal: manualPhoto ? onPhotoStable : onFrontalStable,
    step: onStepStable,
    recenter: onRecentered,
  });
  const mode = detectionMode(phase, challenge, action, baseline);
  // Nitidez (enfoque) del cuadro de frente del registro (decisión del dueño, 2026-10-07: borde rojo si no está enfocado):
  // la varianza del Laplaciano sobre la caja del rostro, con el mínimo del servidor. Un cuadro borroso es `blurry` (borde
  // rojo, no cuenta). Solo en el registro (`enrollment`).
  const frameSharp = useCallback(
    (box: { originX: number; originY: number; width: number; height: number }) => faceFrameSharpness(camera.videoRef.current, box, config.enrollmentMinSharpness),
    [camera.videoRef],
  );
  // Mientras se toman las fotos del registro el detector sigue leyendo (sin disparar nada): cada foto cuenta solo si en
  // ese instante el rostro sigue dentro de la guía, centrado, de frente, quieto y ENFOCADO. La foto inicial manual no se
  // auto-dispara: el obturador la toma (abajo).
  const auto = autoCaptureFlags(phase, enrollment, cameraReady, detecting, virtualCamera);
  const { guidance, progress, moveProgress } = useFaceAutoCapture({
    detector,
    videoRef: camera.videoRef,
    guideRef,
    enabled: auto.enabled,
    mode,
    stableFrames: auto.stableFrames,
    onStable: manualPhoto ? undefined : onStable,
    continuous: auto.continuous,
    quality: auto.quality ? frameSharp : undefined,
  });
  guidanceRef.current = guidance;
  // Un cuadro para la vigilancia de accesorios: mientras se toman las fotos se REUSA la última capturada (no se toma
  // otra, para no inflar la toma ni cambiar su resolución); al alinear (aún sin capturar) se toma una chica aparte.
  const watchFrame = useCallback(
    (opts?: Parameters<typeof camera.captureFrame>[0]) => {
      const recent = frontal.last();
      return recent ? Promise.resolve(recent) : camera.captureFrame(opts);
    },
    [camera, frontal],
  );
  // Insignias de accesorios en vivo (decisión del dueño, 2026-10-07): en el registro, mientras se alinea (foto inicial) y
  // durante las capturas, se revalida un cuadro cada tanto para que la insignia aparezca o desaparezca en cualquier momento.
  useAccessoryWatch({
    enabled: accessoryWatchEnabled(enrollment, cameraReady, virtualCamera, phase),
    captureFrame: watchFrame,
    allowHeadwear,
    ready: () => guidanceRef.current !== 'no_face' && guidanceRef.current !== 'loading' && guidanceRef.current !== 'multiple',
    onAccessories: setAccessories,
  });
  const viewInput: ScannerViewInput = {
    phase,
    guidance,
    challenge,
    step,
    virtualCamera,
    blockedMessage: blocked?.reason ? resolveLazy(blocked.reason) : undefined,
    blockedByAccessory: Boolean(blocked && blocked.reason === null),
    submittingMessage,
    detectorReady: Boolean(detector),
    detectorFailed,
    capture: frontal.capture,
    moveProgress,
    validPhotos: enrollment,
  };
  const { tone, detail, stage, intro } = scannerView(viewInput);
  const ring = scanProgress({
    phase,
    challenge: challenge ?? upcoming,
    frontalFrames,
    fullStill: Boolean(frontalPhoto),
    photos: frontal.photos,
    light: lightPhotos,
    step,
    moveProgress,
  });

  // Guía por voz (decisión del dueño, 2026-10-08): lee las indicaciones en voz alta si la empresa la encendió. Se
  // dispara con el CÓDIGO del paso (fase, movimiento y la instrucción del servidor, derivada igual que el visor), nunca
  // con el texto ya traducido: un cambio de idioma en caliente no la repite ni redibuja el visor por cuadro.
  const voice = useFaceSpeech({ enabled: policy.voice_guidance_enabled, profile: policy.voice_profile, phase, step, challenge });

  // La indicación se entrega como función (se escribe al dibujarse, también la que se desvanece en el fundido cruzado).
  const message = () => scannerView(viewInput).message;
  // La foto inicial del registro no lleva prueba de vida: sus etapas son cuatro.
  const stages = scanStages(policy.liveness_challenge && enrollmentStep !== 'photo');
  // Obturador de la foto inicial manual (decisión del dueño, 2026-10-07): solo se habilita con el cuadro válido (borde
  // verde); sin detector automático (respaldo) se habilita con la cámara lista (el servidor valida al enviar).
  const shutterReady = shutterEnabled(cameraReady, virtualCamera, phase, detectorFailed, isSteadyGuidance(guidance));

  return (
    <ScanCard
      title={title}
      steps={steps}
      headerAction={<VoiceMuteButton voice={voice} enabled={policy.voice_guidance_enabled} />}
      stages={stages}
      stage={stage}
      fill={stageFill(stage, { progress, moveProgress, capture: frontal.capture })}
      intro={intro}
      onCancel={onCancel}
      viewport={
        <CameraCapture camera={camera} className="camera--fill">
          <span className="faceid__label">{camera.activeLabel}</span>
          <FaceGuide ref={guideRef} tone={tone} message={message} detail={detail} progress={ring} stage={stage} complete={phase === 'submitting'} />
          <ScannerHints phase={phase} guidance={guidance} mode={mode.kind === 'action' ? mode : null} mirrored={camera.isMirrored} />
          <AccessoryBadges items={accessories} />
        </CameraCapture>
      }
      actions={
        <FlowActions
          shutter={manualPhoto ? { disabled: !shutterReady, label: t('employee.enrollment.index.action.photo'), onCapture: () => void onPhotoStable() } : null}
          manualCapture={
            detectorFailed && !manualPhoto
              ? { disabled: manualCaptureDisabled(cameraReady, scanning, virtualCamera), onCapture: () => void onStable() }
              : null
          }
          alternative={alternative}
        />
      }
    />
  );
}
