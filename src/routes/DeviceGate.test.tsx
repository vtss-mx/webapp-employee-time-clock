import { act, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { phoneAccessUrl } from '../components/PhoneAccessGuide';
import { AuthProvider, deviceBlockFrom } from '../context/AuthContext';
import { FeedbackProvider } from '../context/FeedbackContext';
import { useAuth } from '../hooks/useAuth';
import { apiRequest, MOBILE_DEVICE_REQUIRED } from '../services/apiClient';
import { apiOk, envelope, jsonResponse, mockFetch } from '../test/http';
import { tokenResponse } from '../test/render';
import { DeviceGate } from './DeviceGate';

vi.mock('qrcode', () => ({ toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,QR')) }));

const MESSAGE = 'Por políticas de tu empresa, el registro de asistencia solo está disponible desde tu teléfono celular.';

function deviceRejected(device: 'desktop' | 'tablet' = 'desktop'): Response {
  const error = { code: MOBILE_DEVICE_REQUIRED, message: MESSAGE, field: null, details: { device } };
  return jsonResponse(envelope(null, { status: 403, code: MOBILE_DEVICE_REQUIRED, message: MESSAGE, errors: [error] }), 403);
}

const setLocation = (url: string) => vi.spyOn(window, 'location', 'get').mockReturnValue(new URL(url) as unknown as Location);

// El hook queda fuera de la compuerta para seguir montado mientras se muestra el aviso.
const wrapper = ({ children }: { children: ReactNode }) => (
  <FeedbackProvider>
    <AuthProvider>
      {children}
      <DeviceGate>
        <p>contenido</p>
      </DeviceGate>
    </AuthProvider>
  </FeedbackProvider>
);

afterEach(() => vi.restoreAllMocks());

describe('phoneAccessUrl y deviceBlockFrom', () => {
  it('dirección para el teléfono salvo en localhost', () => {
    expect(phoneAccessUrl({ origin: 'https://192.168.1.76:8443', hostname: '192.168.1.76' })).toBe('https://192.168.1.76:8443/login');
    expect(phoneAccessUrl({ origin: 'http://localhost:8080', hostname: 'localhost' })).toBeNull();
  });

  it('tipo de dispositivo desde los detalles del error', () => {
    const errors = [{ code: MOBILE_DEVICE_REQUIRED, message: MESSAGE, field: null, details: { device: 'tablet' } }];
    expect(deviceBlockFrom({ message: MESSAGE, code: 'MOBILE_DEVICE_REQUIRED', errors })).toEqual({ device: 'tablet', requires: 'phone', message: MESSAGE });
    expect(deviceBlockFrom({ message: MESSAGE, code: 'TOUCH_DEVICE_REQUIRED', errors: [] })).toMatchObject({ device: 'desktop', requires: 'touch' });
  });
});

describe('DeviceGate', () => {
  it('login desde computadora: popup con pasos, dirección y QR; "Entendido" vuelve al login', async () => {
    setLocation('https://192.168.1.76:8443/login');
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    mockFetch(deviceRejected('desktop'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => result.current.login('ana@empresa.com', 'Clave123').catch(() => undefined));

    const popup = await screen.findByRole('dialog', { name: 'Continúa desde tu teléfono celular' });
    expect(within(popup).getByText('Estás usando una computadora')).toBeInTheDocument();
    expect(popup).toHaveAccessibleDescription(MESSAGE);
    expect(within(popup).getByText('https://192.168.1.76:8443/login')).toBeInTheDocument();
    expect(await within(popup).findByAltText(/Código QR/)).toHaveAttribute('src', 'data:image/png;base64,QR');
    expect(within(popup).queryByRole('button', { name: 'Cerrar' })).toBeNull(); // obligatorio
    await userEvent.click(within(popup).getByRole('button', { name: 'Copiar dirección' }));
    expect(writeText).toHaveBeenCalledWith('https://192.168.1.76:8443/login');
    expect(screen.getByText('contenido')).toBeInTheDocument(); // el login sigue detrás

    await userEvent.click(within(popup).getByRole('button', { name: 'Entendido' }));
    await waitFor(() => expect(result.current.deviceBlock).toBeNull());
  });

  it('validador en computadora: el aviso pide una tableta o un teléfono', async () => {
    setLocation('https://192.168.1.76:8443/login');
    const message = 'Por políticas de tu empresa, la validación de identidad solo está disponible desde una tableta o un teléfono.';
    const error = { code: 'TOUCH_DEVICE_REQUIRED', message, field: null, details: { device: 'desktop' } };
    mockFetch(jsonResponse(envelope(null, { status: 403, code: 'TOUCH_DEVICE_REQUIRED', message, errors: [error] }), 403));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => result.current.login('recepcion@empresa.com', 'Valida1234').catch(() => undefined));

    const popup = await screen.findByRole('dialog', { name: 'Continúa desde una tableta o un teléfono' });
    expect(within(popup).getByText('Abre la tableta o el teléfono.')).toBeInTheDocument();
    expect(within(popup).getByText('Escanéalo con la tableta o el teléfono')).toBeInTheDocument();
    expect(within(popup).getByText(/¿Ya estás en una tableta o un teléfono\?/)).toBeInTheDocument();
  });

  it('con sesión abierta oculta la app y "Cerrar sesión" revoca la sesión', async () => {
    setLocation('http://localhost:8080/employee');
    const { calls } = mockFetch((call) =>
      call.url.endsWith('/auth/login') ? apiOk(tokenResponse()) : call.url.endsWith('/auth/logout') ? apiOk(null) : deviceRejected('tablet'),
    );
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => result.current.login('ana@empresa.com', 'Clave123'));
    await act(() => apiRequest('/users/me').catch(() => undefined));

    const popup = await screen.findByRole('dialog', { name: 'Continúa desde tu teléfono celular' });
    expect(within(popup).getByText('Estás usando una tableta')).toBeInTheDocument();
    expect(within(popup).queryByAltText(/Código QR/)).toBeNull(); // localhost: no sirve en el teléfono
    expect(screen.queryByText('contenido')).toBeNull();

    await userEvent.click(within(popup).getByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(result.current.isAuthenticated).toBe(false));
    expect(calls.some((c) => c.url.endsWith('/auth/logout'))).toBe(true);
  });
});
