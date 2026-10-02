import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { apiFail, apiOk, mockFetch, type MockCall } from '../test/http';
import { renderWithProviders, tokenResponse, sampleUser } from '../test/render';
import { AppLayout } from './AppLayout';
import { useAuth } from '../hooks/useAuth';
import { useEffect } from 'react';

function SignIn() {
  const { login } = useAuth();
  useEffect(() => void login('ana@empresa.com', 'x'), [login]);
  return null;
}

function renderLayout() {
  return renderWithProviders(
    <>
      <SignIn />
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<p>contenido</p>} />
        </Route>
      </Routes>
    </>,
    { auth: true },
  );
}

const preferenceCalls = (calls: MockCall[]) =>
  calls.filter((c) => c.url.endsWith('/users/me/preferences')).map((c) => JSON.parse(c.init.body as string) as unknown);

describe('AppLayout: menú lateral contraíble', () => {
  it('contrae y expande (botón y Ctrl/⌘ + B); la preferencia se guarda en la BD, no en el navegador', async () => {
    const { calls } = mockFetch((call) =>
      call.url.endsWith('/users/me/preferences')
        ? apiOk(JSON.parse(call.init.body as string))
        : apiOk(tokenResponse({ ...sampleUser, preferences: { sidebar_collapsed: false } })),
    );
    renderLayout();
    const toggle = await screen.findByRole('button', { name: 'Contraer menú' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(toggle);
    expect(document.querySelector('.shell')).toHaveClass('is-collapsed');
    // El nombre de cada opción sigue disponible (lector de pantalla y globo informativo).
    const sidebar = screen.getByRole('complementary', { name: 'Navegación principal' });
    expect(within(sidebar).getByRole('link', { name: 'Mi perfil' })).toHaveAttribute('data-tooltip', 'Mi perfil');

    act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true })));
    await waitFor(() => expect(document.querySelector('.shell')).not.toHaveClass('is-collapsed'));
    expect(screen.getByRole('button', { name: 'Contraer menú' })).toBeInTheDocument();
    expect(preferenceCalls(calls)).toEqual([{ sidebar_collapsed: true }, { sidebar_collapsed: false }]);
    expect(window.localStorage.getItem('tc.sidebar.collapsed')).toBeNull();
  });

  it('respeta la preferencia guardada y la revierte si el servidor no la guarda', async () => {
    mockFetch((call) =>
      call.url.endsWith('/users/me/preferences')
        ? apiFail(503, 'SERVICE_UNAVAILABLE')
        : apiOk(tokenResponse({ ...sampleUser, preferences: { sidebar_collapsed: true } })),
    );
    renderLayout();
    const expand = await screen.findByRole('button', { name: 'Expandir menú' });
    expect(document.querySelector('.shell')).toHaveClass('is-collapsed');
    await userEvent.click(expand);
    await waitFor(() => expect(document.querySelector('.shell')).toHaveClass('is-collapsed'));
  });

  it('muestra el rol con su nombre oficial', async () => {
    mockFetch(() => apiOk(tokenResponse({ ...sampleUser, role: 'COMPANY', employee: null })));
    renderLayout();
    expect(await screen.findByText('Company', { selector: '.sidebar__section' })).toBeInTheDocument();
  });

  it('teléfonos: barra inferior con las opciones principales; con muchas, "Más" abre el menú completo', async () => {
    mockFetch(() => apiOk(tokenResponse({ ...sampleUser, role: 'COMPANY', employee: null })));
    renderLayout();
    const tabbar = await screen.findByRole('navigation', { name: 'Navegación inferior' });
    expect(within(tabbar).getAllByRole('link').map((l) => l.textContent)).toEqual(['Inicio', 'Empleados', 'Validar']);
    await userEvent.click(within(tabbar).getByRole('button', { name: 'Más opciones' }));
    expect(screen.getByRole('complementary', { name: 'Navegación principal' })).toHaveClass('is-open');
  });

  it('empleado: todas sus opciones caben en la barra inferior (sin "Más")', async () => {
    mockFetch(() => apiOk(tokenResponse(sampleUser)));
    renderLayout();
    const tabbar = await screen.findByRole('navigation', { name: 'Navegación inferior' });
    expect(within(tabbar).getAllByRole('link').map((l) => l.textContent)).toEqual(['Identificar', 'Mi QR', 'Perfil']);
    expect(within(tabbar).queryByRole('button', { name: 'Más opciones' })).toBeNull();
  });

  it('empresa: administra sus validadores desde el menú', async () => {
    mockFetch(() => apiOk(tokenResponse({ ...sampleUser, role: 'COMPANY', employee: null })));
    renderLayout();
    const sidebar = await screen.findByRole('complementary', { name: 'Navegación principal' });
    expect(within(sidebar).getByRole('link', { name: /Validadores/ })).toHaveAttribute('href', '/company/validators');
  });

  it('validador: solo identificar empleados y su perfil', async () => {
    const company = { id: 1, name: 'Mi empresa', active: true };
    mockFetch(() => apiOk(tokenResponse({ ...sampleUser, role: 'VALIDATOR', employee: null, company })));
    renderLayout();
    const tabbar = await screen.findByRole('navigation', { name: 'Navegación inferior' });
    expect(within(tabbar).getAllByRole('link').map((l) => l.textContent)).toEqual(['Identificar', 'Perfil']);
    expect(within(tabbar).getByRole('link', { name: 'Identificar empleados' })).toHaveAttribute('href', '/validator/checkpoint');
    expect(screen.getByText('Validator', { selector: '.sidebar__section' })).toBeInTheDocument();
  });
});
