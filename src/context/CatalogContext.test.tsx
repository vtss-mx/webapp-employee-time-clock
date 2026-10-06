import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, type ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useAuth } from '../hooks/useAuth';
import { useCatalogs, useCatalogState } from '../hooks/useCatalogs';
import { CatalogGate } from '../routes/CatalogGate';
import { catalogsFixture } from '../test/catalogs';
import { apiFail, apiOk, mockFetch, type MockCall } from '../test/http';
import { tokenResponse } from '../test/render';
import { AuthProvider } from './AuthContext';
import { CatalogContext, CatalogProvider } from './CatalogContext';
import { FeedbackProvider } from './FeedbackContext';

const catalogCalls = (calls: MockCall[]) => calls.filter((c) => c.url.endsWith('/catalogs'));

/** Respuestas de la API: sesión, cierre de sesión y catálogos (con fallas al inicio si se piden). */
function server(catalogFailures = 0) {
  let failures = catalogFailures;
  return mockFetch((call) => {
    if (call.url.endsWith('/catalogs')) {
      if (failures-- > 0) return apiFail(500, 'INTERNAL_ERROR', 'Falla al leer los catálogos');
      return apiOk(catalogsFixture, { code: 'CATALOGS' });
    }
    return call.url.endsWith('/auth/logout') ? apiOk(null) : apiOk(tokenResponse());
  });
}

function Session() {
  const { login, logout, isAuthenticated } = useAuth();
  const state = useCatalogState();
  return (
    <>
      <output data-testid="catalogs">{state.status}</output>
      <button onClick={() => void (isAuthenticated ? logout() : login('ana@empresa.com', 'x'))}>{isAuthenticated ? 'salir' : 'entrar'}</button>
    </>
  );
}

function RoleName() {
  return <p>{useCatalogs().nameOf('roles', 'VALIDATOR')}</p>;
}

function renderApp(ui: ReactNode) {
  return render(
    <StrictMode>
      <MemoryRouter>
        <FeedbackProvider>
          <AuthProvider>
            <CatalogProvider>
              <Session />
              {ui}
            </CatalogProvider>
          </AuthProvider>
        </FeedbackProvider>
      </MemoryRouter>
    </StrictMode>,
  );
}

const gated = (
  <Routes>
    <Route element={<CatalogGate />}>
      <Route path="/" element={<RoleName />} />
    </Route>
  </Routes>
);

describe('CatalogProvider: catálogos en memoria, una carga por sesión', () => {
  it('sin sesión no pide nada; al entrar los carga UNA vez (aun en StrictMode) y al salir los descarta', async () => {
    const { calls } = server();
    renderApp(gated);
    expect(screen.getByTestId('catalogs')).toHaveTextContent('loading');
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
    expect(catalogCalls(calls)).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'entrar' }));
    expect(await screen.findByText('Validador')).toBeInTheDocument(); // nombre del catálogo de roles
    expect(screen.getByTestId('catalogs')).toHaveTextContent('ready');
    expect(catalogCalls(calls)).toHaveLength(1);
    // Solo en memoria: nada de los catálogos queda en el navegador.
    const stored = [window.localStorage, window.sessionStorage].flatMap((store) => Object.keys(store).map((key) => store.getItem(key)));
    expect(stored.join(' ')).not.toMatch(/Validador|México/);

    await userEvent.click(screen.getByRole('button', { name: 'salir' }));
    await waitFor(() => expect(screen.getByTestId('catalogs')).toHaveTextContent('loading'));
    await userEvent.click(screen.getByRole('button', { name: 'entrar' }));
    expect(await screen.findByText('Validador')).toBeInTheDocument();
    expect(catalogCalls(calls)).toHaveLength(2); // nueva sesión, nueva carga
  });

  it('si fallan avisa en el popup con "Reintentar"; queda la pantalla de error de la app con "Reintentar"', async () => {
    const { calls } = server(2);
    renderApp(gated);
    await userEvent.click(screen.getByRole('button', { name: 'entrar' }));

    let popup = await screen.findByRole('alertdialog', { name: 'No se pudieron cargar los catálogos' });
    expect(popup).toHaveTextContent('Falla al leer los catálogos');
    await userEvent.click(within(popup).getByRole('button', { name: 'Reintentar' }));

    popup = await screen.findByRole('alertdialog', { name: 'No se pudieron cargar los catálogos' });
    await userEvent.click(within(popup).getAllByRole('button', { name: 'Cerrar' })[0]);
    expect(screen.getByTestId('catalogs')).toHaveTextContent('error');
    const failed = screen.getByRole('alert');
    expect(failed).toHaveTextContent('No se pudo cargar la información');
    expect(failed).toHaveTextContent('Error al cargar');
    await userEvent.click(within(failed).getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Validador')).toBeInTheDocument();
    expect(catalogCalls(calls)).toHaveLength(3);
  });

  it('sin conexión: al recuperarla los vuelve a cargar solos', async () => {
    let offline = true;
    mockFetch((call) => {
      if (call.url.endsWith('/catalogs')) return offline ? Promise.reject(new TypeError('Failed to fetch')) : apiOk(catalogsFixture);
      return apiOk(tokenResponse());
    });
    renderApp(gated);
    await userEvent.click(screen.getByRole('button', { name: 'entrar' }));
    await screen.findByRole('alertdialog', { name: 'No se pudieron cargar los catálogos' });
    offline = false;
    act(() => void window.dispatchEvent(new Event('online')));
    expect(await screen.findByText('Validador')).toBeInTheDocument();
  });

  it('si la sesión se cierra mientras cargan, la respuesta tardía se descarta', async () => {
    let release: () => void = () => undefined;
    const late = new Promise<void>((resolve) => (release = resolve));
    let delayed = true;
    const { calls } = mockFetch(async (call) => {
      if (call.url.endsWith('/catalogs')) {
        if (delayed) {
          delayed = false;
          await late;
        }
        return apiOk(catalogsFixture);
      }
      return call.url.endsWith('/auth/logout') ? apiOk(null) : apiOk(tokenResponse());
    });
    renderApp(gated);
    await userEvent.click(screen.getByRole('button', { name: 'entrar' }));
    await waitFor(() => expect(catalogCalls(calls)).toHaveLength(1));
    await userEvent.click(screen.getByRole('button', { name: 'salir' }));
    await act(async () => {
      release();
      await late;
    });
    expect(screen.getByTestId('catalogs')).toHaveTextContent('loading');
    expect(screen.queryByText('Validador')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'entrar' }));
    expect(await screen.findByText('Validador')).toBeInTheDocument();
  });

  it('useCatalogs exige el proveedor y los catálogos ya cargados', () => {
    expect(() => renderHook(() => useCatalogs())).toThrow('useCatalogs debe usarse dentro de <CatalogProvider>');
    const loading = ({ children }: { children: ReactNode }) => (
      <CatalogContext.Provider value={{ status: 'loading' }}>{children}</CatalogContext.Provider>
    );
    expect(() => renderHook(() => useCatalogs(), { wrapper: loading })).toThrow(/aún no se cargan/);
  });
});
