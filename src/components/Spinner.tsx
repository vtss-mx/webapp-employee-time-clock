import logo from '../assets/vt-logo.webp';
import { useT } from '../i18n';

export function Spinner({ light = false, size = 28 }: { light?: boolean; size?: number }) {
  const t = useT();
  return (
    <span
      className={`spinner ${light ? 'spinner--light' : ''}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label={t('ui.loading')}
    />
  );
}

/** El ícono de la app con los colores de la marca recorriéndolo: el indicador de carga de la app. */
export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden>
      <img className="brand-mark__logo" src={logo} alt="" decoding="async" />
      <span className="brand-mark__tint" />
    </span>
  );
}

/**
 * Carga de una pantalla o de la app: el ícono animado, "Cargando información" y una barra de avance
 * (decisión del dueño del producto: un solo mensaje, sobrio y profesional, en toda la app).
 * `fullscreen`: al abrir la app (sesión, catálogos), una pantalla blanca completa con el ícono al centro;
 * si no, dentro del área de trabajo.
 */
export function PageLoader({ text, fullscreen = false }: { text?: string; fullscreen?: boolean }) {
  const t = useT();
  return (
    <div className={fullscreen ? 'app-splash' : 'page-loader'} role="status" aria-live="polite">
      <div className="brand-loader">
        <BrandMark />
        <span className="brand-loader__text">{text ?? t('common.states.loading')}</span>
        <span className="brand-loader__bar" aria-hidden />
      </div>
    </div>
  );
}
