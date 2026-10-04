import type { ReactNode } from 'react';
import { Overlay } from './Overlay';

interface ResultPopupProps {
  kind: 'success' | 'error';
  /** Id del título (para lectores de pantalla). */
  labelledBy: string;
  /** Cerrar con Escape o tocando fuera (lo mismo que su botón principal). */
  onDismiss: () => void;
  children: ReactNode;
}

/**
 * Resultado de una identificación o de un registro de asistencia como ventana emergente (sobre la
 * pantalla, con su color de éxito o error). Mismo `Overlay` que todos los popups de la app: hoja
 * inferior en teléfonos, foco dentro y fondo desenfocado.
 */
export function ResultPopup({ kind, labelledBy, onDismiss, children }: ResultPopupProps) {
  return (
    <Overlay role={kind === 'success' ? 'dialog' : 'alertdialog'} labelledBy={labelledBy} onDismiss={onDismiss} className={`msg--${kind} msg--result`}>
      {children}
    </Overlay>
  );
}
