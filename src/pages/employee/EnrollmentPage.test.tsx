import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CapturedFace } from '../../components/LiveFaceFlow';
import { resetPolicyCache } from '../../hooks/useVerificationPolicy';
import { paths } from '../../routes/paths';
import { ApiError } from '../../services/apiClient';
import { samplePolicy } from '../../test/fixtures';
import { apiFail, apiOk, mockFetch } from '../../test/http';
import { renderWithProviders, sampleUser } from '../../test/render';
import type { User, UserEmployeeInfo } from '../../types';
import { EnrollmentPage } from './EnrollmentPage';

const session = vi.hoisted(() => ({ user: null as User | null, refreshUser: vi.fn<() => Promise<void>>(), flowErrors: [] as unknown[], waits: [] as number[] }));
// Las esperas entre reintentos (1 s, 2 s, 4 s) se registran sin esperar de verdad.
vi.mock('../../utils/waits', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  sleep: (ms: number) => {
    session.waits.push(ms);
    return Promise.resolve();
  },
}));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => session }));
// La cámara se prueba en navegador real; aquí, qué hace la pantalla con el resultado del envío. El
// flujo facial recibe el error si `onSubmit` lo lanza (y entonces reintentaría o lo mostraría).
interface FlowProps {
  title: string;
  onSubmit: (captured: CapturedFace) => Promise<void>;
  onFatal: (error: unknown) => void;
  onCancel: () => void;
}
vi.mock('../../components/LiveFaceFlow', () => ({
  LiveFaceFlow: ({ title, onSubmit, onFatal, onCancel }: FlowProps) => (
    <div>
      <h1>{title}</h1>
      <button onClick={() => void onSubmit({ frontal: [new Blob(['x'])], accessoryReview: false }).catch((error: unknown) => session.flowErrors.push(error))}>
        capturar rostro
      </button>
      <button onClick={() => onFatal(new Error('La cámara dejó de responder'))}>falla de cámara</button>
      <button onClick={onCancel}>salir</button>
    </div>
  ),
}));

function renderEnrollment(submit: () => Response) {
  const { calls } = mockFetch((call) => (call.url.includes('/enrollment/face') ? submit() : apiOk(samplePolicy)));
  renderWithProviders(
    <Routes>
      <Route path="/" element={<EnrollmentPage />} />
      <Route path={paths.employee.pending} element={<p>Registro en validación</p>} />
    </Routes>,
  );
  return () => calls.filter((call) => call.url.includes('/enrollment/face'));
}

async function captureAndSubmit() {
  await userEvent.click(await screen.findByRole('button', { name: /Comenzar registro/ }));
  await userEvent.click(screen.getByRole('button', { name: 'capturar rostro' }));
}

beforeEach(() => {
  session.user = sampleUser;
  session.flowErrors = [];
  session.waits = [];
  session.refreshUser.mockResolvedValue(undefined);
});
afterEach(() => resetPolicyCache());

describe('EnrollmentPage: envío del registro facial', () => {
  it('registro guardado aunque releer el usuario falle: no se reenvía ni salta a una pantalla que aún no tiene', async () => {
    session.refreshUser.mockRejectedValue(new ApiError({ statusCode: 0, code: 'NETWORK_ERROR', message: 'Sin red' }));
    const submissions = renderEnrollment(() => apiOk({ enrollment_id: 3, face_status: 'PENDING_REVIEW' }));
    await captureAndSubmit();
    const dialog = await screen.findByRole('dialog', { name: 'Registro enviado' });
    expect(dialog).toHaveTextContent('Tu pantalla se actualizará en cuanto vuelva la conexión');
    expect(session.refreshUser).toHaveBeenCalledTimes(3);
    expect(session.waits).toEqual([1000, 2000, 4000]);
    expect(screen.queryByText('Registro en validación')).toBeNull(); // el usuario viejo rebotaría al registro
    expect(session.flowErrors).toEqual([]); // el flujo no lo toma por un envío fallido
    expect(submissions()).toHaveLength(1);
  });

  it('si releer el usuario falla una vez y luego responde, lleva a la espera de validación', async () => {
    session.refreshUser.mockRejectedValueOnce(new ApiError({ statusCode: 0, code: 'NETWORK_ERROR', message: 'Sin red' }));
    renderEnrollment(() => apiOk({ enrollment_id: 3, face_status: 'PENDING_REVIEW' }));
    await captureAndSubmit();
    expect(await screen.findByText('Registro en validación')).toBeInTheDocument();
    expect(session.waits).toEqual([1000]);
  });

  it('409 ENROLLMENT_PENDING (un envío anterior ya llegó) cuenta como enviado', async () => {
    renderEnrollment(() => apiFail(409, 'ENROLLMENT_PENDING', 'Tu registro facial ya fue enviado y está en validación'));
    await captureAndSubmit();
    expect(await screen.findByText('Registro en validación')).toBeInTheDocument();
    expect(session.refreshUser).toHaveBeenCalledOnce();
    expect(session.flowErrors).toEqual([]);
  });

  it('cualquier otro error del envío sube al flujo facial (que lo corrige o lo muestra)', async () => {
    renderEnrollment(() => apiFail(409, 'CONFLICT', 'Otro conflicto'));
    await captureAndSubmit();
    await vi.waitFor(() => expect(session.flowErrors).toHaveLength(1));
    expect(session.flowErrors[0]).toMatchObject({ code: 'CONFLICT' });
    expect(screen.queryByText('Registro en validación')).toBeNull();
    expect(session.refreshUser).not.toHaveBeenCalled();
  });
});

