import { AlertTriangle, ArrowRight, Fingerprint, ScanFace, ShieldCheck, UserCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaceRequirements } from '../../components/FaceRequirements';
import { LiveFaceFlow } from '../../components/LiveFaceFlow';
import { Button } from '../../components/ui/Button';
import { Panel, PanelFooter, PanelHero, PanelSection } from '../../components/ui/Panel';
import { useAuth } from '../../hooks/useAuth';
import { useFeedback } from '../../hooks/useFeedback';
import { useVerificationPolicy } from '../../hooks/useVerificationPolicy';
import { paths } from '../../routes/paths';
import { enrollmentService } from '../../services/enrollmentService';
import { config } from '../../utils/config';

const STEPS = [
  { icon: ScanFace, title: 'Captura tu rostro', text: 'Mira de frente a la cámara; tomamos 5 muestras automáticamente.' },
  { icon: Fingerprint, title: 'Prueba de vida', text: 'Gira la cabeza cuando se te indique para confirmar que eres tú.' },
  { icon: UserCheck, title: 'Validación', text: 'Tu empresa revisa y aprueba tu identidad.' },
];

/** Primer inicio de sesión (o registro rechazado): el empleado registra su rostro. */
export function EnrollmentPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const feedback = useFeedback();
  const [started, setStarted] = useState(false);
  const { policy } = useVerificationPolicy();
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
        description="Mira de frente a la cámara en un lugar iluminado. Después gira la cabeza cuando se te indique."
        frontalFrames={config.enrollmentFrames}
        finalStep="Envío"
        submittingMessage="Enviando registro seguro..."
        policy={policy}
        headwearExempt={employee?.headwear_exempt}
        allowAccessoryReview
        onSubmit={async ({ frontal, challenge, accessoryReview }) => {
          await enrollmentService.submit(frontal, challenge, accessoryReview);
          await refreshUser();
          feedback.success('Registro enviado', 'Tu empresa validará tu identidad en breve.');
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
          eyebrow="Paso único · 1 minuto"
          title={rejected || reverify ? 'Registra tu rostro nuevamente' : `Bienvenido, ${employee?.first_name ?? ''}`}
        >
          <p className="muted">Para proteger tu identidad, registra tu rostro. Solo se hace una vez y tu empresa lo validará.</p>
        </PanelHero>

        <PanelSection>
          <ol className="timeline stagger">
            {STEPS.filter((step) => policy.liveness_challenge || step.title !== 'Prueba de vida').map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <span className="timeline__dot" style={{ background: 'var(--blue-50)', color: 'var(--primary)' }}>
                  <Icon size={16} />
                </span>
                <div>
                  <strong>{title}</strong>
                  <span className="muted small">{text}</span>
                </div>
              </li>
            ))}
          </ol>
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
