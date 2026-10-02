import { RotateCcw, ScanFace } from 'lucide-react';
import { useState } from 'react';
import { FieldLabel } from './FormField';
import { Modal } from './Modal';
import { ReasonChips } from './ReasonChips';
import { Button } from './ui/Button';

interface ReverifyIdentityModalProps {
  open: boolean;
  firstName: string;
  busy: boolean;
  onCancel: () => void;
  /** Motivo escrito o elegido; undefined = mensaje genérico para el empleado. */
  onConfirm: (reason: string | undefined) => void;
}

/** COMPANY solicita al empleado verificar de nuevo su identidad, con un motivo que él verá. */
export function ReverifyIdentityModal({ open, firstName, busy, onCancel, onConfirm }: ReverifyIdentityModalProps) {
  const [reason, setReason] = useState('');
  const close = () => {
    if (busy) return;
    setReason('');
    onCancel();
  };
  return (
    <Modal
      open={open}
      title="Solicitar nueva verificación de identidad"
      variant="warning"
      icon={<ScanFace size={30} />}
      eyebrow="Verificación de identidad"
      onClose={close}
      footer={
        <>
          <Button variant="ghost" size="lg" onClick={close} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant="warning"
            size="lg"
            icon={<RotateCcw size={18} />}
            loading={busy}
            data-primary=""
            onClick={() => onConfirm(reason.trim() || undefined)}
          >
            Solicitar verificación
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className="muted">
          Se eliminarán sus datos faciales actuales. En su próximo acceso, {firstName} deberá registrar su rostro con prueba de
          vida y tendrás que validarlo nuevamente. Mientras tanto no podrá identificarse.
        </p>
        <ReasonChips catalog="reverification_reasons" value={reason} onPick={setReason} />
        <div className="field">
          <FieldLabel htmlFor="reverify-reason" label="Motivo (opcional, visible para el empleado)" />
          <textarea
            id="reverify-reason"
            className="textarea"
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Si no escribes un motivo, se le indicará que la empresa solicitó verificar su identidad."
          />
        </div>
      </div>
    </Modal>
  );
}
