import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { PageLoader } from '../components/Spinner';
import { ForbiddenPage } from './lazyPages';
import type { Role } from '../types';
import { homeForUser, paths } from './paths';

/**
 * Protege rutas por sesión y rol. Es solo una capa de UX: el backend valida
 * siempre el rol en cada endpoint.
 */
export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, isAuthenticated, status } = useAuth();
  const location = useLocation();

  if (status === 'restoring') return <PageLoader text="Restaurando tu sesión segura..." />;

  if (!isAuthenticated || !user) {
    return <Navigate to={paths.login} replace state={{ from: location.pathname }} />;
  }
  if (roles && !roles.includes(user.role)) {
    return <ForbiddenPage />;
  }
  return <Outlet />;
}

/** Ruta raíz y /login para usuarios ya autenticados: llevar al inicio de su rol. */
export function RoleHomeRedirect() {
  const { user, status } = useAuth();
  if (status === 'restoring') return <PageLoader text="Restaurando tu sesión segura..." />;
  return <Navigate to={user ? homeForUser(user) : paths.login} replace />;
}

/** Pantallas solo para invitados (login): con sesión iniciada se va al inicio de su rol. */
export function GuestOnlyRoute() {
  const { user, status } = useAuth();
  if (status === 'restoring') return <PageLoader text="Restaurando tu sesión segura..." />;
  return user ? <Navigate to={homeForUser(user)} replace /> : <Outlet />;
}
