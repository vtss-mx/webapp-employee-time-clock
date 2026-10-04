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
import { PendingEnrollmentsContext, usePendingEnrollments } from '../hooks/usePendingEnrollments';
import { usePendingErrors } from '../hooks/usePendingErrors';
import { homeForUser } from '../routes/paths';
import type { User } from '../types';
import { config } from '../utils/config';
import { MobileBar, useDrawer } from './MobileBar';
import { MOBILE_MENU } from './mobileMenu';
import { useFeedback } from '../hooks/useFeedback';
import { navFor, usesBadge } from './navigation';
import { useConfirmLogout } from '../components/auth/logoutConfirm';

/** Menú contraído (escritorio): preferencia del usuario en la BD y atajo Ctrl/⌘ + B. */
function useSidebarCollapse() {
  const { user, updatePreferences } = useAuth();
  const feedback = useFeedback();
  const collapsed = Boolean(user?.preferences?.sidebar_collapsed);
  const toggleCollapsed = useCallback(() => {
    // Si el servidor no responde, el contexto revierte el cambio y se avisa (una vez aunque se insista).
    updatePreferences({ sidebar_collapsed: !collapsed }).catch((error: unknown) => {
      void feedback.fromError(error, { title: 'No se pudo guardar la preferencia del menú', key: 'sidebar-preference' });
    });
  }, [collapsed, updatePreferences, feedback]);
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

/**
 * Dónde opera el usuario, bajo el nombre de la app: su empresa; sin empresa ni empleos, la consola
 * de la plataforma. Sale de los datos que envía el backend, no del rol.
 */
function workspaceName(user: User): string {
  if (user.company) return user.company.name;
  return user.employee || user.memberships?.length ? 'Identidad verificada' : 'Consola de la plataforma';
}

export function AppLayout() {
  const { user } = useAuth();
  const confirmLogout = useConfirmLogout();
  const { nameOf } = useCatalogs();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useDrawer(menuOpen, closeMenu);
  const { collapsed, toggleCollapsed } = useSidebarCollapse();
  // Única consulta periódica de la cola de validaciones: alimenta el contador del menú y, por el
  // contexto, a las pantallas que la muestran (dashboard). Solo si el menú del usuario lo lleva.
  const pending = usePendingEnrollments(usesBadge(user, 'PENDING_ENROLLMENTS'));
  const pendingErrors = usePendingErrors(usesBadge(user, 'PENDING_ERRORS'));

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

  const nav = navFor(user, { PENDING_ENROLLMENTS: pending, PENDING_ERRORS: pendingErrors });
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
            <small className="truncate">{workspaceName(user)}</small>
          </span>
        </Link>
        {/* Teléfonos: el menú se cierra desde dentro (la barra queda detrás del fondo oscuro). */}
        <Button iconOnly variant="ghost" className="sidebar__close" aria-label="Cerrar menú" onClick={closeMenu}>
          <X size={20} />
        </Button>

        {/* Rol y botón para contraer el menú (escritorio), al inicio de las opciones. */}
        <div className="sidebar__toolbar">
          <span className="sidebar__section">{role}</span>
          <button
            type="button"
            className="sidebar__collapse"
            aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
            aria-controls="app-sidebar"
            aria-expanded={!collapsed}
            title={`${collapsed ? 'Expandir' : 'Contraer'} menú (Ctrl/⌘ + B)`}
            onClick={toggleCollapsed}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        <nav className="sidebar__nav" style={{ display: 'grid', gap: 4, alignContent: 'start' }}>
          {nav.map(({ to, label, icon: Icon, badge }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`} data-tooltip={label}>
              <Icon size={20} />
              <span className="nav-item__label">{label}</span>
              {badge ? <span className="nav-item__badge">{badge}</span> : null}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="user-card">
            <span className="avatar">{initials}</span>
            <span className="user-card__info">
              <strong className="truncate">{displayName}</strong>
              <small>{role}</small>
            </span>
            <Button iconOnly variant="ghost" onClick={() => void confirmLogout()} aria-label="Cerrar sesión" title="Cerrar sesión">
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
                <PendingEnrollmentsContext.Provider value={pending}>
                  <Outlet />
                </PendingEnrollmentsContext.Provider>
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <OfflineBanner />
    </div>
  );
}
