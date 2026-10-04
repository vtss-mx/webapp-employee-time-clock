import { AlertTriangle, ArrowRight, Camera, ScanFace, ShieldCheck, UserCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaceRequirements } from '../../components/FaceRequirements';
import { scanStages, ScanStagesPreview } from '../../components/FaceScan';
import { LiveFaceFlow, type CapturedFace } from '../../components/LiveFaceFlow';
import { Button } from '../../components/ui/Button';
import { Panel, PanelFooter, PanelHero, PanelSection } from '../../components/ui/Panel';
import { useAuth } from '../../hooks/useAuth';
import { useConfirm } from '../../hooks/useConfirm';
import { useFeedback } from '../../hooks/useFeedback';
import { useVerificationPolicy } from '../../hooks/useVerificationPolicy';
import { paths } from '../../routes/paths';
import { ApiError } from '../../services/apiClient';
import { enrollmentService } from '../../services/enrollmentService';
import { config } from '../../utils/config';
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

  /** El registro crea sus datos biométricos: se confirma antes de abrir la cámara. */
  const start = async () => {
    const ok = await confirm({
      kind: 'create',
      icon: <ScanFace size={30} />,
      eyebrow: 'Registro facial',
      title: '¿Registrar tu rostro?',
      message: 'Se abrirá la cámara para capturar tu rostro con prueba de vida. Al terminar, tu empresa validará tu identidad.',
      details: ['Ubícate en un lugar bien iluminado.', 'Mira de frente a la cámara, con el rostro descubierto.'],
      note: rejected || reverify ? 'Tu registro anterior se reemplazará por este.' : undefined,
      confirmLabel: 'Abrir cámara',
      confirmIcon: <Camera size={18} />,
    });
    if (ok) setStarted(true);
  };

  if (started) {
    return (
      <LiveFaceFlow
        title="Registro facial"
        frontalFrames={config.enrollmentFrames}
        submittingMessage="Enviando registro seguro..."
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
            'Registro enviado',
            updated ? 'Tu empresa validará tu identidad en breve.' : 'Tu empresa validará tu identidad en breve. Tu pantalla se actualizará en cuanto vuelva la conexión.',
          );
          if (updated) void navigate(paths.employee.pending, { replace: true });
          else setStarted(false);
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
          <Button variant="primary" size="lg" iconRight={<ArrowRight size={20} />} onClick={() => void start()}>
            Comenzar registro
          </Button>
        </PanelFooter>
      </Panel>
    </div>
  );
}
