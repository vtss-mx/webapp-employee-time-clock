import { BadgeCheck, Download, Maximize2, QrCode, RefreshCw, ShieldCheck, Sun, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { Skeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { Panel, PanelFooter, PanelHero, PanelSection } from '../../components/ui/Panel';
import { useAuth } from '../../hooks/useAuth';
import { useFeedback } from '../../hooks/useFeedback';
import { ApiError } from '../../services/apiClient';
import { meService } from '../../services/meService';
import type { EmployeeQr } from '../../types';
import { formatDate } from '../../utils/format';
import { downloadUrl } from '../../utils/download';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; qr: EmployeeQr }
  | { kind: 'error' };

/** Código QR de identidad del empleado (disponible tras la aprobación de COMPANY). */
export function MyQrPage() {
  const { user } = useAuth();
  const feedback = useFeedback();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [fullscreen, setFullscreen] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setState({ kind: 'loading' });
    try {
      const qr = await meService.getMyQr(signal);
      setState({ kind: 'ready', qr });
    } catch (error) {
      if (signal?.aborted) return;
      setState({ kind: 'error' });
      // Sin QR asignado es un aviso (lo resuelve la empresa); cualquier otra falla, un error.
      if (error instanceof ApiError && error.code === 'QR_NOT_FOUND') {
        void feedback.warning('Aún no tienes un código QR', error.message, { key: 'qr-missing' });
      } else {
        void feedback.fromError(error, { title: 'No se pudo cargar tu código QR', retry: () => void load() });
      }
    }
  }, [feedback]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);


  const download = (qr: EmployeeQr) => {
    downloadUrl(qr.image_base64, qr.file_name);
    void feedback.success('QR descargado', qr.file_name);
  };

  const fullName = user?.employee?.full_name ?? user?.email ?? '';

  return (
    <div className="page page-transition">
      <Panel>
        <PanelHero eyebrow="Credencial digital" title="Mi código QR">
          <p className="muted">Tu identidad fue validada por tu empresa. Usa este código para identificarte.</p>
        </PanelHero>

        <PanelSection className="my-qr">
        {state.kind === 'loading' && (
          <div className="my-qr__body" aria-busy>
            <Skeleton width={260} height={260} radius={16} />
            <Skeleton width={180} height={18} />
            <Skeleton width={120} height={14} />
          </div>
        )}

        {state.kind === 'error' && (
          <div className="my-qr__body">
            <span className="my-qr__empty">
              <QrCode size={48} />
            </span>
            <Button variant="secondary" icon={<RefreshCw size={18} />} onClick={() => void load()}>
              Reintentar
            </Button>
          </div>
        )}

        {state.kind === 'ready' && (
          <div className="my-qr__body">
            <button type="button" className="my-qr__code" onClick={() => setFullscreen(true)} aria-label="Ampliar código QR">
              <img src={state.qr.image_base64} alt={`Código QR de ${fullName}`} />
              <span className="my-qr__zoom">
                <Maximize2 size={16} />
              </span>
            </button>
            <div className="my-qr__identity">
              <strong>{fullName}</strong>
              <span className="badge badge--success">
                <BadgeCheck size={14} /> Identidad validada
              </span>
            </div>
            <dl className="my-qr__meta">
              <div>
                <dt>No. de empleado</dt>
                <dd>{state.qr.employee_number}</dd>
              </div>
              <div>
                <dt>Vigencia</dt>
                <dd>{state.qr.expires_at ? formatDate(state.qr.expires_at) : 'Sin vencimiento'}</dd>
              </div>
            </dl>
            <div className="button-row" style={{ justifyContent: 'center' }}>
              <Button variant="primary" icon={<Maximize2 size={18} />} onClick={() => setFullscreen(true)}>
                Mostrar en grande
              </Button>
              <Button variant="secondary" icon={<Download size={18} />} onClick={() => download(state.qr)}>
                Descargar
              </Button>
            </div>
          </div>
        )}
        </PanelSection>

        <PanelFooter align="center">
          <ul className="my-qr__tips small muted">
            <li>
              <Sun size={16} /> Sube el brillo de tu pantalla para que el lector lo detecte más rápido.
            </li>
            <li>
              <ShieldCheck size={16} color="var(--success)" /> El código no contiene tus datos personales ni biométricos. No lo
              compartas: es personal e intransferible.
            </li>
          </ul>
        </PanelFooter>
      </Panel>

      {state.kind === 'ready' && (
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
            <img src={state.qr.image_base64} alt={`Código QR de ${fullName}`} />
            <strong>{state.qr.employee_number}</strong>
            <span className="muted small">Sube el brillo de tu pantalla para que se lea al instante.</span>
          </div>
        </Modal>
      )}
    </div>
  );
}
