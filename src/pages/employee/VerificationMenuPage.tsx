import { ArrowRight, QrCode, ScanFace, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Panel, PanelFooter, PanelHero, PanelSection } from '../../components/ui/Panel';
import { useAuth } from '../../hooks/useAuth';
import { useVerificationPolicy } from '../../hooks/useVerificationPolicy';
import { paths } from '../../routes/paths';

export function VerificationMenuPage() {
  const { user } = useAuth();
  const firstName = user?.employee?.first_name;
  const { policy } = useVerificationPolicy();

  return (
    <div className="page page-transition">
      <Panel>
        <PanelHero eyebrow="Identificación" title={firstName ? `Hola, ${firstName}` : 'Hola'}>
          <p className="muted">¿Cómo deseas identificarte?</p>
        </PanelHero>

        <PanelSection>
          <div className="method-grid stagger">
            <Link to={paths.employee.verifyFace} className="method-card">
              <span className="method-card__icon">
                <ScanFace size={42} />
              </span>
              <span className="method-card__title">VERIFICAR CON ROSTRO</span>
              <span className="method-card__desc">
                {policy.liveness_challenge ? 'Reconocimiento facial con prueba de vida' : 'Reconocimiento facial'}
              </span>
              <span className="method-card__cta">
                Comenzar <ArrowRight size={18} />
              </span>
            </Link>

            {policy.qr_enabled && (
              <Link to={paths.employee.myQr} className="method-card">
                <span className="method-card__icon">
                  <QrCode size={42} />
                </span>
                <span className="method-card__title">MOSTRAR MI QR</span>
                <span className="method-card__desc">Muéstralo al validador: cambia cada {policy.qr_lifetime_seconds} s y sirve una sola vez</span>
                <span className="method-card__cta">
                  Mostrar <ArrowRight size={18} />
                </span>
              </Link>
            )}
          </div>
        </PanelSection>
        <PanelFooter align="center">
          <p className="inline-note small muted">
            <ShieldCheck size={16} color="var(--success)" /> Identidad validada por tu empresa · Conexión protegida
          </p>
        </PanelFooter>
      </Panel>
    </div>
  );
}
