import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetPolicyCache } from '../../hooks/useVerificationPolicy';
import { paths } from '../../routes/paths';
import { ApiError } from '../../services/apiClient';
import { samplePolicy } from '../../test/fixtures';
import { apiOk, mockFetch } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import { FaceVerificationPage } from './FaceVerificationPage';

/*
 * Lo que `FaceVerificationPage` hace con un error que el flujo facial no puede resolver (`onFatal`) cuando la persona
 * decide qué sigue: cancelar el aviso de ubicación, irse de la pantalla mientras algo está pendiente o un refresco del
 * usuario que falla. Los casos principales (resultado, QR, ubicación, registro no aprobado) están en `verification.test.tsx`.
 * La cámara se prueba en navegador real; aquí el flujo es un doble que solo entrega el error configurado.
 */
const session = vi.hoisted(() => ({ refreshUser: vi.fn<() => Promise<void>>() }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => session }));
vi.mock('../../hooks/useWarmLocation', () => ({ useWarmLocation: () => ({ take: () => Promise.resolve(null) }) }));

const flow = vi.hoisted((): { fatal: unknown; mounts: number } => ({ fatal: null, mounts: 0 }));
vi.mock('../../components/LiveFaceFlow', () => ({
  LiveFaceFlow: ({ onFatal, onCancel }: { onFatal: (error: unknown) => void; onCancel: () => void }) => {
    useEffect(() => {
      flow.mounts += 1;
    }, []);
    return (
      <div>
        <button onClick={() => onFatal(flow.fatal)}>fatal configurado</button>
        <button onClick={onCancel}>salir</button>
      </div>
    );
  },
}));

const locationRequired = () => new ApiError({ statusCode: 422, code: 'LOCATION_REQUIRED', message: 'Se necesita tu ubicación' });
const faceNotReady = (code: 'FACE_NOT_APPROVED' | 'FACE_NOT_REGISTERED') => new ApiError({ statusCode: 403, code, message: 'Tu registro no sirve' });

function renderVerification() {
  mockFetch(apiOk({ ...samplePolicy, verification_location: 'ENFORCE' }));
  return renderWithProviders(
    <Routes>
      <Route path={paths.employee.verifyFace} element={<FaceVerificationPage />} />
      <Route path={paths.employee.dashboard} element={<p>Menú del empleado</p>} />
      <Route path={paths.employee.enroll} element={<p>Registro facial</p>} />
    </Routes>,
    { route: paths.employee.verifyFace },
  );
}

beforeEach(() => {
  flow.fatal = null;
  flow.mounts = 0;
  session.refreshUser.mockResolvedValue(undefined);
});
afterEach(() => resetPolicyCache());

describe('FaceVerificationPage: ubicación obligatoria que el servidor no recibió', () => {
  it('«Reintentar» vuelve a montar el escaneo (lectura nueva); «Cancelar» lo deja como estaba', async () => {
    flow.fatal = locationRequired();
    renderVerification();
    await userEvent.click(await screen.findByRole('button', { name: 'fatal configurado' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'Se necesita tu ubicación' })).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(flow.mounts).toBe(1); // sin cambios: ni reintento ni resultado de falla
    expect(screen.queryByText('No se pudo verificar tu identidad')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'fatal configurado' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'Se necesita tu ubicación' })).getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(flow.mounts).toBe(2));
  });

  it('si la persona se fue de la pantalla antes de responder el aviso, «Reintentar» ya no reinicia nada', async () => {
    flow.fatal = locationRequired();
    renderVerification();
    await userEvent.click(await screen.findByRole('button', { name: 'fatal configurado' }));
    const popup = await screen.findByRole('alertdialog', { name: 'Se necesita tu ubicación' });
    await userEvent.click(screen.getByRole('button', { name: 'salir', hidden: true }));
    expect(await screen.findByText('Menú del empleado')).toBeInTheDocument();
    await userEvent.click(within(popup).getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(flow.mounts).toBe(1);
    expect(screen.getByText('Menú del empleado')).toBeInTheDocument();
  });
});

describe('FaceVerificationPage: el registro facial dejó de servir', () => {
  it('si no se pudo releer al usuario, igual lleva al registro (la falla no se queda colgada ni se muestra como resultado)', async () => {
    flow.fatal = faceNotReady('FACE_NOT_REGISTERED');
    session.refreshUser.mockRejectedValue(new ApiError({ statusCode: 503, code: 'SERVER_BUSY', message: 'Servidor ocupado' }));
    renderVerification();
    await userEvent.click(await screen.findByRole('button', { name: 'fatal configurado' }));
    expect(await screen.findByText('Registro facial')).toBeInTheDocument();
    expect(session.refreshUser).toHaveBeenCalledOnce();
  });

  it('si la persona se fue mientras se releía al usuario, no la regresa al registro', async () => {
    flow.fatal = faceNotReady('FACE_NOT_APPROVED');
    let reloaded: () => void = () => undefined;
    session.refreshUser.mockReturnValue(new Promise<void>((resolve) => (reloaded = resolve)));
    renderVerification();
    await userEvent.click(await screen.findByRole('button', { name: 'fatal configurado' }));
    await waitFor(() => expect(session.refreshUser).toHaveBeenCalledOnce());
    await userEvent.click(screen.getByRole('button', { name: 'salir' }));
    expect(await screen.findByText('Menú del empleado')).toBeInTheDocument();
    reloaded();
    await waitFor(() => expect(session.refreshUser).toHaveResolved());
    expect(screen.getByText('Menú del empleado')).toBeInTheDocument();
    expect(screen.queryByText('Registro facial')).toBeNull();
  });
});
