import { AlertOctagon, Home, RotateCcw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useT } from '../i18n';
import { reportClientError } from '../services/clientErrorService';
import { isChunkLoadError, reloadForNewVersion } from '../services/versionReload';
import { retryFailedLazy } from './retryableLazy';
import { Button } from './ui/Button';

interface Props {
  children: ReactNode;
  /** Variante compacta para secciones (no pantalla completa). */
  inline?: boolean;
}

interface State {
  error: Error | null;
}

/** El componente que se rompió: el primero de la pila de componentes de React («at Nombre (...)»). */
function brokenComponent(componentStack: string | null | undefined): string | undefined {
  return componentStack ? /at (\S+)/.exec(componentStack)?.[1] : undefined;
}

/** Lo que se ve en lugar de la pantalla rota (un componente: sus textos siguen al idioma activo). */
function CrashScreen({ inline = false, onRetry }: { inline?: boolean; onRetry: () => void }) {
  const t = useT();
  return (
    <div className={inline ? 'error-inline' : 'center-page'} role="alert">
      <span className="icon-tile icon-tile--lg icon-tile--danger">
        <AlertOctagon size={32} />
      </span>
      <h1 style={{ fontSize: inline ? '1.2rem' : undefined }}>{t('system.crash.title')}</h1>
      <p className="muted">{t('system.crash.message')}</p>
      <div className="button-row" style={{ justifyContent: 'center' }}>
        <Button variant="primary" icon={<RotateCcw size={18} />} onClick={onRetry}>
          {t('common.actions.retry')}
        </Button>
        <Button variant="ghost" icon={<Home size={18} />} onClick={() => window.location.assign('/')}>
          {t('system.goHome')}
        </Button>
      </div>
    </div>
  );
}

/**
 * Captura errores de render en tiempo de ejecución para que un fallo en una pantalla no deje
 * la aplicación en blanco. Ofrece reintentar sin perder la sesión: con una pantalla que no se pudo
 * descargar, "Reintentar" la descarga de nuevo (`retryFailedLazy`). Si no se descargó porque se
 * publicó una versión nueva, recarga la página (una sola vez, `reloadForNewVersion`); si fue la red,
 * no recarga (sin conexión el navegador mostraría su página de error en lugar de la app). Cualquier
 * otra falla es un error de la app: se reporta al ADMIN ("Errores del sistema"), sin otro aviso.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    if (isChunkLoadError(error)) void reloadForNewVersion();
    else void reportClientError({ kind: 'CRASH', error, component: brokenComponent(info.componentStack), detail: info.componentStack ?? undefined });
  }

  private reset = () => {
    retryFailedLazy(); // una pantalla que no se descargó se vuelve a descargar
    this.setState({ error: null });
  };

  override render() {
    if (!this.state.error) return this.props.children;
    return <CrashScreen inline={this.props.inline} onRetry={this.reset} />;
  }
}
