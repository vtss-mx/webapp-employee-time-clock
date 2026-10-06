import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from '../i18n';
import { BrandMark } from './Spinner';
import { Button } from './ui/Button';

interface AppErrorScreenProps {
  /** Acción del botón (por omisión, reintentar la carga). */
  onRetry: () => void;
  title?: string;
  message?: string;
  retryLabel?: string;
  /** Ícono del botón (por omisión, el de reintentar). */
  actionIcon?: ReactNode;
  /** Etiqueta sobre el título (por omisión, "Error al cargar" con su ícono). */
  badge?: ReactNode;
  /** Nota bajo el botón (p. ej. a quién acudir). */
  footnote?: ReactNode;
  /** La acción está en curso (el botón muestra que trabaja y no se puede volver a pulsar). */
  busy?: boolean;
}

/**
 * Pantalla completa de la app cuando no puede seguir: lo que necesita para abrir no se pudo cargar
 * (p. ej. los catálogos) o la empresa está suspendida (`SuspensionGate`). Es la misma pantalla blanca
 * de la carga, con el ícono de la marca al centro, qué pasó y una acción. El detalle técnico (código y
 * traceId) de un error ya se mostró en su popup; aquí queda la explicación y la acción.
 */
export function AppErrorScreen({ onRetry, title, message, retryLabel, actionIcon = <RefreshCw size={18} />, badge, footnote, busy = false }: AppErrorScreenProps) {
  // Los textos por omisión se calculan al dibujarse: siguen al idioma activo.
  const t = useT();
  return (
    <div className="app-splash" role="alert">
      <div className="brand-loader brand-loader--error">
        <BrandMark />
        <span className="brand-loader__badge">
          {badge ?? (
            <>
              <AlertTriangle size={14} aria-hidden /> {t('system.loadError.badge')}
            </>
          )}
        </span>
        <h1 className="brand-loader__title">{title ?? t('system.loadError.title')}</h1>
        <p className="brand-loader__message">{message ?? t('system.loadError.message')}</p>
        <Button variant="primary" size="lg" block icon={actionIcon} loading={busy} onClick={onRetry}>
          {retryLabel ?? t('common.actions.retry')}
        </Button>
        {footnote && <p className="brand-loader__footnote">{footnote}</p>}
      </div>
    </div>
  );
}
