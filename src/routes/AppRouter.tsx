import { Suspense } from 'react';
import { matchPath, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { PageLoader } from '../components/Spinner';
import { useAuth } from '../hooks/useAuth';
import { AppLayout } from '../layouts/AppLayout';
import type { Screen } from '../types';
import { CatalogGate } from './CatalogGate';
import { ForbiddenPage, KioskPage, LoginPage, NotFoundPage } from './lazyPages';
import { homeForUser, paths } from './paths';
import { GuestOnlyRoute, ProtectedRoute, RoleHomeRedirect } from './ProtectedRoute';
import { KNOWN_ROUTES, SCREEN_VIEWS } from './screens';

/** Rutas de las pantallas del usuario (con el menú, o a pantalla completa si `bare`). */
function screenRoutes(screens: Screen[], bare: boolean) {
  return screens
    .map((screen) => SCREEN_VIEWS[screen.code])
    .filter((view) => view !== undefined && Boolean(view.bare) === bare)
    .flatMap((view) => view.routes.map(({ path, Page }) => <Route key={path} path={path} element={<Page />} />));
}

/**
 * Ruta sin pantalla del usuario: si es una pantalla que existe pero el backend no le da (otro rol,
 * o ya no aplica a su estado, p. ej. el registro facial ya aprobado), vuelve a su inicio; si no
 * existe, "no encontrada".
 */
function NotGranted() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const known = KNOWN_ROUTES.some((pattern) => matchPath(pattern, pathname));
  if (known && user) return <Navigate to={homeForUser(user)} replace />;
  return <NotFoundPage />;
}

/**
 * Rutas de la aplicación. Guardas (de afuera hacia adentro):
 * - Sin guarda: /kiosk, la tableta de un sitio (se identifica con la llave de su dispositivo, no con una sesión).
 * - GuestOnlyRoute: /login solo sin sesión (con sesión, a su inicio).
 * - ProtectedRoute: requiere sesión.
 * - CatalogGate: con sesión, espera los catálogos de la BD (GET /api/catalogs, una vez por sesión).
 * Las rutas protegidas se arman con las pantallas que el backend envía para el usuario
 * (`user.screens`): no hay roles ni menús fijos en el frontend. El backend valida de nuevo el
 * permiso de cada endpoint con las mismas pantallas. Las pantallas se cargan bajo demanda.
 */
export function AppRouter() {
  const { user } = useAuth();
  const screens = user?.screens ?? [];
  return (
    <Suspense fallback={<PageLoader fullscreen />}>
      <Routes>
        <Route path="/" element={<RoleHomeRedirect />} />
        {/* Tableta de un sitio: pública (sin sesión ni catálogos), con o sin una sesión abierta en el navegador. */}
        <Route path={paths.kiosk} element={<KioskPage />} />
        <Route element={<GuestOnlyRoute />}>
          <Route path={paths.login} element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          {/* Con sesión, todo espera los catálogos de la BD (una carga por sesión). */}
          <Route element={<CatalogGate />}>
            {/* Pantallas completas, sin menú (p. ej. elegir empresa al entrar). */}
            {screenRoutes(screens, true)}
            <Route element={<AppLayout />}>
              <Route path={paths.forbidden} element={<ForbiddenPage />} />
              {screenRoutes(screens, false)}
              <Route path="*" element={<NotGranted />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
