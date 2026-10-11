import { ArrowLeft, Camera, Check, CircleHelp, Lock } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { EnrollmentDocumentStep, EnrollmentDocumentUpload } from '../../components/enrollments/EnrollmentDocumentStep';
import { enrollmentStepConfirm } from '../../components/enrollments/enrollmentConfirm';
import { EnrollmentStepper } from '../../components/EnrollmentStepper';
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
import { useCatalogs } from '../../hooks/useCatalogs';
import { useConfirm } from '../../hooks/useConfirm';
import { useFeedback } from '../../hooks/useFeedback';
import { useResource } from '../../hooks/useResource';
import { useVerificationPolicy } from '../../hooks/useVerificationPolicy';
import { t, useLocale, useT } from '../../i18n';
import { resolveLazy } from '../../i18n/lazy';
import { paths } from '../../routes/paths';
import { ApiError } from '../../services/apiClient';
import { enrollmentService } from '../../services/enrollmentService';
import type { EnrollmentProgress, EnrollmentStepState, VoiceChallenge } from '../../types';
import { isConsentRequired } from '../../utils/consents';
import { enrollmentStepBlock, stepOf, stepperSteps, usesCamera, type EnrollmentStepBlock } from '../../utils/enrollmentStepRules';
import { primeSpeech } from '../../utils/speech';
import { sleep } from '../../utils/waits';

/*
 * Las pantallas de CADA paso del registro de identidad (decisión del dueño del producto, 2026-10-08: el flujo es
 * dinámico y vive en un solo módulo; el ADMIN decide, por empresa, cuáles pasos se piden y en qué orden). Cada una es
 * una ruta hija de la pantalla `EMPLOYEE_ENROLL`: la foto inicial, las capturas con prueba de vida, el video con
 * preguntas y los documentos de identidad (su código del catálogo viaja en la ruta, así un paso de documentos nuevo no
 * agrega rutas).
 *
 * Las abre el índice (`EnrollmentPage`); las de cámara, DESPUÉS de confirmar (abiertas a mano —un enlace, recargar—
 * piden la misma confirmación con «Abrir cámara»). Si el paso no toca (lo bloquea otro, ya se hizo, la empresa dejó de
 * pedirlo, los intentos se agotaron o la app no lo conoce), lo dicen con su vacío en lugar de abrir la cámara. Al
 * terminar regresan al índice, que vuelve a pedir el estado al servidor; el último deja el registro en validación.
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

/** Los 409 que dicen que este paso ya no toca: el paso que falta viaja en `details.step` (regla 3). */
const STEP_GONE: ReadonlySet<string> = new Set(['ENROLLMENT_STEP_BLOCKED', 'ENROLLMENT_STEP_DISABLED']);

/**
 * El servidor dice que el paso ya no toca (otro va antes, o su empresa dejó de pedirlo): reintentar aquí no sirve, así
 * que se explica con el mensaje del servidor y se regresa al índice, que ya trae el estado al día. Nunca un callejón sin
 * salida (regla 3 de la raíz: cada código con la acción que sí puede funcionar). Devuelve si atendió el error.
 */
function useStepGone(back: () => void) {
  const feedback = useFeedback();
  return useCallback(
    (error: unknown) => {
      if (!(error instanceof ApiError && STEP_GONE.has(error.code))) return false;
      void feedback.fromError(error, { title: () => t('employee.enrollment.stepGone') });
      back();
      return true;
    },
    [back, feedback],
  );
}

/**
 * Falta el consentimiento biométrico (403 `BIOMETRIC_CONSENT_REQUIRED`): sin él el servidor no crea biometría y
 * reintentar aquí no puede funcionar. Se explica con el mensaje del servidor y se lleva a la pantalla del
 * consentimiento llevando el paso del que se viene (`state.from`): al otorgarlo, esa pantalla REANUDA este paso donde
 * iba (regla 7 de la raíz: cada código con la acción que sí funciona, nunca un callejón sin salida). Devuelve si
 * atendió el error.
 */
