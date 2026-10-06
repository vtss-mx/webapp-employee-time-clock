import { Menu } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BrandLogo } from '../components/ui/BrandLogo';
import { Button } from '../components/ui/Button';
import { useT } from '../i18n';
import type { MobileMenuConfig } from './mobileMenu';
import type { NavEntry } from './navigation';
import { lockScroll } from '../utils/scrollLock';

interface MobileBarProps {
  nav: NavEntry[];
  home: string;
  open: boolean;
  onToggle: () => void;
  config: MobileMenuConfig;
}

/**
 * Comportamiento del menú abierto en teléfonos: bloquea el desplazamiento de la página, lleva el
 * foco a la primera opción y se cierra con Escape (devolviendo el foco al botón).
 */
export function useDrawer(open: boolean, close: () => void): void {
  useEffect(() => {
    if (!open) return;
    const unlock = lockScroll();
    document.querySelector<HTMLElement>('#app-sidebar .nav-item')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      close();
      document.querySelector<HTMLElement>('.mobilebar__toggle')?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      unlock();
      window.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
}

/** Opción del menú en la que está el usuario: la de ruta más larga que coincide con la actual. */
export function currentEntry(nav: NavEntry[], pathname: string): NavEntry | undefined {
  return nav
    .filter((entry) => pathname === entry.to || pathname.startsWith(`${entry.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0];
}

/**
 * Barra de teléfonos y tabletas: botón hamburguesa que abre el menú lateral (mismas opciones que
 * en escritorio, enviadas por el backend), ícono de la aplicación y nombre de la pantalla actual.
 * En escritorio no se muestra: ahí el menú lateral está siempre visible.
 */
export function MobileBar({ nav, home, open, onToggle, config }: MobileBarProps) {
  const t = useT();
  const { pathname } = useLocation();
  const pending = nav.reduce((sum, entry) => sum + (entry.badge ?? 0), 0);
  const entry = config.showTitle ? currentEntry(nav, pathname) : undefined;
  const title = entry?.short ?? entry?.label;
  return (
    <header className={`mobilebar mobilebar--${config.side}`}>
      <Button
        iconOnly
        variant="ghost"
        className="mobilebar__toggle"
        aria-label={t('layout.menu.open')}
        aria-controls="app-sidebar"
        aria-expanded={open}
        onClick={onToggle}
      >
        <Menu size={22} />
        {config.badgeOnToggle && pending > 0 && !open ? <span className="mobilebar__badge">{pending}</span> : null}
      </Button>
      {config.showBrand && (
        <Link to={home} className="mobilebar__brand" aria-label={t('layout.home')}>
          <BrandLogo size={28} />
        </Link>
      )}
      {title && <span className="mobilebar__title truncate">{title}</span>}
    </header>
  );
}
