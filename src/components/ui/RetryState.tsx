import { RefreshCw } from 'lucide-react';
import { useT } from '../../i18n';
import { Button } from './Button';

/**
 * Lugar del contenido que no se pudo cargar. El motivo ya se mostró en el popup de mensajes;
 * aquí solo queda la acción para intentarlo de nuevo (sin avisos en línea).
 */
export function RetryState({ onRetry, label }: { onRetry: () => void; label?: string }) {
  const t = useT();
  return (
    <div className="retry-state">
      <Button variant="secondary" icon={<RefreshCw size={18} />} onClick={onRetry}>
        {label ?? t('ui.retry')}
      </Button>
    </div>
  );
}