function useConsentNeeded() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const feedback = useFeedback();
  return useCallback(
    (error: unknown) => {
      if (!isConsentRequired(error)) return false;
      void feedback.fromError(error, { title: () => t('consents.missingTitle') });
      void navigate(paths.profileConsents, { state: { from: pathname } });
      return true;
    },
    [feedback, navigate, pathname],
  );
}

/** El ícono del vacío según POR QUÉ no se puede abrir el paso. */
const BLOCKED_ICONS: Record<EnrollmentStepBlock, ReactNode> = {
  unknown: <CircleHelp size={28} />,
  disabled: <Lock size={28} />,
  blocked: <Lock size={28} />,
  done: <Check size={28} />,
  exhausted: <Lock size={28} />,
};

interface StepGateProps {
  /** El código del paso (fijo en la pantalla o el de la ruta, en los de documentos). */
  code: string;
  children: (step: EnrollmentStepState, progress: EnrollmentProgress) => ReactNode;
}

/**
 * El vacío de un paso que no se puede abrir ahora, con «Volver al registro» (nunca la cámara ni un «Reintentar» que no
 * podría funcionar). Si lo bloquea otro paso, lo nombra con el catálogo (el nombre lo manda el backend traducido).
 */
function StepBlocked({ reason, step, onBack }: { reason: EnrollmentStepBlock; step: string | null; onBack: () => void }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  const description =
    reason === 'blocked' ? t('employee.enrollment.blocked.blocked.text', { step: nameOf('enrollment_steps', step) }) : t(`employee.enrollment.blocked.${reason}.text`);
  return (
    <div className="page page--narrow page-transition">
      <EmptyState
        icon={BLOCKED_ICONS[reason]}
        title={t(`employee.enrollment.blocked.${reason}.title`)}
        description={description}
        action={
          <Button variant="primary" icon={<ArrowLeft size={18} />} onClick={onBack}>
            {t('employee.enrollment.blocked.back')}
          </Button>
        }
      />
    </div>
  );
}

/**
 * Lo común de todas las pantallas de un paso: el estado del servidor (`GET /enrollment/progress`), el vacío si el paso
 * no toca y, en los pasos de cámara, la confirmación ANTES de abrirla (la del índice viaja en `state.confirmed`;
 * abierta a mano, la pide aquí). Un paso de documentos entra directo: su formulario confirma antes de subir.
 */
