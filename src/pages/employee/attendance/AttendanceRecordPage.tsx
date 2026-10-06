import { useCallback, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { attendanceProblem } from '../../../components/attendance/employee/attendanceProblems';
import { AttendanceResultCard } from '../../../components/attendance/employee/AttendanceResultCard';
import { isFresh, LocatingPanel, ProblemPanel, readLocation, type LocationFix } from '../../../components/attendance/employee/RecordSteps';
import { isSiteCodeError, SiteCodeStep, siteCodeIntent } from '../../../components/attendance/employee/SiteCodeStep';
import { actionFromSlug, recordLabel } from '../../../components/attendance/employee/todayView';
import { LiveFaceFlow, type CapturedFace } from '../../../components/LiveFaceFlow';
import { VerificationResultCard } from '../../../components/VerificationResultCard';
import { useCatalogs } from '../../../hooks/useCatalogs';
import { useFeedback } from '../../../hooks/useFeedback';
import { useMountedRef } from '../../../hooks/useMountedRef';
import { useVerificationPolicy } from '../../../hooks/useVerificationPolicy';
import { t as translate, useT } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { errorMessage } from '../../../services/apiClient';
import { attendanceService } from '../../../services/attendanceService';
import type { AttendanceAction, AttendanceActionResult, VerificationResult } from '../../../types';
import { config } from '../../../utils/config';

/**
 * Pasos de un registro: ubicación → código del sitio (si lo pide) → rostro → resultado (o un problema que se puede
 * reintentar). Un fallo guarda el error (no su texto): se explica al dibujar, en el idioma activo.
 */
type Step =
  | { kind: 'locating' }
  | { kind: 'siteCode' }
  | { kind: 'face' }
  | { kind: 'recorded'; result: AttendanceActionResult }
  | { kind: 'failed'; result: VerificationResult | null; error: unknown }
  | { kind: 'problem' };

/** Título del popup cuando el servidor pide (otra vez) el código del sitio; el motivo es su mensaje. */
const siteCodeRejected = () => translate('myAttendance.siteCode.rejected');

/**
 * Un registro de asistencia: primero la ubicación (aviso nativo del navegador), luego el código del sitio si "Mi
 * asistencia" dijo que lo pide (entrada y salida, antifraude 2b), el rostro con la política de la empresa y, con todo,
 * el registro (la hora la pone el servidor). Si la ubicación ya no es reciente al enviar, se vuelve a leer. Los
 * problemas de ubicación o de estado se explican en un popup con "Reintentar"; un rostro no verificado se puede
 * intentar de nuevo; un código que falta, equivocado o ya usado regresa al paso del código (aunque no se pidiera).
 */
function AttendanceRecorder({ action }: { action: AttendanceAction }) {
  const t = useT();
  const navigate = useNavigate();
  const intent = siteCodeIntent(useLocation().state);
  const [needsCode, setNeedsCode] = useState(intent.siteCode && (action === 'CHECK_IN' || action === 'CHECK_OUT'));
  // El código del kiosco (o null: sin código), solo en memoria; cada intento pide uno nuevo.
  const siteCode = useRef<string | null>(null);
  const feedback = useFeedback();
  const mounted = useMountedRef();
  const { nameOf } = useCatalogs();
  const { policy } = useVerificationPolicy();
  const [step, setStep] = useState<Step>({ kind: 'locating' });
  // Cada intento monta de nuevo la lectura de la ubicación o la cámara (libera la anterior).
  const [attempt, setAttempt] = useState(0);
  const fix = useRef<LocationFix | null>(null);
  const actionName = nameOf('attendance_actions', action).toLowerCase();
  const title = recordLabel(actionName);
  // Al salir se reemplaza esta pantalla: "atrás" en Mi asistencia no vuelve a abrir la cámara.
  const back = useCallback(() => void navigate(paths.employee.attendance, { replace: true }), [navigate]);

  /** Después de la ubicación: el código del sitio si se pide; si no, el rostro. */
  const located = (needs = needsCode): Step => ({ kind: needs ? 'siteCode' : 'face' });
  const withCode = (code: string | null) => {
    siteCode.current = code;
    setStep({ kind: 'face' });
  };

  /** Otra vez: con una ubicación reciente, directo al código (si se pide) o al rostro; si no, primero la ubicación. */
  const retry = () => {
    setAttempt((n) => n + 1);
    setStep(isFresh(fix.current) ? located() : { kind: 'locating' });
  };

  const fail = (error: unknown) => {
    if (isSiteCodeError(error)) {
      setNeedsCode(true);
      setAttempt((n) => n + 1);
      setStep(located(true));
      void feedback.fromError(error, { title: siteCodeRejected });
      return;
    }
    const problem = attendanceProblem(error);
    if (!problem) {
      setStep({ kind: 'failed', result: null, error });
      return;
    }
    fix.current = null; // la siguiente vez se lee una ubicación nueva
    if (problem.kind === 'stale') {
      back(); // "Mi asistencia" vuelve a pedir lo que se puede registrar ahora
      void feedback.show(problem.message);
      return;
    }
    setStep({ kind: 'problem' });
    void feedback.show(problem.message).then((choice) => {
      if (choice === 'retry' && mounted.current) retry();
    });
  };

  // Los errores del registro suben al flujo facial: los corregibles (pose, luz, prueba de vida) los
  // reintenta solo; los demás llegan a `fail` (onFatal).
  const submit = async (captured: CapturedFace) => {
    const location = isFresh(fix.current) ? fix.current : await readLocation();
    fix.current = location;
    const result = await attendanceService.record(action, captured, location, siteCode.current);
    setStep(result.verified ? { kind: 'recorded', result } : { kind: 'failed', result: result.verification, error: null });
  };

  if (step.kind === 'face') {
    return (
      <LiveFaceFlow
        key={attempt}
        title={title}
        frontalFrames={config.verificationFrames}
        submittingMessage={t('myAttendance.record.submitting', { action: actionName })}
        policy={policy}
        onSubmit={submit}
        onFatal={fail}
        onCancel={back}
      />
    );
  }
  if (step.kind === 'recorded') {
    return (
      <div className="page page--narrow">
        <AttendanceResultCard result={step.result} onDone={back} />
      </div>
    );
  }
  if (step.kind === 'failed') {
    return (
      <div className="page page--narrow">
        <VerificationResultCard
          result={step.result}
          error={step.error === null ? null : errorMessage(step.error)}
          failureTitle={t('myAttendance.record.failed', { action: actionName })}
          backLabel={t('myAttendance.record.problem.back')}
          onRetry={retry}
          onBack={back}
        />
      </div>
    );
  }
  if (step.kind === 'problem') return <ProblemPanel actionTitle={title} onRetry={retry} onCancel={back} />;
  if (step.kind === 'siteCode') {
    return <SiteCodeStep key={attempt} remoteAllowed={intent.remoteAllowed} onCode={withCode} onRemote={() => withCode(null)} onCancel={back} />;
  }
  return (
    <LocatingPanel
      key={attempt}
      actionTitle={title}
      onLocated={(reading) => {
        fix.current = reading;
        setStep(located());
      }}
      onFailed={fail}
      onCancel={back}
    />
  );
}

/** Registrar entrada, descanso o salida (/employee/attendance/record/:action). Otra ruta vuelve a Mi asistencia. */
export function AttendanceRecordPage() {
  const { action: slug } = useParams();
  const action = actionFromSlug(slug);
  if (!action) return <Navigate to={paths.employee.attendance} replace />;
  return <AttendanceRecorder key={action} action={action} />;
}
