import { useCallback, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { attendanceProblem } from '../../../components/attendance/employee/attendanceProblems';
import { AttendanceResultCard } from '../../../components/attendance/employee/AttendanceResultCard';
import { isFresh, LocatingPanel, ProblemPanel, readLocation, type LocationFix } from '../../../components/attendance/employee/RecordSteps';
import { actionFromSlug, recordLabel } from '../../../components/attendance/employee/todayView';
import { LiveFaceFlow, type CapturedFace } from '../../../components/LiveFaceFlow';
import type { VerificationOutcome } from '../../../components/VerificationAttempt';
import { VerificationResultCard } from '../../../components/VerificationResultCard';
import { useCatalogs } from '../../../hooks/useCatalogs';
import { useFeedback } from '../../../hooks/useFeedback';
import { useMountedRef } from '../../../hooks/useMountedRef';
import { useVerificationPolicy } from '../../../hooks/useVerificationPolicy';
import { paths } from '../../../routes/paths';
import { errorMessage } from '../../../services/apiClient';
import { attendanceService } from '../../../services/attendanceService';
import type { AttendanceAction, AttendanceActionResult } from '../../../types';
import { config } from '../../../utils/config';

/** Pasos de un registro: ubicación → rostro → resultado (o un problema que se puede reintentar). */
type Step =
  | { kind: 'locating' }
  | { kind: 'face' }
  | { kind: 'recorded'; result: AttendanceActionResult }
  | { kind: 'failed'; outcome: VerificationOutcome }
  | { kind: 'problem' };

/**
 * Un registro de asistencia: primero la ubicación (aviso nativo del navegador), luego el rostro con la
 * política de la empresa y, con ambos, el registro (la hora la pone el servidor). Si la ubicación ya
 * no es reciente al enviar, se vuelve a leer. Los problemas de ubicación o de estado se explican en
 * un popup con "Reintentar"; un rostro no verificado se puede intentar de nuevo.
 */
function AttendanceRecorder({ action }: { action: AttendanceAction }) {
  const navigate = useNavigate();
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

  /** Otra vez: con una ubicación reciente, directo al rostro; si no, primero la ubicación. */
  const retry = () => {
    setAttempt((n) => n + 1);
    setStep({ kind: isFresh(fix.current) ? 'face' : 'locating' });
  };

  const fail = (error: unknown) => {
    const problem = attendanceProblem(error);
    if (!problem) {
      setStep({ kind: 'failed', outcome: { result: null, error: errorMessage(error) } });
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
    const result = await attendanceService.record(action, captured, location);
    setStep(result.verified ? { kind: 'recorded', result } : { kind: 'failed', outcome: { result: result.verification, error: null } });
  };

  if (step.kind === 'face') {
    return (
      <LiveFaceFlow
        key={attempt}
        title={title}
        frontalFrames={config.verificationFrames}
        submittingMessage={`Registrando tu ${actionName}...`}
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
          result={step.outcome.result}
          error={step.outcome.error}
          failureTitle={`No se registró tu ${actionName}`}
          backLabel="Volver a mi asistencia"
          onRetry={retry}
          onBack={back}
        />
      </div>
    );
  }
  if (step.kind === 'problem') return <ProblemPanel actionTitle={title} onRetry={retry} onCancel={back} />;
  return (
    <LocatingPanel
      key={attempt}
      actionTitle={title}
      onLocated={(located) => {
        fix.current = located;
        setStep({ kind: 'face' });
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
