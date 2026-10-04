import { BadgeCheck, Maximize2, QrCode, RefreshCw, ShieldCheck, Sun, X } from 'lucide-react';
import { useState } from 'react';
import { DynamicQrCode, QrCountdown } from '../../components/DynamicQrCode';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/ui/Button';
import { Panel, PanelFooter, PanelHero, PanelSection } from '../../components/ui/Panel';
import { useAuth } from '../../hooks/useAuth';
import { useDynamicQr } from '../../hooks/useDynamicQr';
import { useErrorPopup } from '../../hooks/useFeedback';
import { useVerificationPolicy } from '../../hooks/useVerificationPolicy';

/**
 * Credencial digital del empleado: un QR DINÁMICO que se renueva solo (vigencia de la política de
 * su empresa) y al usarse. Cada código sirve una sola vez, así que no se descarga ni se imprime:
 * una foto o captura de pantalla no sirve para identificarse después.
 */
export function MyQrPage() {
  const { user } = useAuth();
  const { policy } = useVerificationPolicy();
  const code = useDynamicQr();
  const [fullscreen, setFullscreen] = useState(false);
  useErrorPopup(code.error, { title: 'No se pudo generar tu código QR', retry: () => void code.renew() });

  const fullName = user?.employee?.full_name ?? user?.email ?? '';
  const lifetime = code.qr?.lifetime_seconds ?? policy.qr_lifetime_seconds;
  const renewing = code.phase === 'loading' || code.phase === 'used';
  const shared = {
    qr: code.qr,
    phase: code.phase,
    deadline: code.deadline,
    alt: `Código QR de ${fullName}`,
    onRenew: () => void code.renew(),
  };
  const countdown = code.phase === 'ready' ? <QrCountdown key={code.deadline} deadline={code.deadline} /> : null;

  return (
    <div className="page page-transition">
      <Panel>
        <PanelHero eyebrow="Credencial digital" title="Mi código QR">
          <p className="muted">Muéstralo al validador para identificarte. Cambia cada {lifetime} s y sirve una sola vez.</p>
        </PanelHero>

        <PanelSection className="my-qr">
          <div className="my-qr__body">
            <DynamicQrCode {...shared} onOpen={() => setFullscreen(true)} />
            {countdown}
            <div className="my-qr__identity">
              <strong>{fullName}</strong>
              <span className="badge badge--success">
                <BadgeCheck size={14} /> Identidad validada
              </span>
              {code.qr && <span className="muted small">No. de empleado {code.qr.employee_number}</span>}
            </div>
            <div className="button-row my-qr__actions">
              <Button variant="primary" icon={<Maximize2 size={18} />} disabled={!code.qr} onClick={() => setFullscreen(true)}>
                Mostrar en grande
              </Button>
              <Button variant="secondary" icon={<RefreshCw size={18} />} loading={renewing} onClick={() => void code.renew()}>
                Generar otro
              </Button>
            </div>
          </div>
        </PanelSection>

        <PanelFooter align="center">
          <ul className="my-qr__tips small muted">
            <li>
              <Sun size={16} /> Sube el brillo de tu pantalla para que el lector lo detecte más rápido.
            </li>
            <li>
              <ShieldCheck size={16} color="var(--success)" /> Cada código sirve una sola vez y vence en segundos: una foto o
              captura de pantalla no sirve. No contiene tus datos personales ni biométricos.
            </li>
          </ul>
        </PanelFooter>
      </Panel>

      <Modal
        open={fullscreen}
        title={fullName}
        icon={<QrCode size={30} />}
        eyebrow="Mi código QR"
        onClose={() => setFullscreen(false)}
        footer={
          <Button variant="primary" size="lg" icon={<X size={20} />} onClick={() => setFullscreen(false)}>
            Cerrar
          </Button>
        }
      >
        <div className="qr-view qr-view--large">
          <DynamicQrCode {...shared} large />
          {countdown}
          {code.qr && <strong>{code.qr.employee_number}</strong>}
          <span className="muted small">Sube el brillo de tu pantalla para que se lea al instante.</span>
        </div>
      </Modal>
    </div>
  );
}
