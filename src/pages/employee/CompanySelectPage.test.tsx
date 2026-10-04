import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useAuth } from '../../hooks/useAuth';
import { homeForUser, needsCompanySelection, paths } from '../../routes/paths';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../test/http';
import { renderWithProviders, sampleUser, tokenResponse } from '../../test/render';
import { withScreens } from '../../test/screens';
import type { FaceStatus, User, UserMembership } from '../../types';
import { CompanySelectPage } from './CompanySelectPage';

const membership = (id: number, name: string, extra: Partial<UserMembership> = {}): UserMembership => ({
  id: id * 10,
  company: { id, name, active: true },
  active: true,
  face_status: 'APPROVED',
  ...extra,
});
const memberships = [
  membership(1, 'Panificadora del Norte'),
  membership(2, 'Logística Sonora', { face_status: 'NOT_ENROLLED' }),
  membership(3, 'Cerrada SA', { company: { id: 3, name: 'Cerrada SA', active: false } }),
];
const multiUser: User = withScreens({ ...sampleUser, employee: null, company: null, memberships });

function SignIn() {
  const { login } = useAuth();
  useEffect(() => void login('ana@empresa.com', 'x'), [login]);
  return null;
}

function renderSelect(selectResponse: (call: MockCall) => Response, user: User = multiUser) {
  const { calls } = mockFetch((call) => (call.url.endsWith('/auth/company') ? selectResponse(call) : apiOk(tokenResponse(user))));
  renderWithProviders(
    <>
      <SignIn />
      <Routes>
        <Route path="/" element={<CompanySelectPage />} />
        <Route path={paths.employee.attendance} element={<p>Menú del empleado</p>} />
      </Routes>
    </>,
    { auth: true },
  );
  return calls;
}

describe('Selección de empresa (persona en varias empresas)', () => {
  it('reglas de inicio: sin empresa elegida va al selector', () => {
    expect(needsCompanySelection(multiUser)).toBe(true);
    expect(homeForUser(multiUser)).toBe(paths.selectCompany);
    expect(needsCompanySelection(sampleUser)).toBe(false);
    expect(homeForUser(withScreens({ ...sampleUser, role: 'COMPANY', employee: null }))).toBe(paths.company.dashboard);
  });

  it('lista sus empresas, bloquea las no disponibles y entra a la elegida', async () => {
    const calls = renderSelect(() =>
      apiOk(withScreens({ ...multiUser, company: memberships[1].company, employee: sampleUser.employee && { ...sampleUser.employee, id: 20 } })),
    );
    expect(await screen.findByRole('heading', { name: 'Elige tu empresa' })).toBeInTheDocument();
    expect(screen.getByText(/Trabajas en 3 empresas/)).toHaveTextContent('ana@empresa.com');
    const closed = screen.getByRole('button', { name: /Cerrada SA/ });
    expect(closed).toBeDisabled();
    expect(closed).toHaveTextContent('Empresa desactivada');
    expect(screen.getByRole('button', { name: /Logística Sonora/ })).toHaveTextContent('Registrarás tu rostro al entrar');

    await userEvent.click(screen.getByRole('button', { name: /Logística Sonora/ }));
    expect(await screen.findByText('Menú del empleado')).toBeInTheDocument();
    const select = calls.find((c) => c.url.endsWith('/auth/company'));
    expect(JSON.parse(select?.init.body as string)).toEqual({ company_id: 2 });
  });

  it('si no puede entrar (p. ej. la empresa exige teléfono), lo explica en un popup y se queda en el selector', async () => {
    renderSelect(() => apiFail(409, 'COMPANY_INACTIVE', 'La empresa está desactivada'));
    await userEvent.click(await screen.findByRole('button', { name: /Panificadora del Norte/ }));
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo entrar a Panificadora del Norte' });
    expect(popup).toHaveTextContent('La empresa está desactivada');
    await userEvent.click(within(popup).getByRole('button', { name: 'Entendido' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Panificadora del Norte/ })).toBeEnabled());
  });

  it('acceso desactivado en una empresa y un estado facial que el catálogo aún no tiene (se muestra su código)', async () => {
    const user = withScreens({
      ...multiUser,
      memberships: [
        membership(1, 'Panificadora del Norte', { active: false }),
        membership(2, 'Logística Sonora', { face_status: 'ON_HOLD' as FaceStatus }),
      ],
    });
    renderSelect(() => apiFail(500, 'NO_DEBE_LLAMARSE'), user);
    const blocked = await screen.findByRole('button', { name: /Panificadora del Norte/ });
    expect(blocked).toBeDisabled();
    expect(blocked).toHaveTextContent('Tu acceso está desactivado');
    expect(screen.getByRole('button', { name: /Logística Sonora/ })).toHaveTextContent('ON_HOLD');
  });

  it('sin empresas en la sesión no se rompe; "Cerrar sesión" pide confirmación', async () => {
    renderSelect(() => apiFail(500, 'NO_DEBE_LLAMARSE'), withScreens({ ...sampleUser, employee: null, company: null }));
    expect(await screen.findByText(/Trabajas en 0 empresas/)).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    const ask = await screen.findByRole('alertdialog', { name: '¿Estás seguro de que deseas cerrar sesión?' });
    await userEvent.click(within(ask).getByRole('button', { name: 'Seguir aquí' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.getByRole('heading', { name: 'Elige tu empresa' })).toBeInTheDocument();
  });
});
