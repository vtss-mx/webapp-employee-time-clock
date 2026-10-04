import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CapturedFace, FlowAlternative } from '../../components/LiveFaceFlow';
import { resetPolicyCache } from '../../hooks/useVerificationPolicy';
import { paths } from '../../routes/paths';
import { ApiError } from '../../services/apiClient';
import { identifiedResult, samplePolicy } from '../../test/fixtures';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../test/http';
import { renderWithProviders, sampleUser } from '../../test/render';
import type { User, VerificationPolicy } from '../../types';
import { FaceVerificationPage } from './FaceVerificationPage';
import { PendingValidationPage } from './PendingValidationPage';
import { VerificationMenuPage } from './VerificationMenuPage';

const session = vi.hoisted(() => ({ user: null as User | null, refreshUser: vi.fn<() => Promise<void>>(), flowErrors: [] as unknown[] }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => session }));

interface FlowProps {
  title: string;
  alternative?: FlowAlternative;
  onSubmit: (captured: CapturedFace) => Promise<void>;
  onFatal: (error: unknown) => void;
  onCancel: () => void;
}
// La cámara y el detector se prueban en navegador real; aquí, qué hace la pantalla con cada salida del
// flujo. Si `onSubmit` lanza, el error le llega al flujo (que reintenta o lo muestra).
vi.mock('../../components/LiveFaceFlow', () => ({
  LiveFaceFlow: ({ title, alternative, onSubmit, onFatal, onCancel }: FlowProps) => (
    <div>
      <h1>{title}</h1>
      <button onClick={() => void onSubmit({ frontal: [new Blob(['x'])], accessoryReview: false }).catch((error: unknown) => session.flowErrors.push(error))}>
        capturar rostro
      </button>
      <button onClick={() => onFatal(new Error('No se pudo abrir la cámara'))}>falla de cámara</button>
      <button onClick={onCancel}>salir</button>
      {alternative && <button onClick={alternative.onSelect}>{alternative.label}</button>}
    </div>
  ),
}));

/** Política de la empresa (GET /settings/verification) y la verificación facial. */
function server(policy: Partial<VerificationPolicy> = {}, verify: () => Response = () => apiOk(identifiedResult)) {
  return mockFetch((call: MockCall) => (call.url.includes('/settings/verification') ? apiOk({ ...samplePolicy, ...policy }) : verify()));
}
/** La pantalla y a dónde lleva: el menú del empleado y su QR. */
function renderAt(route: string, page: ReactElement) {
  return renderWithProviders(
    <Routes>
      <Route path={route} element={page} />
      <Route path={paths.employee.dashboard} element={<p>Menú del empleado</p>} />
      <Route path={paths.employee.myQr} element={<p>Mi código QR</p>} />
    </Routes>,
    { route },
  );
}
const renderVerification = () => renderAt(paths.employee.verifyFace, <FaceVerificationPage />);

beforeEach(() => {
  session.user = sampleUser;
  session.flowErrors = [];
  session.refreshUser.mockResolvedValue(undefined);
});
afterEach(() => resetPolicyCache());

