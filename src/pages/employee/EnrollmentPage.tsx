import { AlertTriangle, ArrowRight, Camera, ScanFace, ShieldCheck, UserCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaceRequirements } from '../../components/FaceRequirements';
import { scanStages, ScanStagesPreview } from '../../components/FaceScan';
import { LiveFaceFlow, type CapturedFace } from '../../components/LiveFaceFlow';
import { enrollmentCapture } from '../../components/liveFaceView';
import { Button } from '../../components/ui/Button';
import { Panel, PanelFooter, PanelHero, PanelSection } from '../../components/ui/Panel';
import { useAuth } from '../../hooks/useAuth';
import { useConfirm } from '../../hooks/useConfirm';
import { useFeedback } from '../../hooks/useFeedback';
import { useVerificationPolicy } from '../../hooks/useVerificationPolicy';
import { t, useLocale } from '../../i18n';
import { paths } from '../../routes/paths';
import { ApiError } from '../../services/apiClient';
import { enrollmentService } from '../../services/enrollmentService';
import { sleep } from '../../utils/waits';

/**
 * Envía el registro. ENROLLMENT_PENDING (409) significa que un envío anterior ya llegó (p. ej. se
 * perdió su respuesta y se repitió): el registro está en validación, así que cuenta como enviado.
 */
async function submitEnrollment(captured: CapturedFace): Promise<void> {
  try {
    await enrollmentService.submit(captured, captured.accessoryReview);
  } catch (error) {
    if (!(error instanceof ApiError && error.code === 'ENROLLMENT_PENDING')) throw error;
  }
}

/** Consejos para una buena captura (en el idioma activo). */
const captureTips = () => [t('employee.enrollment.tips.light'), t('employee.enrollment.tips.front')];

/** Primer inicio de sesión (o registro rechazado): el empleado registra su rostro. */
/** Relee el usuario hasta 3 veces (1 s, 2 s, 4 s): una red que parpadea justo al enviar no deja al
 * empleado en una pantalla vieja. Devuelve si lo logró. */
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

export function EnrollmentPage() {
  useLocale(); // textos con `t` al dibujarse; popups y confirmaciones reciben funciones y siguen al idioma abiertos
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const feedback = useFeedback();
  const confirm = useConfirm();
  const [started, setStarted] = useState(false);
  const { policy } = useVerificationPolicy();
  // Las mismas etapas que contará el escáner ("n / N"): cinco con prueba de vida, cuatro sin ella.
  const stages = scanStages(policy.liveness_challenge);
  const employee = user?.employee;
  const rejected = employee?.face_status === 'REJECTED';
  const rejectionReason = employee?.face_rejection_reason;
  // La empresa pidió verificar de nuevo la identidad (registro reiniciado, con su motivo).
  const reverify = employee?.face_status === 'NOT_ENROLLED' && Boolean(rejectionReason);

  // Registro rechazado o nueva verificación solicitada: se explica en un popup al entrar.
  useEffect(() => {
    if (rejected) {
      void feedback.show(() => ({
        variant: 'warning',
        title: t('employee.enrollment.rejected.title'),
        text: rejectionReason ? t('employee.enrollment.rejected.reason', { reason: rejectionReason }) : t('employee.enrollment.rejected.noReason'),
        details: captureTips(),
        key: 'enrollment-rejected',
      }));
    } else if (reverify) {
      void feedback.show(() => ({
        variant: 'info',
        title: t('employee.enrollment.reverify.title'),
        text: rejectionReason,
        eyebrow: t('employee.enrollment.reverify.eyebrow'),
        details: [t('employee.enrollment.reverify.step'), ...captureTips()],
        key: 'identity-reverify',
      }));
    }
  }, [rejected, reverify, rejectionReason, feedback]);

  /** El registro crea sus datos biométricos: se confirma antes de abrir la cámara. */
  const start = async () => {
    const ok = await confirm(() => ({
      kind: 'create',
      icon: <ScanFace size={30} />,
      eyebrow: t('employee.enrollment.title'),
      title: t('employee.enrollment.confirm.title'),
      message: t('employee.enrollment.confirm.message'),
      details: captureTips(),
      note: rejected || reverify ? t('employee.enrollment.confirm.replaces') : undefined,
      confirmLabel: t('employee.enrollment.confirm.open'),
      confirmIcon: <Camera size={18} />,
    }));
    if (ok) setStarted(true);
  };

  if (started) {
    return (
      <LiveFaceFlow
        title={t('employee.enrollment.title')}
        {...enrollmentCapture()}
        submittingMessage={t('employee.enrollment.submitting')}
        policy={policy}
        allowAccessoryReview
        onSubmit={async (captured) => {
          await submitEnrollment(captured);
          // El registro ya quedó guardado. Releer el usuario (con reintentos) trae su nueva pantalla
          // (en validación); si aun así falla, NO se navega a una pantalla que el usuario viejo no
          // tiene (rebotaría al registro): la sesión se actualiza sola al volver la red y lo lleva.
          // El error nunca sube al flujo facial: lo tomaría por un envío fallido y volvería a enviar.
          const updated = await refreshWithRetry(refreshUser);
          void feedback.success(
            () => t('employee.enrollment.sent.title'),
            () => (updated ? t('employee.enrollment.sent.text') : t('employee.enrollment.sent.offline')),
          );
          if (updated) void navigate(paths.employee.pending, { replace: true });
          else setStarted(false);
        }}
        onFatal={(error) => {
          setStarted(false);
          void feedback.fromError(error, { title: () => t('employee.enrollment.fatal') });
        }}
        onCancel={() => setStarted(false)}
      />
    );
  }

  return (
    <div className="page page-transition">
      <Panel>
        <PanelHero
          eyebrow={t('employee.enrollment.duration', { count: stages.length })}
          title={rejected || reverify ? t('employee.enrollment.again') : t('employee.enrollment.welcome', { name: employee?.first_name ?? '' })}
        >
          <p className="muted">{t('employee.enrollment.intro')}</p>
        </PanelHero>

        <PanelSection>
          <ScanStagesPreview
            stages={stages}
            after={
              <li>
                <span className="timeline__dot" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
                  <UserCheck size={16} />
                </span>
                <div>
                  <strong>{t('employee.enrollment.after.title')}</strong>
                  <span className="muted small">{t('employee.enrollment.after.text')}</span>
                </div>
              </li>
            }
          />
          <div className="stack" style={{ gap: 10 }}>
            <span className="inline-note small muted">
              <AlertTriangle size={16} /> {t('employee.enrollment.before')}
            </span>
            <FaceRequirements policy={policy} headwearExempt={employee?.headwear_exempt} />
          </div>
        </PanelSection>

        <PanelFooter align="between">
          <p className="inline-note small muted">
            <ShieldCheck size={16} color="var(--success)" /> {t('employee.enrollment.privacy')}
          </p>
          <Button variant="primary" size="lg" iconRight={<ArrowRight size={20} />} onClick={() => void start()}>
            {t('employee.enrollment.start')}
          </Button>
        </PanelFooter>
      </Panel>
    </div>
  );
}
