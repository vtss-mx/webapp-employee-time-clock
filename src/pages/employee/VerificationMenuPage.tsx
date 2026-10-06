import { ArrowRight, QrCode, ScanFace, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Panel, PanelFooter, PanelHero, PanelSection } from '../../components/ui/Panel';
import { useAuth } from '../../hooks/useAuth';
import { useVerificationPolicy } from '../../hooks/useVerificationPolicy';
import { useT } from '../../i18n';
import { paths } from '../../routes/paths';

export function VerificationMenuPage() {
  const t = useT();
  const { user } = useAuth();
  const firstName = user?.employee?.first_name;
  const { policy } = useVerificationPolicy();

  return (
    <div className="page page-transition">
      <Panel>
        <PanelHero eyebrow={t('employee.menu.eyebrow')} title={firstName ? t('employee.menu.hello', { name: firstName }) : t('employee.menu.helloAnonymous')}>
          <p className="muted">{t('employee.menu.question')}</p>
        </PanelHero>

        <PanelSection>
          <div className="method-grid stagger">
            <Link to={paths.employee.verifyFace} className="method-card">
              <span className="method-card__icon">
                <ScanFace size={42} />
              </span>
              <span className="method-card__title">{t('employee.menu.face')}</span>
              <span className="method-card__desc">{policy.liveness_challenge ? t('employee.menu.faceLiveness') : t('employee.menu.faceOnly')}</span>
              <span className="method-card__cta">
                {t('employee.menu.start')} <ArrowRight size={18} />
              </span>
            </Link>

            {policy.qr_enabled && (
              <Link to={paths.employee.myQr} className="method-card">
                <span className="method-card__icon">
                  <QrCode size={42} />
                </span>
                <span className="method-card__title">{t('employee.menu.qr')}</span>
                <span className="method-card__desc">{t('employee.menu.qrText', { seconds: policy.qr_lifetime_seconds })}</span>
                <span className="method-card__cta">
                  {t('employee.menu.show')} <ArrowRight size={18} />
                </span>
              </Link>
            )}
          </div>
        </PanelSection>
        <PanelFooter align="center">
          <p className="inline-note small muted">
            <ShieldCheck size={16} color="var(--success)" /> {t('employee.menu.footer')}
          </p>
        </PanelFooter>
      </Panel>
    </div>
  );
}
