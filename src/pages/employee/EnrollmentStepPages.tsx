import { ArrowLeft, Camera, Lock } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { enrollmentStepConfirm } from '../../components/enrollments/enrollmentConfirm';
import { enrollmentStepBlock, type EnrollmentStepKey } from '../../components/enrollments/enrollmentStepRules';
import { EnrollmentStepper, type EnrollmentStep } from '../../components/EnrollmentStepper';
import { LiveFaceFlow, type CapturedFace } from '../../components/LiveFaceFlow';
import { enrollmentCapture } from '../../components/liveFaceView';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Panel, PanelFooter, PanelHero } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { failureText, VoiceVerificationFlow } from '../../components/VoiceVerificationFlow';
import { useAction } from '../../hooks/useAction';
import { useAuth } from '../../hooks/useAuth';
import { useConfirm } from '../../hooks/useConfirm';
import { useFeedback } from '../../hooks/useFeedback';
import { useResource } from '../../hooks/useResource';
import { useVerificationPolicy } from '../../hooks/useVerificationPolicy';
import { t, useLocale } from '../../i18n';
import { resolveLazy } from '../../i18n/lazy';
import { paths } from '../../routes/paths';
import { ApiError } from '../../services/apiClient';
import { enrollmentService } from '../../services/enrollmentService';
import type { EnrollmentProgress, VoiceChallenge } from '../../types';
import { config } from '../../utils/config';
import { sleep } from '../../utils/waits';

/*
 * Las pantallas de los tres pasos INDEPENDIENTES del registro facial (decisión del dueño del producto, 2026-10-07): la
 * foto inicial, las capturas con prueba de vida y el video con preguntas, cada una en su ruta hija de la pantalla
 * `EMPLOYEE_ENROLL` (`paths.employee.enrollPhoto`, `enrollCapture`, `enrollVoice`). Las abre el índice (`EnrollmentPage`)
 * DESPUÉS de confirmar; abiertas a mano (un enlace, recargar) piden la misma confirmación con «Abrir cámara». Si el paso
 * no toca (falta el anterior, ya se hizo), lo dicen con su vacío en lugar de abrir la cámara. Al terminar regresan al
 * índice, que vuelve a pedir el estado al servidor; el último paso deja el registro en validación de la empresa.
 */

const fatalTitle = () => t('employee.enrollment.fatal');

/** Relee el usuario hasta 3 veces (1 s, 2 s, 4 s): una red que parpadea justo al enviar no deja al empleado en una
 * pantalla vieja. Devuelve si lo logró. */
export async function refreshWithRetry(refresh: () => Promise<void>, attempts = 3): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await refresh();
      return true;
    } catch {
      await sleep(1000 * 2 ** attempt);
    }
  }
  return false;
}

/** Volver al índice del registro (al terminar, cancelar o fallar): reemplaza la pantalla del paso en el historial. */
function useBackToIndex() {
  const navigate = useNavigate();
  return useCallback(() => void navigate(paths.employee.enroll, { replace: true }), [navigate]);
}

/**
 * El registro quedó en validación (el último paso): releer el usuario trae su nueva pantalla («En validación»); si no se
 * puede, se regresa al índice (la sesión se actualiza sola al volver la red). El error nunca sube al flujo facial: lo
 * tomaría por un envío fallido y volvería a enviar.
 */
function useFinished() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const feedback = useFeedback();
  const back = useBackToIndex();
  return useCallback(async () => {
    const updated = await refreshWithRetry(refreshUser);
    void feedback.success(
      () => t('employee.enrollment.sent.title'),
      () => (updated ? t('employee.enrollment.sent.text') : t('employee.enrollment.sent.offline')),
    );
    if (updated) void navigate(paths.employee.pending, { replace: true });
    else back();
  }, [back, feedback, navigate, refreshUser]);
}

const BLOCKED_ICONS: Record<EnrollmentStepKey, ReactNode> = { photo: <Camera size={28} />, captures: <Lock size={28} />, video: <Lock size={28} /> };

interface StepGateProps {
  step: EnrollmentStepKey;
  children: (progress: EnrollmentProgress, withVideo: boolean) => ReactNode;
}

/**
 * Lo común de las tres pantallas: el estado del servidor (`GET /enrollment/progress`), el vacío si el paso no toca y la
 * confirmación ANTES de abrir la cámara (la del índice viaja en `state.confirmed`; abierta a mano, la pide aquí).
 */
function StepGate({ step, children }: StepGateProps) {
  useLocale();
  const { user } = useAuth();
  const confirm = useConfirm();
  const back = useBackToIndex();
  const confirmed = Boolean((useLocation().state as { confirmed?: boolean } | null)?.confirmed);
  const [open, setOpen] = useState(confirmed);
  const { data: progress, error, retry } = useResource((signal) => enrollmentService.progress(signal), step, () => t('employee.enrollment.index.errorTitle'));

  if (!progress) return <div className="page page-transition">{error ? <RetryState onRetry={retry} /> : <SkeletonCard lines={6} />}</div>;
  const block = enrollmentStepBlock(step, progress);
  if (block) {
    return (
      <div className="page page--narrow page-transition">
        <EmptyState
          icon={BLOCKED_ICONS[step]}
          title={t(`employee.enrollment.blocked.${block}.title`)}
          description={t(`employee.enrollment.blocked.${block}.text`)}
          action={
            <Button variant="primary" icon={<ArrowLeft size={18} />} onClick={back}>
              {t('employee.enrollment.blocked.back')}
            </Button>
          }
        />
      </div>
    );
  }
  if (!open) {
    const start = async () => {
      if (await confirm(() => enrollmentStepConfirm(step, progress, user?.employee))) setOpen(true);
    };
    return (
      <div className="page page--narrow page-transition">
        <Panel>
          <PanelHero eyebrow={t('employee.enrollment.title')} title={t(`employee.enrollment.index.${step}.title`)}>
            <p className="muted">{t(`employee.enrollment.index.${step}.text`, { count: config.enrollmentValidPhotos })}</p>
          </PanelHero>
          <PanelFooter align="between">
            <Button variant="ghost" icon={<ArrowLeft size={18} />} onClick={back}>
              {t('employee.enrollment.blocked.back')}
            </Button>
            <Button variant="primary" icon={<Camera size={18} />} onClick={() => void start()}>
              {t('employee.enrollment.confirm.open')}
            </Button>
          </PanelFooter>
        </Panel>
      </div>
    );
  }
  return <div className="page page-transition">{children(progress, progress.voice.status !== 'not_required')}</div>;
}