describe('FaceVerificationPage (el empleado se identifica con su rostro)', () => {
  it('rostro reconocido: saluda y "Finalizar" vuelve al menú', async () => {
    const { calls } = server();
    renderVerification();
    expect(screen.getByRole('heading', { name: 'Verificación facial' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'capturar rostro' }));
    expect(await screen.findByText('Identificación exitosa')).toBeInTheDocument();
    expect(screen.getByText('¡Hola, Ana! Tu identidad fue confirmada.')).toBeInTheDocument();
    expect(calls.find((c) => c.init.method === 'POST')?.url).toBe('/api/verification/face');
    await userEvent.click(screen.getByRole('button', { name: 'Finalizar' }));
    expect(await screen.findByText('Menú del empleado')).toBeInTheDocument();
  });

  it('rostro no reconocido: el motivo del backend y "Intentar de nuevo" vuelve a la cámara', async () => {
    server({}, () => apiOk({ ...identifiedResult, verified: false, message: 'Rostro no reconocido', employee_id: null }));
    renderVerification();
    await userEvent.click(screen.getByRole('button', { name: 'capturar rostro' }));
    expect(await screen.findByText('No fue posible verificar tu identidad')).toBeInTheDocument();
    expect(screen.getByText('Rostro no reconocido')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Intentar de nuevo' }));
    expect(screen.getByRole('heading', { name: 'Verificación facial' })).toBeInTheDocument();
  });

  it('una falla que el flujo no puede resolver (cámara) se muestra como resultado con su motivo', async () => {
    server();
    renderVerification();
    await userEvent.click(screen.getByRole('button', { name: 'falla de cámara' }));
    expect(await screen.findByText('No fue posible verificar tu identidad')).toBeInTheDocument();
    expect(screen.getByText('No se pudo abrir la cámara')).toBeInTheDocument();
  });

  it('un error del servidor al verificar sube al flujo facial: no muestra un resultado falso', async () => {
    server({}, () => apiFail(409, 'FACE_LOCKED', 'Demasiados intentos fallidos'));
    renderVerification();
    await userEvent.click(screen.getByRole('button', { name: 'capturar rostro' }));
    await waitFor(() => expect(session.flowErrors).toHaveLength(1));
    expect(session.flowErrors[0]).toMatchObject({ code: 'FACE_LOCKED' });
    expect(screen.getByRole('heading', { name: 'Verificación facial' })).toBeInTheDocument();
    expect(screen.queryByText('Identificación exitosa')).toBeNull();
  });

  it('con el QR habilitado ofrece mostrar el código en su lugar', async () => {
    server();
    renderVerification();
    await userEvent.click(await screen.findByRole('button', { name: 'Mostrar mi código QR' }));
    expect(await screen.findByText('Mi código QR')).toBeInTheDocument();
  });

  it('salir de la cámara vuelve al menú', async () => {
    server();
    renderVerification();
    await userEvent.click(screen.getByRole('button', { name: 'salir' }));
    expect(await screen.findByText('Menú del empleado')).toBeInTheDocument();
  });

  it('con el QR deshabilitado por la empresa no ofrece la alternativa', async () => {
    const { calls } = server({ qr_enabled: false });
    renderVerification();
    await waitFor(() => expect(calls.some((c) => c.url.includes('/settings/verification'))).toBe(true));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Mostrar mi código QR' })).toBeNull());
  });
});

describe('VerificationMenuPage (cómo identificarse)', () => {
  it('saluda por su nombre y ofrece rostro (con prueba de vida) o su QR con la vigencia de la política', async () => {
    server({ qr_lifetime_seconds: 45 });
    renderAt(paths.employee.dashboard, <VerificationMenuPage />);
    expect(screen.getByRole('heading', { name: 'Hola, Ana' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /VERIFICAR CON ROSTRO/ })).toHaveAttribute('href', paths.employee.verifyFace);
    expect(screen.getByText('Reconocimiento facial con prueba de vida')).toBeInTheDocument();
    const qr = await screen.findByRole('link', { name: /MOSTRAR MI QR.*cambia cada 45 s/ });
    expect(qr).toHaveAttribute('href', paths.employee.myQr);
  });

  it('sin prueba de vida ni QR en la política: solo el rostro; sin nombre, un saludo general', async () => {
    session.user = { ...sampleUser, employee: null };
    server({ liveness_challenge: false, qr_enabled: false });
    renderAt(paths.employee.dashboard, <VerificationMenuPage />);
    expect(screen.getByRole('heading', { name: 'Hola' })).toBeInTheDocument();
    expect(await screen.findByText('Reconocimiento facial')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /MOSTRAR MI QR/ })).toBeNull();
  });
});

describe('PendingValidationPage (registro en validación)', () => {
  it('explica en qué paso va; "Actualizar estado" relee el usuario sin avisos si sale bien', async () => {
    renderWithProviders(<PendingValidationPage />);
    expect(screen.getByRole('heading', { name: 'Estamos validando tu identidad' })).toBeInTheDocument();
    expect(screen.getByText(/Ana, tu registro facial se envió correctamente/)).toBeInTheDocument();
    expect(screen.getByText('Registro facial enviado').closest('li')).toHaveClass('is-done');
    expect(screen.getByText('Validación por tu empresa').closest('li')).toHaveClass('is-current');
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar estado' }));
    expect(session.refreshUser).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('si actualizar falla, lo avisa en popup', async () => {
    session.refreshUser.mockRejectedValue(new ApiError({ statusCode: 503, code: 'SERVICE_UNAVAILABLE', message: 'Servidor ocupado' }));
    renderWithProviders(<PendingValidationPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar estado' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo actualizar el estado' })).toHaveTextContent('Servidor ocupado');
  });

  it('se actualiza sola: relee el usuario periódicamente (no al entrar)', async () => {
    vi.useFakeTimers();
    try {
      renderWithProviders(<PendingValidationPage />);
      expect(session.refreshUser).not.toHaveBeenCalled();
      await act(() => vi.advanceTimersByTimeAsync(40_000)); // 30 s ± 20 %
      expect(session.refreshUser).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});
