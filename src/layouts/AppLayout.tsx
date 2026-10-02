import { LogOut, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { PageLoader } from '../components/Spinner';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { OfflineBanner } from '../components/OfflineBanner';
import { BrandLogo } from '../components/ui/BrandLogo';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { useCatalogs } from '../hooks/useCatalogs';
import { usePendingEnrollments } from '../hooks/usePendingEnrollments';
import { homeForUser } from '../routes/paths';
import { config } from '../utils/config';
import { MobileBar, useDrawer } from './MobileBar';
import { MOBILE_MENU } from './mobileMenu';
import { navFor, usesBadge } from './navigation';

/** Menú contraído (escritorio): preferencia del usuario en la BD y atajo Ctrl/⌘ + B. */
function useSidebarCollapse() {
  const { user, updatePreferences } = useAuth();
  const collapsed = Boolean(user?.preferences?.sidebar_collapsed);
  const toggleCollapsed = useCallback(() => {
    // Si el servidor no responde, el contexto revierte el cambio (sin interrumpir al usuario).
    updatePreferences({ sidebar_collapsed: !collapsed }).catch(() => undefined);
  }, [collapsed, updatePreferences]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleCollapsed]);
  return { collapsed, toggleCollapsed };
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const { nameOf } = useCatalogs();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useDrawer(menuOpen, closeMenu);
  const { collapsed, toggleCollapsed } = useSidebarCollapse();
  const pending = usePendingEnrollments(usesBadge(user, 'PENDING_ENROLLMENTS'));

  // En móvil, el menú lateral se cierra al navegar (configurable).
  useEffect(() => {
    if (MOBILE_MENU.closeOnNavigate) setMenuOpen(false);
  }, [location.pathname]);

  if (!user) return null;
  const displayName = user.employee?.full_name ?? user.email;
  const initials = displayName
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  const nav = navFor(user, { PENDING_ENROLLMENTS: pending });
  const role = nameOf('roles', user.role);

  return (
    <div className={`shell ${collapsed ? 'is-collapsed' : ''}`}>
      <MobileBar nav={nav} home={homeForUser(user)} open={menuOpen} onToggle={() => setMenuOpen((v) => !v)} config={MOBILE_MENU} />
      {menuOpen && <div className="sidebar-overlay" onClick={closeMenu} />}
      <aside
        id="app-sidebar"
        className={`sidebar sidebar--${MOBILE_MENU.side} ${menuOpen ? 'is-open' : ''}`}
        aria-label="Navegación principal"
      >
        <Link to={homeForUser(user)} className="sidebar__brand">
          <BrandLogo />
          <span className="brand-name">
            <strong>{config.appName}</strong>
            {/* Empresa del usuario (multiempresa); la plataforma, para su administrador. */}
            <small className="truncate">{user.company?.name ?? (user.role === 'ADMIN' ? 'Consola de la plataforma' : 'Identidad verificada')}</small>
          </span>
        </Link>
        {/* Teléfonos: el menú se cierra desde dentro (la barra queda detrás del fondo oscuro). */}
        <Button iconOnly variant="ghost" className="sidebar__close" aria-label="Cerrar menú" onClick={closeMenu}>
          <X size={20} />
        </Button>

        <span className="sidebar__section">{role}</span>
        <nav style={{ display: 'grid', gap: 4 }}>
          {nav.map(({ to, label, icon: Icon, badge }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`} data-tooltip={label}>
              <Icon size={20} />
              <span className="nav-item__label">{label}</span>
              {badge ? <span className="nav-item__badge">{badge}</span> : null}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <button
            type="button"
            className="nav-item sidebar__collapse"
            aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
            aria-controls="app-sidebar"
            aria-expanded={!collapsed}
            data-tooltip={collapsed ? 'Expandir menú' : 'Contraer menú'}
            onClick={toggleCollapsed}
          >
            {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            <span className="nav-item__label">Contraer menú</span>
          </button>
          <div className="user-card">
            <span className="avatar">{initials}</span>
            <span className="user-card__info">
              <strong className="truncate">{displayName}</strong>
              <small>{role}</small>
            </span>
            <Button iconOnly variant="ghost" onClick={() => void logout()} aria-label="Cerrar sesión" title="Cerrar sesión">
              <LogOut size={18} />
            </Button>
          </div>
        </div>
      </aside>

      <div className="main">
        <main className="content">
          {/* La key reinicia la animación de entrada en cada cambio de ruta. */}
          <div key={location.pathname} className="page-transition">
            {/* Un error en una pantalla no tumba el menú ni la sesión; se reinicia al navegar. */}
            <ErrorBoundary inline>
              {/* Mientras llega el código de la pantalla (carga diferida), el menú sigue visible. */}
              <Suspense fallback={<PageLoader text="Cargando..." />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <OfflineBanner />
    </div>
  );
}
