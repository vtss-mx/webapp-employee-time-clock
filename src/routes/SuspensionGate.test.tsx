import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppErrorScreen } from '../components/AppErrorScreen';
import { AuthProvider } from '../context/AuthContext';
import { FeedbackProvider } from '../context/FeedbackContext';
import { useAuth } from '../hooks/useAuth';
import { setLocale } from '../i18n/core';
import { ApiError, apiRequest, COMPANY_SUSPENDED } from '../services/apiClient';
import { apiOk, envelope, jsonResponse, mockFetch, type MockCall } from '../test/http';
import { settle } from '../test/companyPages';
import { tokenResponse } from '../test/render';
import { isHandledGlobally } from '../utils/errorPresentation';
import { SuspensionGate } from './SuspensionGate';

const MESSAGE = 'Tu empresa está suspendida. Contacta al administrador de la plataforma para reactivarla.';

function suspended(status: 401 | 403): Response {
  const error = { code: COMPANY_SUSPENDED, message: MESSAGE, field: null, details: null };
  return jsonResponse(envelope(null, { status, code: COMPANY_SUSPENDED, message: MESSAGE, errors: [error] }), status);
}

// El hook queda fuera de la compuerta para seguir montado mientras se muestra la pantalla.
const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter initialEntries={['/company/dashboard']}>
    <FeedbackProvider>
      <AuthProvider>
        {children}
        <SuspensionGate>
          <Routes>
            <Route path="/login" element={<p>Inicio de sesión</p>} />
            <Route path="*" element={<p>La app</p>} />
          </Routes>
        </SuspensionGate>
      </AuthProvider>
    </FeedbackProvider>
  </MemoryRouter>
);

const exit = () => userEvent.click(screen.getByRole('button', { name: 'Volver al inicio de sesión' }));

describe('SuspensionGate (empresa suspendida)', () => {
  it('al iniciar sesión (403): pantalla completa con el mensaje del servidor; volver lleva al login sin otro aviso', async () => {
    mockFetch(suspended(403));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => result.current.login('ana@pan.com', 'Clave1234567').catch(() => undefined));

    const gate = screen.getByRole('alert');
    expect(gate).toHaveTextContent('Acceso suspendido');
    expect(screen.getByRole('heading', { name: 'Tu empresa está suspendida' })).toBeInTheDocument();
    expect(gate).toHaveTextContent(MESSAGE);
    expect(gate).toHaveTextContent('Para reactivarla, comunícate con el administrador de la plataforma.');
    expect(screen.queryByText('La app')).toBeNull(); // la app no se muestra detrás
    expect(screen.queryByRole('dialog')).toBeNull();

    await exit();
    expect(await screen.findByText('Inicio de sesión')).toBeInTheDocument();
    expect(result.current.suspension).toBeNull();
    expect(result.current.logoutReason).toBeNull();
  });

  it('con sesión, un 401 COMPANY_SUSPENDED cierra la sesión y muestra la pantalla; el login no repite "Tu sesión terminó"', async () => {
    mockFetch((call) => (call.url.endsWith('/auth/login') ? apiOk(tokenResponse()) : suspended(401)));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => result.current.login('ana@pan.com', 'Clave1234567'));
    expect(screen.getByText('La app')).toBeInTheDocument();
    await act(() => apiRequest('/employees').catch(() => undefined));

    expect(screen.getByRole('heading', { name: 'Tu empresa está suspendida' })).toBeInTheDocument();
    expect(result.current.isAuthenticated).toBe(false); // el flujo del 401 cerró la sesión local
    await exit();
    expect(await screen.findByText('Inicio de sesión')).toBeInTheDocument();
    expect(result.current.logoutReason).toBeNull();
  });

  it('con sesión, un 403 COMPANY_SUSPENDED: "Volver" cierra la sesión en el servidor (de mejor esfuerzo) mientras el botón trabaja', async () => {
    let release: (response: Response) => void = () => undefined;
    const { calls } = mockFetch((call: MockCall) => {
      if (call.url.endsWith('/auth/login')) return apiOk(tokenResponse());
      if (call.url.endsWith('/auth/logout')) return new Promise<Response>((resolve) => (release = resolve));
      return suspended(403);
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => result.current.login('ana@pan.com', 'Clave1234567'));
    await act(() => apiRequest('/employees').catch(() => undefined));
    expect(result.current.isAuthenticated).toBe(true);

    await exit();
    expect(screen.getByRole('button', { name: 'Volver al inicio de sesión' })).toHaveAttribute('aria-busy', 'true');
    await settle(() => release(suspended(403))); // el servidor también lo rechaza: se cierra igual
    expect(await screen.findByText('Inicio de sesión')).toBeInTheDocument();
    expect(result.current.isAuthenticated).toBe(false);
    expect(calls.some((call) => call.url.endsWith('/auth/logout'))).toBe(true);
    await waitFor(() => expect(result.current.suspension).toBeNull());
  });

  it('las pantallas no repiten el aviso: el error se presenta de forma global (también en el login)', () => {
    const error = new ApiError({ statusCode: 403, code: COMPANY_SUSPENDED, message: MESSAGE });
    expect(isHandledGlobally(error)).toBe(true);
    expect(isHandledGlobally(error, { showAuthErrors: true })).toBe(true);
    expect(isHandledGlobally(new ApiError({ statusCode: 403, code: 'FORBIDDEN', message: 'No' }))).toBe(false);
  });
});

describe('pantallas completas de error en inglés (en-US)', () => {
  it('suspensión: sus textos siguen al idioma al cambiarlo en caliente; el mensaje del servidor queda tal cual', async () => {
    mockFetch(suspended(403));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => result.current.login('ana@pan.com', 'Clave1234567').catch(() => undefined));
    await act(() => setLocale('en-US'));
    const gate = screen.getByRole('alert');
    expect(gate).toHaveTextContent('Access suspended');
    expect(screen.getByRole('heading', { name: 'Your company is suspended' })).toBeInTheDocument();
    expect(gate).toHaveTextContent(MESSAGE);
    expect(gate).toHaveTextContent('To reactivate it, contact the platform administrator.');
    expect(screen.getByRole('button', { name: 'Back to sign in' })).toBeInTheDocument();
  });

  it('error al cargar (por omisión): título, explicación y "Retry" en inglés', async () => {
    await setLocale('en-US');
    const retry = vi.fn();
    render(<AppErrorScreen onRetry={retry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Loading error');
    expect(screen.getByRole('heading', { name: "Couldn't load the information" })).toBeInTheDocument();
    expect(screen.getByText(/Check your connection and try again/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
