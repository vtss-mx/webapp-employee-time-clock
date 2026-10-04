import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { useAuth } from '../hooks/useAuth';
import { apiOk, mockFetch } from '../test/http';
import { renderWithProviders, sampleUser, tokenResponse } from '../test/render';
import { AppLayout } from './AppLayout';

/**
 * El menú de teléfonos se personaliza en `mobileMenu.ts`. Aquí, la configuración opuesta a la de
 * fábrica: entra por la derecha, sin título ni ícono en la barra, sin contador en el botón y sin
 * cerrarse al elegir una opción.
 */
vi.mock('./mobileMenu', () => ({
  MOBILE_MENU: { side: 'right', showTitle: false, showBrand: false, badgeOnToggle: false, closeOnNavigate: false },
}));

function SignedIn() {
  const { login } = useAuth();
  useEffect(() => void login('ana@empresa.com', 'Clave123'), [login]);
  return null;
}

describe('menú de teléfonos personalizado', () => {
  it('sigue abierto al navegar y con otras teclas; la barra no muestra título, ícono ni contador', async () => {
    mockFetch((call) =>
      call.url.includes('/enrollments') ? apiOk({ items: [], total: 3, page: 1, size: 1 }) : apiOk(tokenResponse({ ...sampleUser, role: 'COMPANY', employee: null })),
    );
    renderWithProviders(
      <>
        <SignedIn />
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="*" element={<p>contenido</p>} />
          </Route>
        </Routes>
      </>,
      { auth: true, route: '/company/dashboard' },
    );
    const toggle = await screen.findByRole('button', { name: 'Abrir menú' });
    const sidebar = screen.getByRole('complementary', { name: 'Navegación principal' });
    const bar = screen.getByRole('banner');
    expect(sidebar).toHaveClass('sidebar--right');
    expect(within(bar).queryByRole('link', { name: 'Inicio' })).toBeNull();
    expect(bar.querySelector('.mobilebar__title')).toBeNull();

    await userEvent.click(toggle);
    await userEvent.keyboard('{Enter}'); // solo Escape cierra el menú
    expect(sidebar).toHaveClass('is-open');
    await userEvent.click(within(sidebar).getByRole('link', { name: 'Mi perfil' }));
    expect(sidebar).toHaveClass('is-open');
    // El contador sí está en el menú, pero no se repite en el botón.
    expect(await within(sidebar).findByText('3')).toBeInTheDocument();
    expect(toggle.querySelector('.mobilebar__badge')).toBeNull();
  });
});
