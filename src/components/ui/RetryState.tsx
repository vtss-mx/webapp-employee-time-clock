import { RefreshCw } from 'lucide-react';
import { Button } from './Button';

/**
 * Lugar del contenido que no se pudo cargar. El motivo ya se mostró en el popup de mensajes;
 * aquí solo queda la acción para intentarlo de nuevo (sin avisos en línea).
 */
export function RetryState({ onRetry, label = 'Volver a cargar' }: { onRetry: () => void; label?: string }) {
  return (
    <div className="retry-state">
      <Button variant="secondary" icon={<RefreshCw size={18} />} onClick={onRetry}>
        {label}
      </Button>
    </div>
  );
}
