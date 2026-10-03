import { AlertOctagon, Home, RotateCcw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './ui/Button';
import { tabStore } from '../utils/storage';

interface Props {
  children: ReactNode;
  /** Variante compacta para secciones (no pantalla completa). */
  inline?: boolean;
}

interface State {
  error: Error | null;
}

const CHUNK_RELOAD_KEY = 'tc.chunk-reload';

function isChunkLoadError(error: Error): boolean {
  return /Loading chunk|dynamically imported module|Importing a module script failed/i.test(error.message);
}

/**
 * Captura errores de render en tiempo de ejecución para que un fallo en una pantalla no deje
 * la aplicación en blanco. Ofrece reintentar sin perder la sesión. Si el error se debe a que
 * se publicó una nueva versión (chunk no encontrado), recarga la página una sola vez.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    if (isChunkLoadError(error)) {
      // Con el storage bloqueado no se recarga (evita ciclos) y se muestra el fallback.
      if (!tabStore.get(CHUNK_RELOAD_KEY)) {
        tabStore.set(CHUNK_RELOAD_KEY, '1');
        if (tabStore.get(CHUNK_RELOAD_KEY)) window.location.reload();
      }
    }
  }

  private reset = () => this.setState({ error: null });

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
