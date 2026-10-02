import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SessionsPanel } from '../components/SessionsPanel';
import { AuthProvider } from '../context/AuthContext';
import { FeedbackProvider } from '../context/FeedbackContext';
import { apiFail, apiOk, mockFetch } from '../test/http';
import { sampleUser, tokenResponse } from '../test/render';
import type { FaceStatus, User } from '../types';
import { preferenceStore } from '../utils/storage';
import { EmployeeFaceGate } from './EmployeeFaceGate';
import { homeFor, paths } from './paths';
import { ProtectedRoute, RoleHomeRedirect } from './ProtectedRoute';

function renderApp(route: string, user: User = sampleUser, extra: Record<string, () => Response> = {}) {
  preferenceStore.set('tc.signed-in', '1');
  mockFetch((call) => {
    const key = Object.keys(extra).find((p) => call.url.includes(p));
    if (key) return extra[key]();
    return call.url.endsWith('/auth/refresh') ? apiOk(tokenResponse(user)) : apiFail(404, 'NOT_FOUND');
  });
  return render(
    <MemoryRouter initialEntries={[route]}>
      <FeedbackProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<RoleHomeRedirect />} />
            <Route path={paths.login} element={<span>login</span>} />
            <Route element={<ProtectedRoute />}>
              <Route path={paths.profile} element={<SessionsPanel />} />
            </Route>
            <Route element={<ProtectedRoute roles={['EMPLOYEE']} />}>
              <Route element={<EmployeeFaceGate />}>
                <Route path={paths.employee.dashboard} element={<span>menú empleado</span>} />
                <Route path={paths.employee.enroll} element={<span>registro facial</span>} />
                <Route path={paths.employee.pending} element={<span>en validación</span>} />
              </Route>
            </Route>
            <Route element={<ProtectedRoute roles={['COMPANY']} />}>
              <Route path={paths.company.dashboard} element={<span>panel empresa</span>} />
            </Route>
          </Routes>
        </AuthProvider>
      </FeedbackProvider>
    </MemoryRouter>,
  );
}

const withFace = (face_status: FaceStatus): User => ({ ...sampleUser, employee: sampleUser.employee && { ...sampleUser.employee, face_status } });

describe('rutas', () => {
  it('helpers de rutas', () => {
    expect(homeFor('COMPANY')).toBe(paths.company.dashboard);
    expect(homeFor('EMPLOYEE')).toBe(paths.employee.dashboard);
    expect(homeFor('VALIDATOR')).toBe(paths.validator.checkpoint);
    expect(homeFor('ADMIN')).toBe(paths.admin.dashboard);
    expect(paths.company.employee(3)).toBe('/company/employees/3');
    expect(paths.company.editEmployee(3)).toBe('/company/employees/3/edit');
    expect(paths.company.validation(4)).toBe('/company/validations/4');
  });

  it('la raíz lleva al inicio del rol tras restaurar la sesión', async () => {
    renderApp('/');
    expect(screen.getByText(/Restaurando/)).toBeInTheDocument();
    expect(await screen.findByText('menú empleado')).toBeInTheDocument();
  });

  it.each([
    ['NOT_ENROLLED', 'registro facial'],
    ['PENDING_REVIEW', 'en validación'],
    ['APPROVED', 'menú empleado'],
  ] as const)('EmployeeFaceGate dirige según el estado %s', async (status, screenText) => {
    renderApp(paths.employee.dashboard, withFace(status));
    expect(await screen.findByText(screenText)).toBeInTheDocument();
  });

  it('un empleado aprobado no vuelve al registro', async () => {
    renderApp(paths.employee.enroll, withFace('APPROVED'));
    expect(await screen.findByText('menú empleado')).toBeInTheDocument();
  });

  it('rol incorrecto ve "sin permisos"', async () => {
    renderApp(paths.company.dashboard);
    await waitFor(() => expect(screen.queryByText(/Restaurando/)).toBeNull());
    expect(screen.queryByText('panel empresa')).toBeNull();
  });

  it('SessionsPanel lista sesiones y revoca otra', async () => {
    let revoked = false;
    const sessions = () => [
      { id: 'a', created_at: new Date().toISOString(), last_used_at: null, expires_at: 'x', ip_address: '1.1.1.1', user_agent: 'Mozilla (iPhone) Mobile Safari/1', current: true },
      ...(revoked ? [] : [{ id: 'b', created_at: new Date().toISOString(), last_used_at: null, expires_at: 'x', ip_address: null, user_agent: null, current: false }]),
    ];
    renderApp(paths.profile, sampleUser, {
      '/auth/sessions/b': () => {
        revoked = true;
        return apiOk(null);
      },
      '/auth/sessions': () => apiOk(sessions()),
    });
    expect(await screen.findByText('Este dispositivo')).toBeInTheDocument();
    expect(screen.getByText('Dispositivo desconocido')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => expect(screen.queryByText('Dispositivo desconocido')).toBeNull());
    await userEvent.click(screen.getByRole('button', { name: /todos los dispositivos/ }));
    expect(screen.getByRole('alertdialog', { name: 'Cerrar todas las sesiones' })).toBeInTheDocument();
  });
});
