import { Ban, QrCode, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useFeedback } from '../hooks/useFeedback';
import { useResource } from '../hooks/useResource';
import { useVerificationPolicy } from '../hooks/useVerificationPolicy';
import { employeeService } from '../services/employeeService';
import { formatDateTime, timeAgo } from '../utils/format';
import { ConfirmDialog } from './Modal';
import { Button } from './ui/Button';
import { PanelSection } from './ui/Panel';
import { RetryState } from './ui/RetryState';

/**
 * Sección "Código QR" del detalle de un empleado. El QR es dinámico: el empleado lo genera en su
 * teléfono, cambia cada pocos segundos y sirve una sola vez, así que la empresa no lo ve ni lo
 * imprime. Aquí ve su actividad y puede invalidar el vigente (su teléfono muestra otro).
 */
export function QrCodePanel({ employeeId }: { employeeId: number }) {
  const feedback = useFeedback();
  const { policy } = useVerificationPolicy();
  const { data: summary, setData, error, retry } = useResource(() => employeeService.qrSummary(employeeId), employeeId, 'No se pudo cargar la actividad del QR');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const revoke = async () => {
    setBusy(true);
    try {
      setData(await employeeService.revokeQr(employeeId));
      void feedback.success('Código invalidado', 'El código que tenía en pantalla ya no sirve; en su teléfono podrá mostrar uno nuevo.');
    } catch (e) {
      void feedback.fromError(e, { title: 'No se pudo invalidar el código' });
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  const live = summary?.live ?? false;
  return (
    <PanelSection
      title="Código QR dinámico"
      icon={<QrCode size={20} />}
      aside={summary && <span className={`badge ${live ? 'badge--success badge--live' : 'badge--muted'}`}>{live ? 'En pantalla' : 'Sin código vigente'}</span>}
    >
      <p className="muted">
        El empleado lo genera en su teléfono (Mi código QR). Cambia cada {policy.qr_lifetime_seconds} s y sirve una sola vez: no se
        descarga ni se imprime.
      </p>
      {!summary && error ? <RetryState onRetry={retry} /> : null}
      {summary && (
        <dl className="details">
          <div>
            <dt>Vigente hasta</dt>
            <dd>{summary.live_until ? formatDateTime(summary.live_until) : '—'}</dd>
          </div>
          <div>
            <dt>Último generado</dt>
            <dd title={summary.last_issued_at ? formatDateTime(summary.last_issued_at) : undefined}>{summary.last_issued_at ? timeAgo(summary.last_issued_at) : 'Nunca'}</dd>
          </div>
          <div>
            <dt>Último uso</dt>
            <dd title={summary.last_used_at ? formatDateTime(summary.last_used_at) : undefined}>{summary.last_used_at ? timeAgo(summary.last_used_at) : 'Nunca'}</dd>
          </div>
        </dl>
      )}
      <div className="button-row">
        <Button variant="secondary" icon={<RefreshCw size={18} />} disabled={busy} onClick={retry}>
          Actualizar
        </Button>
        <Button variant="danger-outline" icon={<Ban size={18} />} disabled={!live || busy} onClick={() => setConfirmOpen(true)}>
          Invalidar código vigente
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Invalidar el código vigente"
        message="El código que el empleado tiene en pantalla dejará de servir de inmediato; en su teléfono podrá mostrar uno nuevo. ¿Deseas continuar?"
        confirmLabel="Invalidar"
        tone="danger"
        loading={busy}
        onConfirm={() => void revoke()}
        onCancel={() => setConfirmOpen(false)}
      />
    </PanelSection>
  );
}
