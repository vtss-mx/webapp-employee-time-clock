import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { PageLoader } from '../components/Spinner';
import { homeForUser, paths } from './paths';

/**
 * Exige sesión. Qué pantallas puede abrir el usuario lo deciden las rutas que arma AppRouter con
 * sus pantallas (las envía el backend), y el backend valida de nuevo cada endpoint.
 */
export function ProtectedRoute() {
  const { user, isAuthenticated, status } = useAuth();
  const location = useLocation();

  if (status === 'restoring') return <PageLoader text="Restaurando tu sesión segura..." />;

  if (!isAuthenticated || !user) {
    return <Navigate to={paths.login} replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

/** Ruta raíz y /login para usuarios ya autenticados: llevar a su inicio. */
export function RoleHomeRedirect() {
  const { user, status } = useAuth();
  if (status === 'restoring') return <PageLoader text="Restaurando tu sesión segura..." />;
  return <Navigate to={user ? homeForUser(user) : paths.login} replace />;
}

/** Pantallas solo para invitados (login): con sesión iniciada se va a su inicio. */
export function GuestOnlyRoute() {
  const { user, status } = useAuth();
  if (status === 'restoring') return <PageLoader text="Restaurando tu sesión segura..." />;
  return user ? <Navigate to={homeForUser(user)} replace /> : <Outlet />;
}
