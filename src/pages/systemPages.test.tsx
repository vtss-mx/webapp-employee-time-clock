import { screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, sampleUser } from '../test/render';
import type { User } from '../types';
import { ForbiddenPage } from './ForbiddenPage';
import { NotFoundPage } from './NotFoundPage';

const session = vi.hoisted(() => ({ user: null as User | null }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => session }));

afterEach(() => {
  session.user = null;
});

describe.each([
  ['ForbiddenPage', ForbiddenPage, '403', 'Acceso denegado', 'No tienes permisos para acceder a esta sección.'],
  ['NotFoundPage', NotFoundPage, '404', 'Página no encontrada', 'La página que buscas no existe o fue movida.'],
] as Array<[string, ComponentType, string, string, string]>)('%s', (_name, Page, code, title, text) => {
  it('con sesión: explica el problema y lleva al inicio que el backend dio a la persona', () => {
    session.user = sampleUser;
    renderWithProviders(<Page />);
    expect(screen.getByText(code)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', sampleUser.home);
  });

  it('sin sesión: "Ir al inicio" lleva al inicio de sesión', () => {
    renderWithProviders(<Page />);
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/login');
  });
});