/** El indicador de los pasos dentro de la tarjeta del escáner (sin el del video cuando la política no lo pide). */
const stepper = (current: EnrollmentStep, withVideo: boolean) => <EnrollmentStepper current={current} withVideo={withVideo} />;

/** Paso 1: la foto inicial. Una foto de frente; el servidor la valida y la guarda (cifrada) para las capturas. */
export function EnrollmentPhotoPage() {
  const feedback = useFeedback();
  const back = useBackToIndex();
  const { policy } = useVerificationPolicy();
  return (
    <StepGate step="photo">
      {(_, withVideo) => (
        <LiveFaceFlow
          steps={stepper('photo', withVideo)}
          title={t('employee.enrollment.title')}
          {...enrollmentCapture()}
          enrollmentStep="photo"
          submittingMessage={t('employee.enrollment.photoSaving')}
          policy={policy}
          onSubmit={async (captured) => {
            await enrollmentService.photo(captured);
            back();
          }}
          onFatal={(error) => {
            void feedback.fromError(error, { title: fatalTitle });
            back();
          }}
          onCancel={back}
        />
      )}
    </StepGate>
  );
}

/**
 * Envía las capturas (paso 2). ENROLLMENT_PENDING (409) significa que un envío anterior ya llegó (se perdió su respuesta y
 * se repitió): el registro está en validación. Devuelve si el registro quedó en validación (sin video que responder).
 */
async function submitCaptures(captured: CapturedFace): Promise<boolean> {
  try {
    return (await enrollmentService.submit(captured)).face_status === 'PENDING_REVIEW';
  } catch (error) {
    if (!(error instanceof ApiError && error.code === 'ENROLLMENT_PENDING')) throw error;
    return true;
  }
}

/** Paso 2: las capturas válidas con la prueba de vida completa (sin la foto inicial: ya se guardó en el paso 1). */
export function EnrollmentCapturePage() {
  const feedback = useFeedback();
  const back = useBackToIndex();
  const finished = useFinished();
  const { policy } = useVerificationPolicy();
  return (
    <StepGate step="captures">
      {(_, withVideo) => (
        <LiveFaceFlow
          steps={stepper('captures', withVideo)}
          title={t('employee.enrollment.title')}
          {...enrollmentCapture()}
          enrollmentStep="captures"
          submittingMessage={t('employee.enrollment.submitting')}
          policy={policy}
          onSubmit={async (captured) => {
            if (await submitCaptures(captured)) await finished();
            else back(); // sigue el video: el índice ya lo muestra disponible
          }}
          onFatal={(error) => {
            void feedback.fromError(error, { title: fatalTitle });
            back();
          }}
          onCancel={back}
        />
      )}
    </StepGate>
  );
}

/** Con estos códigos la sesión de preguntas solo venció o no es válida: se pide otra (las respuestas aceptadas siguen). */
const RENEWABLE: ReadonlySet<string> = new Set(['VOICE_SESSION_EXPIRED', 'VOICE_SESSION_INVALID']);

/** El video con preguntas: pide su sesión al abrirse (y otra si la anterior venció) y la responde. */
function VoiceStep({ withVideo }: { withVideo: boolean }) {
  const feedback = useFeedback();
  const back = useBackToIndex();
  const finished = useFinished();
  const { run } = useAction();
  const [challenge, setChallenge] = useState<VoiceChallenge | null>(null);
  const started = useRef(false);

  // Una falla al pedirla (sin red, intentos agotados, el registro ya no espera su video) se explica y regresa al índice.
  const start = useCallback(() => run(() => enrollmentService.startVoice(), { errorTitle: fatalTitle, onSuccess: setChallenge, onError: back }), [back, run]);

  // La sesión se pide UNA vez al abrir la pantalla (en desarrollo StrictMode corre el efecto dos veces: la marca lo evita).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start();
  }, [start]);

  if (!challenge) return <SkeletonCard lines={6} />;
  return (
    <VoiceVerificationFlow
      key={challenge.token}
      steps={stepper('video', withVideo)}
      challenge={challenge}
      onDone={() => void finished()}
      onRestart={(error) => {
        void feedback.fromError(error, { title: fatalTitle });
        if (error instanceof ApiError && RENEWABLE.has(error.code)) {
          setChallenge(null);
          void start();
        } else back(); // intentos agotados o el registro ya no espera su video: el índice dice qué repetir
      }}
      onFatal={(error) => {
        void feedback.show(() => ({ variant: 'error', title: fatalTitle(), text: resolveLazy(failureText(error)) }));
        back();
      }}
      onCancel={back}
    />
  );
}

/** Paso 3: el video con preguntas (solo si la política de la empresa lo pide; si no, la pantalla lo dice). */
export function EnrollmentVoicePage() {
  return <StepGate step="video">{(_, withVideo) => <VoiceStep withVideo={withVideo} />}</StepGate>;
}
