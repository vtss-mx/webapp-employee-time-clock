import { AlertOctagon, Home, RotateCcw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reloadForNewVersion } from '../services/versionReload';
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

function isChunkLoadError(error: Error): boolean {
  return /Loading chunk|dynamically imported module|Importing a module script failed/i.test(error.message);
}

/**
 * Captura errores de render en tiempo de ejecución para que un fallo en una pantalla no deje
 * la aplicación en blanco. Ofrece reintentar sin perder la sesión: con una pantalla que no se pudo
 * descargar, "Reintentar" la descarga de nuevo (`retryFailedLazy`). Si no se descargó porque se
 * publicó una versión nueva, recarga la página (una sola vez, `reloadForNewVersion`); si fue la red,
 * no recarga (sin conexión el navegador mostraría su página de error en lugar de la app).
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    if (isChunkLoadError(error)) void reloadForNewVersion();
  }

  private reset = () => {
    retryFailedLazy(); // una pantalla que no se descargó se vuelve a descargar
    this.setState({ error: null });
  };

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={this.props.inline ? 'error-inline' : 'center-page'} role="alert">
        <span className="icon-tile icon-tile--lg icon-tile--danger">
          <AlertOctagon size={32} />
        </span>
        <h1 style={{ fontSize: this.props.inline ? '1.2rem' : undefined }}>Algo no salió como esperábamos</h1>
        <p className="muted">
          Ocurrió un error inesperado en esta pantalla. Tus datos están a salvo; puedes reintentar.
        </p>
        <div className="button-row" style={{ justifyContent: 'center' }}>
          <Button variant="primary" icon={<RotateCcw size={18} />} onClick={this.reset}>
            Reintentar
          </Button>
          <Button variant="ghost" icon={<Home size={18} />} onClick={() => window.location.assign('/')}>
            Ir al inicio
          </Button>
        </div>
      </div>
    );
  }
}
