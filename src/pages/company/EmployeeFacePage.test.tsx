import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CapturedFace } from '../../components/LiveFaceFlow';
import { resetPolicyCache } from '../../hooks/useVerificationPolicy';
import { ApiError } from '../../services/apiClient';
import { identifiedResult, samplePolicy } from '../../test/fixtures';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import type { Employee } from '../../types';
import { EmployeeFacePage } from './EmployeeFacePage';

interface FlowProps {
  title: string;
  facing: string;
  allowHeadwear: boolean;
  submittingMessage: string;
  onSubmit: (captured: CapturedFace) => Promise<void>;
  onFatal: (error: unknown) => void;
  onCancel: () => void;
}

// La cámara se prueba en navegador real; aquí, qué hace la pantalla con lo que entrega el flujo facial.
vi.mock('../../components/LiveFaceFlow', () => ({
  LiveFaceFlow: ({ title, facing, allowHeadwear, submittingMessage, onSubmit, onFatal, onCancel }: FlowProps) => (
    <div data-testid="flow" data-facing={facing} data-headwear={String(allowHeadwear)}>
      <h1>{title}</h1>
      <p>{submittingMessage}</p>
      <button onClick={() => void onSubmit({ frontal: [new Blob(['x'])], accessoryReview: false })}>capturar rostro</button>
      <button onClick={() => onFatal(new ApiError({ statusCode: 503, code: 'FACE_SERVICE_UNAVAILABLE', message: 'El motor facial no responde' }))}>falla del flujo</button>
      <button onClick={onCancel}>salir del flujo</button>
    </div>
  ),
}));

const ana = {
  id: 7,
  employee_number: 'EMP-7',
  first_name: 'Ana',
  last_name: 'Ruiz',
  full_name: 'Ana Ruiz',
  email: 'ana@empresa.com',
  headwear_exempt: true,
  face_status: 'APPROVED',
} as Employee;

/** Empleado, política y el envío de las capturas (registro o verificación en persona). */
function serve(submit: (call: MockCall) => Response) {
  return mockFetch((call) => {
    if (call.url === '/api/settings/verification') return apiOk(samplePolicy);
    if (call.init.method === 'POST') return submit(call);
    return apiOk(ana);
  });
}

function renderFace(mode: 'enroll' | 'verify') {
  return renderWithProviders(
    <Routes>
      <Route path="/company/employees/:id/face/:mode" element={<EmployeeFacePage />} />
      <Route path="/company/employees/:id" element={<p>Expediente del empleado</p>} />
    </Routes>,
    { route: `/company/employees/7/face/${mode}` },
  );
}

afterEach(() => resetPolicyCache());

describe('EmployeeFacePage: registro en persona', () => {
  it('con la cámara trasera; al registrar avisa que quedó aprobado y vuelve al expediente', async () => {
    const { calls } = serve(() => apiOk({ enrollment_id: 4, face_status: 'APPROVED', message: 'ok' }, { status: 201 }));
    renderFace('enroll');
    expect(await screen.findByRole('heading', { name: 'Registrar el rostro de Ana Ruiz' })).toBeInTheDocument();
    expect(screen.getByTestId('flow')).toHaveAttribute('data-facing', 'environment');
    expect(screen.getByTestId('flow')).toHaveAttribute('data-headwear', 'true'); // exento de prenda de cabeza
    expect(screen.getByText('Registrando rostro...')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'capturar rostro' }));

    expect(await screen.findByText('Expediente del empleado')).toBeInTheDocument();
    const popup = await screen.findByRole('dialog', { name: 'Rostro registrado' });
    expect(popup).toHaveTextContent('Ana Ruiz ya puede identificarse con su rostro.');
    expect(popup).toHaveTextContent('Queda constancia de quién lo registró.');
    expect(calls.find((c) => c.init.method === 'POST')?.url).toBe('/api/employees/7/face/enroll');
  });

  it('si el flujo no puede continuar lo explica y vuelve al expediente', async () => {
    serve(() => apiFail(500, 'INTERNAL_ERROR'));
    renderFace('enroll');
    await userEvent.click(await screen.findByRole('button', { name: 'falla del flujo' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo registrar el rostro' })).toHaveTextContent('El motor facial no responde');
    expect(screen.getByText('Expediente del empleado')).toBeInTheDocument();
  });

  it('salir del flujo vuelve al expediente', async () => {
    serve(() => apiFail(500, 'INTERNAL_ERROR'));
    renderFace('enroll');
    await userEvent.click(await screen.findByRole('button', { name: 'salir del flujo' }));
    expect(await screen.findByText('Expediente del empleado')).toBeInTheDocument();
  });

  it('si el empleado no carga ofrece volver a cargar', async () => {
    let attempts = 0;
    mockFetch((call) => {
      if (call.url === '/api/settings/verification') return apiOk(samplePolicy);
      attempts += 1;
      return attempts === 1 ? apiFail(404, 'EMPLOYEE_NOT_FOUND', 'Empleado no encontrado') : apiOk(ana);
    });
    renderFace('enroll');
    await screen.findByRole('alertdialog', { name: 'No se pudo cargar el empleado' });
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByRole('heading', { name: 'Registrar el rostro de Ana Ruiz' })).toBeInTheDocument();
  });
});

describe('EmployeeFacePage: verificación en persona', () => {
  it('verifica 1:1 y muestra el resultado; "Finalizar" vuelve al expediente', async () => {
    const { calls } = serve(() => apiOk(identifiedResult));
    renderFace('verify');
    expect(await screen.findByRole('heading', { name: 'Verificar a Ana Ruiz' })).toBeInTheDocument();
    expect(screen.getByText('Verificando identidad...')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'capturar rostro' }));

    const result = await screen.findByRole('alert');
    expect(within(result).getByRole('heading', { name: 'Identificación exitosa' })).toBeInTheDocument();
    expect(calls.find((c) => c.init.method === 'POST')?.url).toBe('/api/employees/7/face/verify');
    await userEvent.click(within(result).getByRole('button', { name: 'Finalizar' }));
    expect(await screen.findByText('Expediente del empleado')).toBeInTheDocument();
  });

  it('si el flujo falla muestra por qué no se pudo verificar y permite intentar de nuevo', async () => {
    serve(() => apiOk(identifiedResult));
    renderFace('verify');
    await userEvent.click(await screen.findByRole('button', { name: 'falla del flujo' }));
    const result = await screen.findByRole('alert');
    expect(within(result).getByRole('heading', { name: 'No se pudo verificar a Ana' })).toBeInTheDocument();
    expect(result).toHaveTextContent('El motor facial no responde');
    await userEvent.click(within(result).getByRole('button', { name: 'Intentar de nuevo' }));
    expect(await screen.findByRole('heading', { name: 'Verificar a Ana Ruiz' })).toBeInTheDocument();
  });
});
