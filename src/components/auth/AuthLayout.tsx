import type { ReactNode } from 'react';
import { useT } from '../../i18n';
import { config } from '../../utils/config';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { BrandLogo } from '../ui/BrandLogo';

/** Trazos de marca muy sutiles detrás de la tarjeta (decorativos). */
function Backdrop() {
  const waves = [0, 18, 36, 54, 72, 90];
  return (
    <svg className="auth__backdrop" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false">
      <defs>
        <linearGradient id="auth-wave" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="currentColor" stopOpacity="0" />
          <stop offset="0.45" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {waves.map((offset) => (
        <path
          key={offset}
          d={`M-80 ${640 + offset} C 260 ${470 + offset}, 560 ${860 + offset}, 930 ${600 + offset} S 1380 ${380 + offset}, 1560 ${520 + offset}`}
          fill="none"
          stroke="url(#auth-wave)"
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
}

/**
 * Marco corporativo del inicio de sesión: barra con la marca y el selector de idioma (cambia en
 * caliente, sin perder lo escrito), fondo azul, tarjeta central y pie.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <div className="auth">
      <header className="auth__header">
        <span className="auth__lockup">
          <BrandLogo size={46} />
          <span className="auth__brand-name">
            <strong>{config.appName}</strong>
            <small>{t('app.tagline')}</small>
          </span>
        </span>
        <LanguageSwitcher variant="compact" tone="dark" />
      </header>

      <main className="auth__panel">
        <Backdrop />
        {children}
      </main>

      <footer className="auth__footer">
        {t('auth.layout.copyright', { year: new Date().getFullYear(), app: config.appName })}
      </footer>
    </div>
  );
}
