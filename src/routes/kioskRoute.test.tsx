import { render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { MemoryRouter, Outlet } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import { FeedbackProvider } from '../context/FeedbackContext';
import { apiOk, mockFetch, testSession } from '../test/http';
import { sampleUser, tokenResponse } from '../test/render';
import { AppRouter } from './AppRouter';
import { paths } from './paths';

// Cada pantalla se dibuja como su nombre: aquí importa que /kiosk no pase por las guardas de la sesión.
vi.mock('./lazyPages', async (importOriginal) => {
  const pages = await importOriginal<Record<string, unknown>>();
  return Object.fromEntries(Object.keys(pages).map((name): [string, ComponentType] => [name, () => <span>{name}</span>]));
});
vi.mock('./CatalogGate', () => ({ CatalogGate: () => <Outlet /> }));
vi.mock('../layouts/AppLayout', () => ({ AppLayout: () => <Outlet /> }));

function renderAt(route: string, signedIn: boolean) {
  testSession.signedIn = signedIn;
  mockFetch((call) => (call.url.endsWith('/auth/refresh') ? apiOk(tokenResponse(sampleUser)) : apiOk(null)));
  return render(
    <MemoryRouter initialEntries={[route]}>
      <FeedbackProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </FeedbackProvider>
    </MemoryRouter>,
  );
}

describe('ruta pública del kiosco del sitio', () => {
  it.each([false, true])('/kiosk se abre sin pedir sesión (y también con una abierta: %s)', async (signedIn) => {
    renderAt(paths.kiosk, signedIn);
    expect(await screen.findByText('KioskPage')).toBeInTheDocument();
    expect(screen.queryByText('LoginPage')).toBeNull();
  });
});
