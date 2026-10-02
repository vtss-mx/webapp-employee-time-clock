import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import type { User } from '../types';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { CatalogContext } from '../context/CatalogContext';
import { FeedbackProvider } from '../context/FeedbackContext';
import type { CatalogApi } from '../utils/catalogs';
import { testCatalogs } from './catalogs';
import { withScreens } from './screens';

/** Catálogos ya cargados (los de prueba u otros), como los deja CatalogProvider tras la carga. */
export function WithCatalogs({ children, catalogs = testCatalogs }: { children: ReactNode; catalogs?: CatalogApi }) {
  return <CatalogContext.Provider value={{ status: 'ready', catalogs }}>{children}</CatalogContext.Provider>;
}

/** Renderiza con router en memoria, mensajes (popup), catálogos de prueba y (opcional) sesión. */
export function renderWithProviders(ui: ReactElement, { route = '/', auth = false, catalogs = testCatalogs } = {}): RenderResult {
  const content = auth ? <AuthProvider>{ui}</AuthProvider> : ui;
  return render(
    <MemoryRouter initialEntries={[route]}>
      <FeedbackProvider>
        <WithCatalogs catalogs={catalogs}>{content}</WithCatalogs>
      </FeedbackProvider>
    </MemoryRouter>,
  );
}

export const sampleUser: User = withScreens({
  id: 1,
  email: 'ana@empresa.com',
  role: 'EMPLOYEE',
  active: true,
  last_login_at: null,
  created_at: '2026-01-01T00:00:00Z',
  employee: {
    id: 7,
    employee_number: 'EMP-7',
    first_name: 'Ana',
    last_name: 'Ruiz',
    full_name: 'Ana Ruiz',
    active: true,
    headwear_exempt: false,
    face_status: 'APPROVED',
    face_rejection_reason: null,
  },
});

/** Respuesta de login/renovación; las pantallas del usuario se calculan como en el backend. */
export function tokenResponse(user: Omit<User, 'screens' | 'home'> = sampleUser, expiresIn = 43_200) {
  return {
    access_token: `token-${Math.random()}`,
    token_type: 'Bearer',
    expires_in: expiresIn,
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    session_id: 'sid-1',
    user: withScreens(user),
  };
}
