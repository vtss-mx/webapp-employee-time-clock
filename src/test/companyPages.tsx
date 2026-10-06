import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext, type AuthContextValue } from '../context/AuthContext';
import { FeedbackProvider } from '../context/FeedbackContext';
import type { CompanyDetail, User } from '../types';
import type { CatalogApi } from '../utils/catalogs';
import { WithCatalogs } from './render';
import { sampleUser } from './render';
import { withScreens } from './screens';

/** Empresa de las pruebas de cobranza (la misma de las pruebas de empresas). */
export const company: CompanyDetail = {
  id: 4,
  name: 'Panificadora',
  legal_name: 'Panificadora del Norte SA de CV',
  tax_country: 'MX',
  tax_id_type: 'MX_RFC',
  tax_id: 'PNO120315AB1',
  phone: '+526621234567',
  active: true,
  max_employees: 50,
  api_enabled: false,
  max_validators: 0,
  active_validators: 0,
  employee_count: 3,
  admin_count: 1,
  billing_status: 'ACTIVE',
  suspension_reason: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

/** ADMIN de la plataforma con sus pantallas (como lo envía el backend). */
export const adminUser: User = withScreens({ ...sampleUser, role: 'ADMIN', employee: null });

/** Sesión ya iniciada con ese usuario (solo lo que leen las pantallas: sus pantallas). */
export function sessionOf(user: User | null): AuthContextValue {
  return {
    user,
    status: user ? 'authenticated' : 'anonymous',
    isAuthenticated: Boolean(user),
    logoutReason: null,
    deviceBlock: null,
    dismissDeviceBlock: vi.fn(),
    suspension: null,
    dismissSuspension: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    logoutEverywhere: vi.fn(),
    refreshUser: vi.fn(),
    selectCompany: vi.fn(),
    updatePreferences: vi.fn(),
    updateAvatar: vi.fn(),
  };
}

interface RenderOptions {
  /** Rutas a las que puede llevar la pantalla (se dibujan con su texto). */
  targets?: Record<string, string>;
  /** Sesión iniciada (para lo que depende de las pantallas del usuario). */
  user?: User | null;
  /** Otros catálogos (p. ej. uno sin registros activos). */
  catalogs?: CatalogApi;
}

/** Una pantalla con historial (la anterior es `/previa`), mensajes, catálogos y, si se pide, sesión. */
export function renderPage(path: string, route: string, page: ReactElement, { targets = {}, user, catalogs }: RenderOptions = {}) {
  const tree = (
    <MemoryRouter initialEntries={['/previa', route]} initialIndex={1}>
      <FeedbackProvider>
        <WithCatalogs catalogs={catalogs}>
          <Routes>
            <Route path={path} element={page} />
            <Route path="/previa" element={<p>Pantalla anterior</p>} />
            {Object.entries(targets).map(([target, text]) => (
              <Route key={target} path={target} element={<p>{text}</p>} />
            ))}
          </Routes>
        </WithCatalogs>
      </FeedbackProvider>
    </MemoryRouter>
  );
  return render(user === undefined ? tree : <AuthContext.Provider value={sessionOf(user)}>{tree}</AuthContext.Provider>);
}

/** Elige una opción de una lista propia (`Select`) por el nombre de su control. */
export async function pick(control: RegExp, option: RegExp) {
  await userEvent.click(screen.getByRole('button', { name: control }));
  await userEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: option }));
}

/** Reemplaza lo escrito en un campo. */
export async function retype(label: string | RegExp, text: string) {
  const field = screen.getByLabelText(label);
  await userEvent.clear(field);
  if (text) await userEvent.type(field, text);
}

/** Filas de una región de una confirmación ("Se registrará", "Cambios"). */
export const rowsOf = (dialog: HTMLElement, region: string) => within(within(dialog).getByRole('region', { name: region })).getAllByRole('listitem').map((li) => li.textContent);

/** Resuelve algo pendiente (una respuesta, un temporizador) y deja que React aplique lo que resulte. */
export const settle = (run: () => unknown) =>
  act(() => {
    run();
    return Promise.resolve();
  });
