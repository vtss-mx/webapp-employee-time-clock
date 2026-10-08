import { AlertTriangle, ShieldCheck, UserCheck } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { enrollmentStepConfirm, replacesEnrollment } from '../../components/enrollments/enrollmentConfirm';
import { EnrollmentSteps } from '../../components/enrollments/EnrollmentSteps';
import { ENROLLMENT_STEP_PATHS, type EnrollmentStepKey } from '../../components/enrollments/enrollmentStepRules';
import { FaceRequirements } from '../../components/FaceRequirements';
import { Panel, PanelFooter, PanelHero, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { useConfirm } from '../../hooks/useConfirm';
import { useFeedback } from '../../hooks/useFeedback';
import { useResource } from '../../hooks/useResource';
import { useVerificationPolicy } from '../../hooks/useVerificationPolicy';
import { t, useLocale } from '../../i18n';
import { enrollmentService } from '../../services/enrollmentService';
import type { EnrollmentProgress } from '../../types';

/** Consejos para una buena captura (en el idioma activo). */
const captureTips = () => [t('employee.enrollment.tips.light'), t('employee.enrollment.tips.front')];

/**
 * Marcas de aviso ya mostradas en esta sesión. El aviso de «registro rechazado» / «verifica de nuevo» se abre UNA sola
 * vez por marca (motivo): volver al índice, recargar el progreso o cambiar de idioma NO lo reabre (antes salía en cada
 * montaje y molestaba). Vive en memoria del módulo (sin `localStorage`, como el aviso de alertas lentas); una marca nueva
 * —otro motivo— sí vuelve a avisar. En una recarga de la página se avisa de nuevo (una vez por apertura de la app).
 */
const notifiedEnrollment = new Set<string>();

/** Para las pruebas: olvida lo avisado, así cada caso arranca limpio. */
export function resetEnrollmentNotices() {
  notifiedEnrollment.clear();
}

/** Avisos al entrar: el registro anterior se rechazó o la empresa pidió verificar de nuevo la identidad (popup). */
function useEnrollmentNotices() {
  const { user } = useAuth();
  const feedback = useFeedback();
  const employee = user?.employee;
  const rejected = employee?.face_status === 'REJECTED';
  const reverify = !rejected && replacesEnrollment(employee);
  const reason = employee?.face_rejection_reason;
  useEffect(() => {
    const kind = rejected ? 'rejected' : reverify ? 'reverify' : null;
    if (!kind) return;
    const mark = `${kind}:${reason ?? ''}`;
    if (notifiedEnrollment.has(mark)) return; // ya se avisó en esta sesión: no se reabre al volver al índice
    notifiedEnrollment.add(mark);
    if (rejected) {
      void feedback.show(() => ({
        variant: 'warning',
        title: t('employee.enrollment.rejected.title'),
        text: reason ? t('employee.enrollment.rejected.reason', { reason }) : t('employee.enrollment.rejected.noReason'),
        details: captureTips(),
        key: 'enrollment-rejected',
      }));
    } else {
      // Llegar aquí con `rejected` en falso implica `reverify` verdadero: el guardia de arriba (`if (!kind) return`) ya
      // descartó el caso sin aviso, así que no se repite la condición (era una rama inalcanzable).
      void feedback.show(() => ({
        variant: 'info',
        title: t('employee.enrollment.reverify.title'),
        text: reason,
        eyebrow: t('employee.enrollment.reverify.eyebrow'),
        details: [t('employee.enrollment.reverify.step'), ...captureTips()],
        key: 'identity-reverify',
      }));
    }
  }, [rejected, reverify, reason, feedback]);
  return rejected || reverify;
}

/**
 * Registro facial del propio empleado: el ÍNDICE de sus pasos independientes (decisión del dueño del producto, 2026-10-07:
 * «debe haber una opción para tomar la foto, otra para el enrolamiento y otra para tomar el video y contestar las
 * preguntas»). Cada paso muestra su estado DESDE EL SERVIDOR (`GET /enrollment/progress`: pendiente, hecho con su fecha,
 * bloqueado porque falta el anterior, vencido, intentos agotados, «2 de 3 respondidas») y su botón; el botón confirma
 * ANTES de abrir la cámara y lleva a la pantalla del paso (`EnrollmentStepPages`), que al terminar regresa aquí con el
 * estado al día. La persona puede salir después de cualquier paso y volver otro día: lo hecho se conserva en el servidor
 * (el orden también lo exige el servidor). Al terminar el último, el registro queda en validación de la empresa.
 */
export function EnrollmentPage() {
  useLocale(); // textos con `t` al dibujarse; popups y confirmaciones reciben funciones y siguen al idioma abiertos
  const { user } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { policy } = useVerificationPolicy();
  const again = useEnrollmentNotices();
  const { data: progress, error, retry } = useResource((signal) => enrollmentService.progress(signal), 'enrollment-progress', () => t('employee.enrollment.index.errorTitle'));

  /** Cada paso confirma antes de abrir la cámara; su pantalla ya no vuelve a preguntar (`state.confirmed`). */
  const open = async (current: EnrollmentProgress, step: EnrollmentStepKey) => {
    const ok = await confirm(() => enrollmentStepConfirm(step, current, user?.employee));
    if (ok) void navigate(ENROLLMENT_STEP_PATHS[step], { state: { confirmed: true } });
  };

  if (!progress) {
    return <div className="page page-transition">{error ? <RetryState onRetry={retry} /> : <SkeletonCard lines={6} />}</div>;
  }
  const steps = progress.voice.status === 'not_required' ? 2 : 3;
  return (
    <div className="page page-transition">
      <Panel>
        <PanelHero
          eyebrow={t('employee.enrollment.index.steps', { count: steps })}
          title={again ? t('employee.enrollment.again') : t('employee.enrollment.welcome', { name: user?.employee?.first_name ?? '' })}
        >
          <p className="muted">{t('employee.enrollment.intro')}</p>
          <p className="muted small">{t('employee.enrollment.index.resume')}</p>
        </PanelHero>

        <PanelSection>
          <EnrollmentSteps progress={progress} onOpen={(step) => void open(progress, step)} />
          <p className="inline-note small muted">
            <UserCheck size={16} />
            <span>
              <strong>{t('employee.enrollment.after.title')}</strong> {t('employee.enrollment.after.text')}
            </span>
          </p>
          <div className="stack" style={{ gap: 10 }}>
            <span className="inline-note small muted">
              <AlertTriangle size={16} /> {t('employee.enrollment.before')}
            </span>
            <FaceRequirements policy={policy} />
          </div>
        </PanelSection>

        <PanelFooter>
          <p className="inline-note small muted">
            <ShieldCheck size={16} color="var(--success)" /> {t('employee.enrollment.privacy')}
          </p>
        </PanelFooter>
      </Panel>
    </div>
  );
}
