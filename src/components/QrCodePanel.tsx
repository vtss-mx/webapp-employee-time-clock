import { Download, Eye, QrCode, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useFeedback } from '../hooks/useFeedback';
import { employeeService } from '../services/employeeService';
import type { EmployeeQr } from '../types';
import { formatDate, formatDateTime } from '../utils/format';
import { ConfirmDialog, Modal } from './Modal';
import { Button } from './ui/Button';
import { PanelSection } from './ui/Panel';
import { downloadUrl } from '../utils/download';

interface QrCodePanelProps {
  employeeId: number;
  employeeName: string;
  hasActiveQr: boolean;
  onChanged: () => void;
}

/** Sección "Código QR" del panel de detalle de empleado: ver, descargar y regenerar. */
export function QrCodePanel({ employeeId, employeeName, hasActiveQr, onChanged }: QrCodePanelProps) {
  const feedback = useFeedback();
  const [qr, setQr] = useState<EmployeeQr | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState<'view' | 'download' | 'regenerate' | null>(null);

  const fetchQr = async (): Promise<EmployeeQr> => {
    const data = qr ?? (await employeeService.getQr(employeeId));
    setQr(data);
    return data;
  };

  const download = (data: EmployeeQr) => {
    downloadUrl(data.image_base64, data.file_name);
    feedback.success('QR descargado', data.file_name);
  };

  const run = async (kind: 'view' | 'download', action: (data: EmployeeQr) => void) => {
    setLoading(kind);
    try {
      action(await fetchQr());
    } catch (e) {
      void feedback.fromError(e, { title: 'No se pudo obtener el QR' });
    } finally {
      setLoading(null);
    }
  };

  const regenerate = async () => {
    setLoading('regenerate');
    try {
      const data = await employeeService.regenerateQr(employeeId);
      setQr(data);
      setConfirmOpen(false);
      feedback.success('Nuevo QR generado', 'El código anterior ya no es válido.');
      setViewOpen(true);
      onChanged();
    } catch (e) {
      void feedback.fromError(e, { title: 'No se pudo regenerar' });
      setConfirmOpen(false);
    } finally {
      setLoading(null);
    }
  };

  return (
    <PanelSection
      title="Código QR"
      icon={<QrCode size={20} />}
      aside={<span className={`badge ${hasActiveQr ? 'badge--success' : 'badge--warning'}`}>{hasActiveQr ? 'Activo' : 'Sin QR'}</span>}
    >
      <p className="muted">
        {hasActiveQr
          ? 'Código de identificación personal. No contiene datos personales ni biométricos.'
          : 'El empleado no tiene un QR activo. Genera uno nuevo.'}
      </p>

      <div className="button-row">
        <Button variant="secondary" icon={<Eye size={18} />} disabled={!hasActiveQr || (loading !== null && loading !== 'view')} loading={loading === 'view'} onClick={() => run('view', () => setViewOpen(true))}>
          Ver QR
        </Button>
        <Button variant="secondary" icon={<Download size={18} />} disabled={!hasActiveQr || (loading !== null && loading !== 'download')} loading={loading === 'download'} onClick={() => run('download', download)}>
          Descargar QR
        </Button>
        <Button variant="warning" icon={<RefreshCw size={18} />} disabled={loading !== null} onClick={() => setConfirmOpen(true)}>
          Regenerar QR
        </Button>
      </div>

      <Modal
        open={viewOpen && qr !== null}
        title={employeeName}
        icon={<QrCode size={30} />}
        eyebrow="Código QR"
        onClose={() => setViewOpen(false)}
        footer={
          qr && (
            <Button variant="primary" icon={<Download size={18} />} onClick={() => download(qr)}>
              Descargar
            </Button>
          )
        }
      >
        {qr && (
          <div className="qr-view">
            <img src={qr.image_base64} alt={`Código QR del empleado ${qr.employee_number}`} />
            <strong>{qr.employee_number}</strong>
            <p className="muted small">
              Generado: {formatDateTime(qr.created_at)}
              <br />
              Vence: {qr.expires_at ? formatDate(qr.expires_at) : 'Sin vencimiento'}
            </p>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="Regenerar código QR"
        message="Se invalidará el QR actual de forma inmediata y se generará uno nuevo. ¿Deseas continuar?"
        confirmLabel="Regenerar"
        tone="danger"
        loading={loading === 'regenerate'}
        onConfirm={regenerate}
        onCancel={() => setConfirmOpen(false)}
      />
    </PanelSection>
  );
}
