import { BadgeCheck, Maximize2, QrCode, RefreshCw, ScanFace, ShieldCheck, Sun, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { DynamicQrCode, QrCountdown } from '../../components/DynamicQrCode';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Panel, PanelFooter, PanelHero, PanelSection } from '../../components/ui/Panel';
import { useAuth } from '../../hooks/useAuth';
import { useDynamicQr } from '../../hooks/useDynamicQr';
import { useErrorPopup } from '../../hooks/useFeedback';
import { useVerificationPolicy } from '../../hooks/useVerificationPolicy';
import { t, useLocale } from '../../i18n';
import { ApiError, errorMessage } from '../../services/apiClient';

/**
 * Si el QR no puede generarse por una REGLA de la empresa (no un fallo pasajero), el estado vacío que lo explica (sin
 * «Reintentar», que nunca pasaría): QR deshabilitado o registro facial aún no aprobado. null: no es una regla (un fallo
 * pasajero o de servidor se muestra con su popup y «Reintentar»).
 */
function qrUnavailable(error: unknown): { title: string; icon: ReactNode } | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code === 'QR_DISABLED') return { title: t('employee.myQr.unavailable.qrTitle'), icon: <QrCode /> };
  if (error.code === 'FACE_NOT_APPROVED') return { title: t('employee.myQr.unavailable.faceTitle'), icon: <ScanFace /> };
  return null;
}

/**
 * Credencial digital del empleado: un QR DINÁMICO que se renueva solo (vigencia de la política de
 * su empresa) y al usarse. Cada código sirve una sola vez, así que no se descarga ni se imprime:
 * una foto o captura de pantalla no sirve para identificarse después.
 */
export function MyQrPage() {
  useLocale(); // textos con `t` al dibujarse: un cambio de idioma los traduce sin cambiar el código
  const { user } = useAuth();
  const { policy } = useVerificationPolicy();
  const code = useDynamicQr();
  const [fullscreen, setFullscreen] = useState(false);
  // Una regla de la empresa (QR deshabilitado, rostro sin aprobar) no se reintenta: se explica con un estado vacío.
  // Un fallo pasajero o de servidor sí: su popup con «Reintentar».
  const unavailable = qrUnavailable(code.error);
  useErrorPopup(unavailable ? null : code.error, { title: () => t('employee.myQr.errorTitle'), retry: () => void code.renew() });

  if (unavailable) {
    return (
      <div className="page page-transition">
        <Panel>
          <PanelHero eyebrow={t('employee.myQr.eyebrow')} title={t('employee.myQr.title')} />
          <PanelSection>
            <EmptyState icon={unavailable.icon} title={unavailable.title} description={errorMessage(code.error)} />
          </PanelSection>
        </Panel>
      </div>
    );
  }

  const fullName = user?.employee?.full_name ?? user?.email ?? '';
  const lifetime = code.qr?.lifetime_seconds ?? policy.qr_lifetime_seconds;
  const renewing = code.phase === 'loading' || code.phase === 'used';
  const shared = {
    qr: code.qr,
    phase: code.phase,
    deadline: code.deadline,
    alt: t('employee.myQr.alt', { name: fullName }),
    onRenew: () => void code.renew(),
  };
  const countdown = code.phase === 'ready' ? <QrCountdown key={code.deadline} deadline={code.deadline} /> : null;

  return (
    <div className="page page-transition">
      <Panel>
        <PanelHero eyebrow={t('employee.myQr.eyebrow')} title={t('employee.myQr.title')}>
          <p className="muted">{t('employee.myQr.intro', { seconds: lifetime })}</p>
        </PanelHero>

        <PanelSection className="my-qr">
          <div className="my-qr__body">
            <DynamicQrCode {...shared} onOpen={() => setFullscreen(true)} />
            {countdown}
            <div className="my-qr__identity">
              <strong>{fullName}</strong>
              <span className="badge badge--success">
                <BadgeCheck size={14} /> {t('employee.myQr.validated')}
              </span>
              {code.qr?.employee_number && <span className="muted small">{t('employee.myQr.employeeNumber', { number: code.qr.employee_number })}</span>}
            </div>
            <div className="button-row my-qr__actions">
              <Button variant="primary" icon={<Maximize2 size={18} />} disabled={!code.qr} onClick={() => setFullscreen(true)}>
                {t('employee.myQr.enlarge')}
              </Button>
              <Button variant="secondary" icon={<RefreshCw size={18} />} loading={renewing} onClick={() => void code.renew()}>
                {t('employee.myQr.another')}
              </Button>
            </div>
          </div>
        </PanelSection>

        <PanelFooter align="center">
          <ul className="my-qr__tips small muted">
            <li>
              <Sun size={16} /> {t('employee.myQr.brightness')}
            </li>
            <li>
              <ShieldCheck size={16} color="var(--success)" /> {t('employee.myQr.singleUse')}
            </li>
          </ul>
        </PanelFooter>
      </Panel>

      <Modal
        open={fullscreen}
        title={fullName}
        icon={<QrCode size={30} />}
        eyebrow={t('employee.myQr.title')}
        onClose={() => setFullscreen(false)}
        footer={
          <Button variant="primary" size="lg" icon={<X size={20} />} onClick={() => setFullscreen(false)}>
            {t('common.actions.close')}
          </Button>
        }
      >
        <div className="qr-view qr-view--large">
          <DynamicQrCode {...shared} large />
          {countdown}
          {code.qr?.employee_number && <strong>{code.qr.employee_number}</strong>}
          <span className="muted small">{t('employee.myQr.brightnessLarge')}</span>
        </div>
      </Modal>
    </div>
  );
}
