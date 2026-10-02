import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { apiFail, apiOk, jsonResponse, mockFetch } from '../test/http';
import { renderWithProviders, sampleUser, tokenResponse } from '../test/render';
import { preferenceStore } from '../utils/storage';
import { LoginPage } from './LoginPage';

describe('LoginPage: todos los mensajes en popup', () => {
  it('el botón se habilita solo con correo válido y contraseña; el correo inválido se marca al salir', async () => {
    const { calls } = mockFetch(apiFail(500, 'NO_DEBE_LLAMARSE'));
    renderWithProviders(<LoginPage />, { auth: true });
    const button = screen.getByRole('button', { name: 'Iniciar sesión' });
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'ana@');
    await userEvent.tab();
    expect(screen.getByLabelText('Correo electrónico')).toHaveAccessibleDescription('Ingresa un correo válido');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Clave1234');
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'empresa.com');
    expect(button).toBeEnabled();
    expect(calls.some((c) => c.url.endsWith('/auth/login'))).toBe(false); // nunca se envió
    expect(within(document.body).queryByRole('alertdialog')).toBeNull();
  });

  it('credenciales incorrectas: popup (no aviso dentro de la tarjeta)', async () => {
    mockFetch(apiFail(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos'));
    const { container } = renderWithProviders(<LoginPage />, { auth: true });
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'ana@empresa.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Mala1234');
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo iniciar sesión' });
    expect(popup).toHaveTextContent('Correo o contraseña incorrectos');
    expect(container.querySelector('.auth-card .alert')).toBeNull();
  });

  it('diseño empresarial: sin panel de marca, con derechos reservados', () => {
    const { container } = renderWithProviders(<LoginPage />, { auth: true });
    expect(container.querySelector('.auth__brand')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.getByText(/Todos los derechos reservados\./)).toHaveTextContent(`© ${new Date().getFullYear()} Employee Time Clock.`);
  });
});

describe('LoginPage: Recordar mi cuenta (dato en la BD)', () => {
  const version = () => jsonResponse({ build: 'test-build' });
  const routes = (remembered: unknown) => (call: { url: string; init: RequestInit }) => {
    if (call.url.includes('version.json')) return version();
    if (call.url.endsWith('/auth/remembered')) return apiOk(call.init.method === 'DELETE' ? null : remembered);
    return apiOk(tokenResponse({ ...sampleUser, role: 'COMPANY' }));
  };
  const loginBody = (calls: Array<{ url: string; init: RequestInit }>) =>
    JSON.parse(calls.find((c) => c.url.endsWith('/auth/login'))?.init.body as string) as { remember: boolean };

  it('desmarcada por defecto: la sesión no se recuerda y nada queda en el navegador', async () => {
    const { calls } = mockFetch(routes(null));
    renderWithProviders(<LoginPage />, { auth: true });
    const remember = screen.getByRole('checkbox', { name: /Recordar mi cuenta/ });
    expect(remember).not.toBeChecked();
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'ana@empresa.com');
    await userEvent.type(screen.getByLabelText('Contraseña', { selector: 'input' }), 'Clave1234');
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    await waitFor(() => expect(preferenceStore.get('tc.signed-in')).toBe('1'));
    expect(loginBody(calls)).toMatchObject({ remember: false });
    expect(JSON.stringify({ ...localStorage })).not.toContain('ana@empresa.com');
  });

  it('marcada: el servidor recuerda la cuenta (nunca la contraseña ni el correo en el navegador)', async () => {
    const { calls } = mockFetch(routes(null));
    renderWithProviders(<LoginPage />, { auth: true });
    await userEvent.click(screen.getByRole('checkbox', { name: /Recordar mi cuenta/ }));
    await userEvent.type(screen.getByLabelText('Correo electrónico'), ' Ana@Empresa.com');
    await userEvent.type(screen.getByLabelText('Contraseña', { selector: 'input' }), 'Clave1234');
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    await waitFor(() => expect(loginBody(calls)).toMatchObject({ remember: true }));
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toMatch(/Clave1234|ana@empresa/i);
  });

  it('cuenta recordada en el dispositivo: correo escrito, casilla marcada, foco en la contraseña y "Usar otra cuenta"', async () => {
    const { calls } = mockFetch(routes({ email: 'ana@empresa.com' }));
    renderWithProviders(<LoginPage />, { auth: true });
    await waitFor(() => expect(screen.getByLabelText('Correo electrónico')).toHaveValue('ana@empresa.com'));
    expect(screen.getByRole('checkbox', { name: /Recordar mi cuenta/ })).toBeChecked();
    expect(screen.getByLabelText('Contraseña', { selector: 'input' })).toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: 'Usar otra cuenta' }));
    await waitFor(() => expect(screen.getByLabelText('Correo electrónico')).toHaveValue(''));
    expect(screen.getByRole('checkbox', { name: /Recordar mi cuenta/ })).not.toBeChecked();
    expect(screen.getByLabelText('Correo electrónico')).toHaveFocus();
    expect(calls.some((c) => c.url.endsWith('/auth/remembered') && c.init.method === 'DELETE')).toBe(true);
  });
});

describe('LoginPage: vista corporativa', () => {
  it('solo marca, tarjeta de acceso y derechos reservados (sin ayuda, recuperación ni enlaces extra)', () => {
    mockFetch(apiOk(null));
    renderWithProviders(<LoginPage />, { auth: true });
    expect(screen.getByRole('banner')).toHaveTextContent('Employee Time Clock');
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Todos los derechos reservados');
    expect(screen.getByRole('checkbox', { name: 'Recordar mi cuenta' })).toBeInTheDocument();
    for (const name of ['¿Necesitas ayuda?', '¿Olvidaste tu contraseña?', 'Ayuda']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
    expect(screen.queryByRole('link', { name: 'Documentación de la API' })).toBeNull();
    expect(screen.queryByText('Contraseñas protegidas')).toBeNull();
    expect(screen.queryByText(/Sesión de máximo/)).toBeNull();
  });
});
