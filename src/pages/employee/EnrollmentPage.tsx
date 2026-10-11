import { AlertTriangle, ShieldCheck, UserCheck } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { enrollmentStepConfirm, replacesEnrollment } from '../../components/enrollments/enrollmentConfirm';
import { EnrollmentSteps } from '../../components/enrollments/EnrollmentSteps';
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
import { openableStep, usesCamera } from '../../utils/enrollmentStepRules';

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
 * Registro de identidad del propio empleado: el ÍNDICE del flujo que pide SU empresa (decisión del dueño del producto,
 * 2026-10-08: «el proceso de registro facial debe ser DINÁMICO y un SOLO módulo; el ADMIN decide, por empresa, cuáles
 * pasos se piden y en qué orden»). La app no sabe cuáles ni cuántos son: dibuja `steps` de `GET /enrollment/progress`
 * EN SU ORDEN, con el nombre y la descripción de cada paso del catálogo `enrollment_steps` y su estado desde el
 * servidor (pendiente, hecho con su fecha, bloqueado por otro paso, vencido, intentos agotados, «2 de 3 respondidas»).
 *
 * Un paso que abre la cámara o el micrófono confirma ANTES de abrirse y lleva a su pantalla (`EnrollmentStepPages`),
 * que al terminar regresa aquí con el estado al día; un paso de documentos lleva a su formulario, que pregunta antes de
 * subir el archivo. La persona puede salir después de cualquier paso y volver otro día: lo hecho se conserva en el
 * servidor (el orden también lo exige el servidor). Al terminar el último, el registro queda en validación.
 */
export function EnrollmentPage() {
  useLocale(); // textos con `t` al dibujarse; popups y confirmaciones reciben funciones y siguen al idioma abiertos
  const { user } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { policy } = useVerificationPolicy();
  const again = useEnrollmentNotices();
  const { data: progress, error, retry } = useResource((signal) => enrollmentService.progress(signal), 'enrollment-progress', () => t('employee.enrollment.index.errorTitle'));

  /**
   * Abre la pantalla de un paso. Los de cámara confirman antes (su pantalla ya no vuelve a preguntar: `state.confirmed`);
   * los de documentos llevan a su formulario, que confirma antes de subir. Un código sin pantalla (un backend más nuevo)
   * no tiene botón en el índice: aquí siempre llega un paso del flujo con su pantalla (`openableStep`).
   */
  const open = async (current: EnrollmentProgress, code: string) => {
    const { step, path } = openableStep(current, code);
    if (!usesCamera(code)) {
      void navigate(path);
      return;
    }
    if (await confirm(() => enrollmentStepConfirm(code, step, user?.employee))) void navigate(path, { state: { confirmed: true } });
  };

  if (!progress) {
    return <div className="page page-transition">{error ? <RetryState onRetry={retry} /> : <SkeletonCard lines={6} />}</div>;
  }
  return (
    <div className="page page-transition">
      <Panel>
        <PanelHero
          eyebrow={t('employee.enrollment.index.steps', { count: progress.steps.length })}
          title={again ? t('employee.enrollment.again') : t('employee.enrollment.welcome', { name: user?.employee?.first_name ?? '' })}
        >
          <p className="muted">{t('employee.enrollment.intro')}</p>
          <p className="muted small">{t('employee.enrollment.index.resume')}</p>
        </PanelHero>

        <PanelSection>
          <EnrollmentSteps progress={progress} onOpen={(code) => void open(progress, code)} />
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
