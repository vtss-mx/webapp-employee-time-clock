import { Lock, LogOut, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { PageLoader } from '../components/Spinner';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { OfflineBanner } from '../components/OfflineBanner';
import { BrandLogo } from '../components/ui/BrandLogo';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { usePendingEnrollments } from '../hooks/usePendingEnrollments';
import { homeForUser } from '../routes/paths';
import { roleLabel } from '../utils/format';
import { config } from '../utils/config';
import { MobileTabBar } from './MobileTabBar';
import { navFor } from './navigation';

const TITLES: Array<[RegExp, string]> = [
  [/^\/admin\/dashboard/, 'Panel de la plataforma'],
  [/^\/admin\/companies\/new/, 'Registrar empresa'],
  [/^\/admin\/companies/, 'Empresas'],
  [/^\/company\/dashboard/, 'Dashboard'],
  [/^\/company\/employees\/new/, 'Registrar empleado'],
  [/^\/company\/employees/, 'Empleados'],
  [/^\/company\/validations/, 'Validaciones de identidad'],
  [/^\/company\/validators/, 'Validadores de identidad'],
  [/^\/company\/settings/, 'Configuración'],
  [/^\/employee\/enroll/, 'Registro facial'],
  [/^\/employee\/pending/, 'Validación en curso'],
  [/^\/employee\/qr/, 'Mi código QR'],
  [/^\/employee/, 'Identificación'],
  [/^\/validator/, 'Punto de control'],
  [/^\/profile/, 'Mi perfil'],
];

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
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { collapsed, toggleCollapsed } = useSidebarCollapse();
  const pending = usePendingEnrollments(user?.role === 'COMPANY');

  // En móvil, el menú lateral se cierra al navegar.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  if (!user) return null;
  const displayName = user.employee?.full_name ?? user.email;
  const initials = displayName
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  const nav = navFor(user, pending);

  const title = TITLES.find(([re]) => re.test(location.pathname))?.[1] ?? '';
  const secure = window.location.protocol === 'https:';

  return (
    <div className={`shell ${collapsed ? 'is-collapsed' : ''}`}>
      {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} />}
      <aside id="app-sidebar" className={`sidebar ${menuOpen ? 'is-open' : ''}`} aria-label="Navegación principal">
        <Link to={homeForUser(user)} className="sidebar__brand">
          <BrandLogo />
          <span className="brand-name">
            <strong>{config.appName}</strong>
            {/* Empresa del usuario (multiempresa); la plataforma, para su administrador. */}
            <small className="truncate">{user.company?.name ?? (user.role === 'ADMIN' ? 'Consola de la plataforma' : 'Identidad verificada')}</small>
          </span>
        </Link>

        <span className="sidebar__section">{roleLabel[user.role]}</span>
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
          <div className="user-card">
            <span className="avatar">{initials}</span>
            <span className="user-card__info">
              <strong className="truncate">{displayName}</strong>
              <small>{roleLabel[user.role]}</small>
            </span>
            <Button iconOnly variant="ghost" onClick={() => void logout()} aria-label="Cerrar sesión" title="Cerrar sesión">
              <LogOut size={18} />
            </Button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <Button
            iconOnly
            variant="ghost"
            className="topbar__menu"
            aria-label="Abrir menú"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Menu size={20} />
          </Button>
          <Button
            iconOnly
            variant="ghost"
            className="topbar__collapse"
            aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
            aria-controls="app-sidebar"
            aria-expanded={!collapsed}
            title={`${collapsed ? 'Expandir' : 'Contraer'} menú (Ctrl/⌘ + B)`}
            onClick={toggleCollapsed}
          >
            {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </Button>
          <span className="topbar__brand">
            <BrandLogo size={30} />
          </span>
          <span className="topbar__title">{title}</span>
          <div className="topbar__right">
            {secure && (
              <span className="secure-chip" title="La conexión con el servidor está cifrada (HTTPS)">
                <Lock size={14} /> Conexión segura
              </span>
            )}
          </div>
        </header>
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
      <MobileTabBar nav={nav} onMore={() => setMenuOpen(true)} />
      <OfflineBanner />
    </div>
  );
}