describe('EnrollmentPage: bienvenida y avisos al entrar', () => {
  const withEmployee = (changes: Partial<UserEmployeeInfo>) => {
    session.user = { ...sampleUser, employee: sampleUser.employee && { ...sampleUser.employee, ...changes } };
  };

  it('primer registro: saluda por su nombre y no muestra avisos', async () => {
    withEmployee({ face_status: 'NOT_ENROLLED' });
    renderEnrollment(() => apiOk(null));
    expect(screen.getByRole('heading', { name: 'Bienvenido, Ana' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Comenzar registro/ })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('sin datos de empleado aún: saludo sin nombre', () => {
    session.user = { ...sampleUser, employee: null };
    renderEnrollment(() => apiOk(null));
    expect(screen.getByRole('heading', { name: 'Bienvenido,' })).toBeInTheDocument();
  });

  it.each([
    ['con el motivo de la empresa', 'La foto está borrosa', 'Motivo: “La foto está borrosa”.'],
    ['sin motivo', null, 'Tu empresa no pudo validar tu identidad con las capturas enviadas.'],
  ])('registro rechazado %s: lo explica en un popup y pide registrarse de nuevo', async (_case, reason, text) => {
    withEmployee({ face_status: 'REJECTED', face_rejection_reason: reason });
    renderEnrollment(() => apiOk(null));
    const popup = await screen.findByRole('alertdialog', { name: 'Tu registro anterior fue rechazado' });
    expect(popup).toHaveTextContent(text);
    expect(popup).toHaveTextContent('Ubícate en un lugar bien iluminado.');
    expect(screen.getByRole('heading', { name: 'Registra tu rostro nuevamente' })).toBeInTheDocument();
  });

  it('la empresa pidió verificar de nuevo la identidad: popup con su motivo', async () => {
    withEmployee({ face_status: 'NOT_ENROLLED', face_rejection_reason: 'Cambio importante de apariencia' });
    renderEnrollment(() => apiOk(null));
    const popup = await screen.findByRole('dialog', { name: 'Verifica nuevamente tu identidad' });
    expect(popup).toHaveTextContent('Solicitud de tu empresa');
    expect(popup).toHaveTextContent('Cambio importante de apariencia');
    expect(screen.getByRole('heading', { name: 'Registra tu rostro nuevamente' })).toBeInTheDocument();
  });

  it('salir de la cámara regresa a la bienvenida; una falla del flujo además se avisa en popup', async () => {
    renderEnrollment(() => apiOk(null));
    await userEvent.click(await screen.findByRole('button', { name: /Comenzar registro/ }));
    await userEvent.click(screen.getByRole('button', { name: 'salir' }));
    expect(await screen.findByRole('button', { name: /Comenzar registro/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Comenzar registro/ }));
    await userEvent.click(screen.getByRole('button', { name: 'falla de cámara' }));
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo completar el registro' });
    expect(popup).toHaveTextContent('La cámara dejó de responder');
    expect(screen.getByRole('button', { name: /Comenzar registro/ })).toBeInTheDocument();
  });
});
