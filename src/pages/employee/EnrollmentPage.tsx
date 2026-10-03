import { AlertTriangle, ArrowRight, ShieldCheck, UserCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaceRequirements } from '../../components/FaceRequirements';
import { scanStages, ScanStagesPreview } from '../../components/FaceScan';
import { LiveFaceFlow } from '../../components/LiveFaceFlow';
import { Button } from '../../components/ui/Button';
import { Panel, PanelFooter, PanelHero, PanelSection } from '../../components/ui/Panel';
import { useAuth } from '../../hooks/useAuth';
import { useFeedback } from '../../hooks/useFeedback';
import { useVerificationPolicy } from '../../hooks/useVerificationPolicy';
import { paths } from '../../routes/paths';
import { enrollmentService } from '../../services/enrollmentService';
import { config } from '../../utils/config';

/** Primer inicio de sesión (o registro rechazado): el empleado registra su rostro. */
export function EnrollmentPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const feedback = useFeedback();
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
    const tips = ['Ubícate en un lugar bien iluminado.', 'Mira de frente a la cámara, con el rostro descubierto.'];
    if (rejected) {
      void feedback.warning(
        'Tu registro anterior fue rechazado',
        rejectionReason ? `Motivo: “${rejectionReason}”.` : 'Tu empresa no pudo validar tu identidad con las capturas enviadas.',
        { details: tips, key: 'enrollment-rejected' },
      );
    } else if (reverify) {
      void feedback.info('Verifica nuevamente tu identidad', rejectionReason, {
        eyebrow: 'Solicitud de tu empresa',
        details: ['Registra tu rostro con prueba de vida; toma alrededor de un minuto.', ...tips],
        key: 'identity-reverify',
      });
    }
  }, [rejected, reverify, rejectionReason, feedback]);

  if (started) {
    return (
      <LiveFaceFlow
        title="Registro facial"
        frontalFrames={config.enrollmentFrames}
        submittingMessage="Enviando registro seguro..."
        policy={policy}
        allowAccessoryReview
        onSubmit={async (captured) => {
          await enrollmentService.submit(captured, captured.accessoryReview);
          await refreshUser();
          void feedback.success('Registro enviado', 'Tu empresa validará tu identidad en breve.');
          void navigate(paths.employee.pending, { replace: true });
        }}
        onFatal={(error) => {
          setStarted(false);
          void feedback.fromError(error, { title: 'No se pudo completar el registro' });
        }}
        onCancel={() => setStarted(false)}
      />
    );
  }

  return (
    <div className="page page-transition">
      <Panel>
        <PanelHero
          eyebrow={`${stages.length} pasos · 1 minuto`}
          title={rejected || reverify ? 'Registra tu rostro nuevamente' : `Bienvenido, ${employee?.first_name ?? ''}`}
        >
          <p className="muted">Para proteger tu identidad, registra tu rostro. Solo se hace una vez y tu empresa lo validará.</p>
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
                  <strong>Después: validación de tu empresa</strong>
                  <span className="muted small">Tu empresa revisa y aprueba tu identidad; te avisamos al terminar.</span>
                </div>
              </li>
            }
          />
          <div className="stack" style={{ gap: 10 }}>
            <span className="inline-note small muted">
              <AlertTriangle size={16} /> Antes de comenzar:
            </span>
            <FaceRequirements policy={policy} headwearExempt={employee?.headwear_exempt} />
          </div>
        </PanelSection>

        <PanelFooter align="between">
          <p className="inline-note small muted">
            <ShieldCheck size={16} color="var(--success)" /> Solo guardamos datos cifrados; nunca se comparten.
          </p>
          <Button variant="primary" size="lg" iconRight={<ArrowRight size={20} />} onClick={() => setStarted(true)}>
            Comenzar registro
          </Button>
        </PanelFooter>
      </Panel>
    </div>
  );
}