function StepGate({ code, children }: StepGateProps) {
  useLocale();
  const { user } = useAuth();
  const { nameOf, byCode } = useCatalogs();
  const confirm = useConfirm();
  const back = useBackToIndex();
  const confirmed = Boolean((useLocation().state as { confirmed?: boolean } | null)?.confirmed);
  const [open, setOpen] = useState(confirmed);
  const { data: progress, error, retry } = useResource((signal) => enrollmentService.progress(signal), code, () => t('employee.enrollment.index.errorTitle'));

  if (!progress) return <div className="page page-transition">{error ? <RetryState onRetry={retry} /> : <SkeletonCard lines={6} />}</div>;
  const gate = enrollmentStepBlock(code, progress);
  if (gate) return <StepBlocked reason={gate.reason} step={gate.step} onBack={back} />;
  const step = stepOf(progress, code) as EnrollmentStepState; // sin paso, `enrollmentStepBlock` ya devolvió «disabled»
  if (usesCamera(code) && !open) {
    const description = byCode('enrollment_steps', code)?.description;
    const start = async () => {
      // Desbloquea la síntesis de voz DENTRO del gesto (iOS la mantiene bloqueada hasta el primer `speak` en un toque):
      // se hace antes del `await` para que corra síncronamente con el clic. Es seguro aunque la guía esté apagada o el
      // navegador no la soporte (no hace nada), así que no se condiciona a la política.
      primeSpeech();
      if (await confirm(() => enrollmentStepConfirm(code, step, user?.employee))) setOpen(true);
    };
    return (
      <div className="page page--narrow page-transition">
        <Panel>
          <PanelHero eyebrow={t('employee.enrollment.title')} title={nameOf('enrollment_steps', code)}>
            {description && <p className="muted">{description}</p>}
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
  return <div className="page page-transition">{children(step, progress)}</div>;
}

/** El indicador de los pasos dentro de la tarjeta del escáner: los del flujo de la empresa, con el actual marcado. */
const stepper = (progress: EnrollmentProgress, current: string) => <EnrollmentStepper steps={stepperSteps(progress)} current={current} />;

/** La foto inicial: una foto de frente; el servidor la valida y la guarda (cifrada) para las capturas. */
export function EnrollmentPhotoPage() {
  const feedback = useFeedback();
  const back = useBackToIndex();
  const gone = useStepGone(back);
  const consent = useConsentNeeded();
  const { policy } = useVerificationPolicy();
  return (
    <StepGate code="INITIAL_PHOTO">
      {(_, progress) => (
        <LiveFaceFlow
          steps={stepper(progress, 'INITIAL_PHOTO')}
          title={t('employee.enrollment.title')}
          {...enrollmentCapture()}
          enrollmentStep="photo"
          submittingMessage={t('employee.enrollment.photoSaving')}
          policy={policy}
          onSubmit={async (captured) => {
            try {
              await enrollmentService.photo(captured);
              back();
            } catch (error) {
              if (!consent(error) && !gone(error)) throw error; // el resto lo explica el flujo facial y deja volver a tomarla
            }
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
 * Envía las capturas. ENROLLMENT_PENDING (409) significa que un envío anterior ya llegó (se perdió su respuesta y se
 * repitió): el registro está en validación. Devuelve si el registro quedó en validación (sin video que responder).
 */
async function submitCaptures(captured: CapturedFace): Promise<boolean> {
  try {
    return (await enrollmentService.submit(captured)).face_status === 'PENDING_REVIEW';
  } catch (error) {
    if (!(error instanceof ApiError && error.code === 'ENROLLMENT_PENDING')) throw error;
    return true;
  }
}

/** Las capturas válidas con la prueba de vida completa (sin la foto inicial: ya se guardó en su paso). */
export function EnrollmentCapturePage() {
  const feedback = useFeedback();
  const back = useBackToIndex();
  const gone = useStepGone(back);
  const consent = useConsentNeeded();
  const finished = useFinished();
  const { policy } = useVerificationPolicy();
  return (
    <StepGate code="FACE_CAPTURES">
      {(_, progress) => (
        <LiveFaceFlow
          steps={stepper(progress, 'FACE_CAPTURES')}
          title={t('employee.enrollment.title')}
          {...enrollmentCapture()}
          enrollmentStep="captures"
          submittingMessage={t('employee.enrollment.submitting')}
          policy={policy}
          onSubmit={async (captured) => {
            try {
              if (await submitCaptures(captured)) await finished();
              else back(); // sigue otro paso (el video): el índice ya lo muestra disponible
            } catch (error) {
              if (!consent(error) && !gone(error)) throw error;
            }
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
function VoiceStep({ progress }: { progress: EnrollmentProgress }) {
  const feedback = useFeedback();
  const back = useBackToIndex();
  const finished = useFinished();
  const { run } = useAction();
  const [challenge, setChallenge] = useState<VoiceChallenge | null>(null);
  const started = useRef(false);

  // Una falla al pedirla (sin red, intentos agotados, el paso ya no toca) se explica y regresa al índice.
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
      steps={stepper(progress, 'VOICE_VIDEO')}
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

/** El video con preguntas (solo si el flujo de la empresa lo pide; si no, la pantalla lo dice). */
export function EnrollmentVoicePage() {
  return <StepGate code="VOICE_VIDEO">{(_, progress) => <VoiceStep progress={progress} />}</StepGate>;
}

/** El código del paso de documentos que pide la ruta (`/employee/enroll/document/:step`). */
const useStepParam = () => useParams().step ?? '';

/** Un paso de documentos: qué pide, el documento vigente y la lista de lo que el empleado ya subió. */
export function EnrollmentDocumentPage() {
  return <StepGate code={useStepParam()}>{(step) => <EnrollmentDocumentStep step={step} />}</StepGate>;
}

/** Subir el archivo de un paso de documentos (su formulario; confirma antes de subir). */
export function EnrollmentDocumentUploadPage() {
  return <StepGate code={useStepParam()}>{(step) => <EnrollmentDocumentUpload step={step} />}</StepGate>;
}
